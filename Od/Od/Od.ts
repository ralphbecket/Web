// Od.ts
// (C) Ralph Becket, 2016
//
// Observables-based vDOM.
//
// Virtual-DOM schemes are all the rage.  Essentially, manually updating the
// HTML DOM is hard to do efficiently and correctly.  vDOM schemes instead
// (typically) take the approach of
// - whenever something "interesting" happens (the user clicks something, an
//   AJAX request returns, that sort of thing) then an application-provided
//   function is called which
// - constructs a new vDOM structure (a cheaper, abstract) representing
//   what the DOM should look like and
// - the vDOM library then works out the minimal set of DOM updates required
//   to bring the DOM proper into line with the new vDOM representation.
//
// This has turned out to be simpler and more efficient, at scale, than other
// approaches.
//
// There are typically two flies in the ointment of the schemes I have studied:
// (1) the application re-generates the entire vDOM at each event, which is
//     then compared against the entire DOM; and
// (2) people want to include "components" in their vDOM, namely reusable
//     abstractions (e.g., for auto-complete inputs, grids, etc.).  These
//     things have always felt a little clunky to me in execution.
//
// My approach kills both these birds with one stone: observables.  The idea
// behind observables is that one can attach functions to them (subscriptions)
// to be executed whenever the value of the observable changes.
//
// Every "dynamic" DOM subtree (i.e., something that can change as the
// application runs) is managed via an observable whose value is a vDOM
// subtree.  When the observable changes, the patching algorithm is only
// applied to the affected DOM subtree.  In Od terms, such a structure is
// a 'component'.  A DOM subtree managed by a component is handled entirely
// and only by that component: parent components and subcomponents 
// operate entirely independently.
//
// This mechanism is general: "components" are just observables, like any
// other managed part of the DOM/vDOM relationship.
//
// Any DOM nodes that are removed are queued for "stripping" where any
// dangling event handlers are removed (this is important to avoid garbage
// retention).  Stripping happens in the background so it doesn't interfere
// with rendering.
//
// Unless explicitly told otherwise, Od normally batches DOM updates to be
// applied via requestAnimationFrame or some equivalent fallback mechanism.
//
//
//
// Credit where it's due: the following efforts have been inspirational and,
// in many cases, of enormous practical benefit: Knockout, Mithril, Inferno,
// and React.  I'd also like to mention the reactive school, but in the end
// I find the observables-based approach more natural.  For today, at least.
//
/// <reference path="./Obs.ts"/>
namespace Od {

    const debug = false;

    // ---- Public interface. ----

    export interface IVdom { }

    export type Vdom = string | IVdom;

    export type Vdoms = Vdom | Vdom[];

    // Properties are used to set attributes, event handlers, and so forth.
    // There are two special property names: "class" is allowed as a synonym
    // for "className"; and "style" can be either a string of the form
    // "color: red; width: 2em;" or an object of the form { color: "red",
    // width: "2em" }.
    export interface IProps { [prop: string]: any };

    export const text = (text: string): IVdom =>
        ({ isIVdom: true, text: isNully(text) ? "" : text.toString() });

    // Construct a vDOM node.
    export const element =
    (tag: string, props?: IProps, childOrChildren?: Vdoms): IVdom => {
        tag = tag.toUpperCase();
        const children =
            ( !childOrChildren
            ? null
            : isArray(childOrChildren)
            ? childOrChildren
            : [childOrChildren]
            ) as Vdom[];
        return { isIVdom: true, tag: tag, props: props, children: children };
    };

    // A named component persists within the scope of the component within
    // which it is defined.  That is, the immediate parent component can
    // be re- evaluated, but any named child components will persist from
    // the original construction of the parent, rather than being
    // recreated.  Names need only be unique within the scope of the
    // immediate parent component.
    //
    // Passing a nully name creates an anonymous 'component', which is
    // ephemeral (i.e., it will be re-created every time the parent component
    // updates).  Typically you do not want this!
    //
    // Component vDOM functions may optionally take an argument.  This is
    // convenient when constructing components that depend on external state. 
    //
    export type ComponentName = string | number; // May not be falsy.

    export function component<T>(
        name: ComponentName,
        fn: (x?: T) => Vdom,
        x?: T
    ): IVdom;
    export function component<T>(
        name: ComponentName,
        obs: Obs.IObservable<Vdom>
    ): IVdom;
    export function component(name: ComponentName, fn: any, x?: any): IVdom {
        const existingVdom = existingNamedComponentInstance(name);
        if (existingVdom) return existingVdom;
        const obs =
            ( Obs.isObservable(fn)
            ? fn as Obs.IObservable<Vdom>
            : Obs.fn(() => fn(x))
            );
        const vdom = {
            isIVdom: true,
            obs: obs,
            subscription: null,
            subcomponents: null,
            dom: null
        } as IVdom;
        const subs = Obs.subscribe([obs], updateComponent.bind(vdom));
        vdom.subscription = subs;
        // Attach this component as a subcomponent of the parent context.
        addAsParentSubcomponent(name, vdom);
        // Set the component context for the component body.
        const tmp = parentSubcomponents;
        parentSubcomponents = null;
        // Initialise the dom component.
        subs();
        // Record any subcomponents we have.
        vdom.subcomponents = parentSubcomponents;
        // Restore the parent subcomponent context.
        parentSubcomponents = tmp;
        return vdom;
    };

    // Any subcomponents of the component currently being defined.
    var parentSubcomponents = null as ISubComponents;

    const existingNamedComponentInstance = (name: ComponentName): IVdom =>
        (name != null) &&
        parentSubcomponents &&
        parentSubcomponents[name as string] as IVdom;

    const addAsParentSubcomponent =
    (name: ComponentName, child: IVdom): void => {
        if (!parentSubcomponents) parentSubcomponents = {} as ISubComponents;
        if (name) {
            parentSubcomponents[name as string] = child;
            return;
        }
        // Otherwise, this child has no name.  Aww.  In this case we
        // store a list of these nameless children under the special name "".
        if (!("" in parentSubcomponents)) parentSubcomponents[""] = [];
        (parentSubcomponents[""] as IVdom[]).push(child);
    }

    // Construct a static DOM subtree from an HTML string.
    // Note: this vDOM node can, like DOM nodes, only appear
    // in one place in the resulting DOM!  If you need copies,
    // you need duplicate fromHtml instances.
    export const fromHtml = (html: string): IVdom => {
        // First, turn the HTML into a DOM tree.
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        // If this is a bunch of nodes, return the whole DIV.
        const dom = ( tmp.childNodes.length === 1 ? tmp.firstChild : tmp );
        // We create a pretend component to host the HTML.
        const vdom = {
            isIVdom: true,
            obs: staticHtmlObs,
            subscription: staticHtmlSubs,
            dom: dom
        } as IVdom;
        return vdom;
    };

    // Take a DOM subtree directly.
    // Note: this vDOM node can, like DOM nodes, only appear
    // in one place in the resulting DOM!  If you need copies,
    // you need duplicate fromDom instances.
    export const fromDom = (dom: Node): IVdom => {
        // We create a pretend component to host the HTML.
        const vdom = {
            isIVdom: true,
            obs: staticHtmlObs,
            subscription: staticHtmlSubs,
            dom: dom
        } as IVdom;
        return vdom;
    };

    // Bind a vDOM node to a DOM node.  For example,
    // Od.bind(myVdom, document.body.getElementById("foo"));
    // This will either update or replace the DOM node in question.
    export const bind = (vdom: Vdom, dom: Node): Node => {
        const domParent = dom.parentNode;
        const node = patchDom(vdom, dom, domParent);
        return node;
    };

    // Bind a vDOM node to a DOM node as new child.  For example,
    // Od.appendChild(myVdom, document.body);
    export const appendChild = (vdom: Vdom, domParent: Node): Node => {
        const dom = null as Node;
        const node = patchDom(vdom, dom, domParent);
        return node;
    };

    // Dispose of a component, removing any observable dependencies
    // it may have.
    export const dispose = (vdom: IVdom): void => {
        if (!vdom) return;
        if (vdom.obs) {
            Obs.dispose(vdom.obs);
            vdom.obs = null;
        }
        if (vdom.subscription) {
            Obs.dispose(vdom.subscription);
            vdom.subscription = null;
        }
        if (vdom.dom) {
            lifecycleHooks("removed", vdom.dom);
            enqueueNodeForStripping(vdom.dom);
            vdom.dom = null;
        }
        if (vdom.subcomponents) {
            disposeSubcomponents(vdom.subcomponents);
            vdom.subcomponents = null;
        }
    };

    const disposeSubcomponents = (subcomponents: ISubComponents): void => {
        for (var name in subcomponents) {
            const subcomponent = subcomponents[name];
            if (name === "") {
                // These are anonymous subcomponents, kept in an list.
                (subcomponent as IVdom[]).forEach(dispose);
            } else {
                dispose(subcomponent as IVdom);
            }
        }
    };

    // Normally, component updates will be batched via requestAnimationFrame
    // (i.e., they will occur at most once per display frame).  Setting this
    // to false ensures updates happen eagerly (i.e., they will not be
    // deferred).
    export var deferComponentUpdates = true;

    // ---- Implementation detail. ----

    const isArray = (x: any): boolean => x instanceof Array;
    const isNully = (x: any): boolean => x == null;

    // Components need to track their immediate sub-components
    // for two reasons: one, so named components can have
    // persistence (i.e., a named component is reused, never
    // recreated); two, so components can implement a sensible
    // disposal strategy.
    export interface ISubComponents { [name: string]: (IVdom | IVdom[]) }

    export interface IVdom {

        // One of us.
        isIVdom: boolean;

        // For text nodes.
        text?: string;

        // For non-text nodes.
        tag?: string; // This MUST be in upper case!
        props?: IProps;
        children?: Vdom[];

        // For component ("dynamic") nodes.
        obs?: Obs.IObservable<Vdom>;
        subscription?: Obs.ISubscription;
        subcomponents?: ISubComponents;
        dom?: Node;

    }

    export const patchDom =
    (vdomOrString: Vdom, dom: Node, domParent?: Node): Node => {
        const vdom =
            ( typeof (vdomOrString) === "string"
            ? text(vdomOrString as string)
            : vdomOrString as IVdom
            );
        if (vdom.tag) return patchElement(vdom, dom, domParent);
        if (vdom.obs) return patchComponent(vdom, dom, domParent);
        return patchText(vdom, dom, domParent);
    };

    const patchText =
    (vdom: IVdom, dom: Node, domParent?: Node): Node => {
        const newText = vdom.text;
        const newDom =
            ( !dom || dom.nodeName !== "#text"
            ? document.createTextNode(newText)
            : dom
            );
        if (newDom.nodeValue !== newText) newDom.nodeValue = newText;
        replaceNode(newDom, dom, domParent);
        return newDom;
    };

    const patchComponent =
    (component: IVdom, dom: Node, domParent?: Node): Node => {
        // The rule is: the DOM node in the component is always up-to-date
        // with respect to the underlying observable.
        //
        // When patching, therefore, there are the following possibilities:
        //
        // (1) The component's DOM node is the same as the node to be patched
        // and nothing needs to be done.
        //
        // (2) The node to be patched is null, in which case we append the
        // component's DOM node to the patch parent node.
        //
        // (3) The node to be patched is different, in which case we replace
        // it with the component's DOM node.
        const newDom = component.dom;
        if (newDom !== dom) replaceNode(newDom, dom, domParent);
        return newDom;
    };

    const patchElement =
    (vdom: IVdom, dom: Node, domParent?: Node): Node => {
        const tag = vdom.tag;
        const vdomProps = vdom.props;
        const vdomChildren = vdom.children;
        const elt = dom as HTMLElement;
        const newElt =
            ( !elt || elt.tagName !== tag || domBelongsToComponent(elt)
            ? document.createElement(tag)
            : elt
            );
        if (newElt !== elt) trace("  Created", tag);
        patchProps(newElt, vdomProps);
        patchChildren(newElt, vdomChildren);
        replaceNode(newElt, dom, domParent);
        return newElt;
    };

    const patchProps =
    (elt: HTMLElement, newProps: IProps): void => {
        const oldProps = getEltOdProps(elt);
        if (newProps) for (var prop in newProps) if (prop !== "style")
            setDomProp(elt, prop, newProps[prop]);
        if (oldProps) for (var prop in oldProps) if (!(prop in newProps))
            removeDomProp(elt, prop);
        // Style properties are special.
        const eltStyleProps = oldProps && oldProps["style"];
        const vdomStyleProps = newProps && newProps["style"];
        patchStyleProps(elt, eltStyleProps, vdomStyleProps);
        setEltOdProps(elt, newProps);
    };

    const patchStyleProps =
    (elt: HTMLElement, oldStyleProps: IProps, newStyleProps: IProps): void => {
        if (typeof (newStyleProps) === "string") {
            (elt as any).style = newStyleProps;
            return;
        }
        if (!newStyleProps) {
            // Don't reset all style properties unless there were some before.
            if (oldStyleProps) elt.style = null;
            return;
        }
        const eltStyle = elt.style as IProps;
        for (var prop in newStyleProps) eltStyle[prop] = newStyleProps[prop];
        if (!oldStyleProps) return;
        for (var prop in oldStyleProps) if (!(prop in newStyleProps))
            eltStyle[prop] = null;
    };

    const removeDomProp = (dom: Node, prop: string): void => {
        (dom as any)[prop] = null;
        if (dom instanceof HTMLElement) dom.removeAttribute(prop);
    };

    const setDomProp = (dom: Node, prop: string, value: any): void => {
        if (prop === "class") prop = "className"; // This is convenient.
        (dom as any)[prop] = value;
    };

    const patchChildren =
    (elt: HTMLElement, vdomChildren: Vdom[]): void => {
        if (!vdomChildren) vdomChildren = [];
        if ((elt as any).keyed) reorderKeyedChildren(vdomChildren, elt);
        var eltChild = elt.firstChild;
        const numVdomChildren = vdomChildren.length;
        // Patch or add the number of required children.
        for (var i = 0; i < numVdomChildren; i++) {
            trace("Patching child", i + 1);
            const vdomChild = vdomChildren[i];
            const nextChild = patchDom(vdomChild, eltChild, elt).nextSibling;
            eltChild = nextChild;
            trace("Patched child", i + 1);
        }
        // Remove any extraneous children.
        while (eltChild) {
            const nextSibling = eltChild.nextSibling;
            replaceNode(null, eltChild, elt);
            eltChild = nextSibling;
            trace("Removed child", ++i);
        }
    };

    // A common vDOM optimisation for supporting lists is to associate
    // each list item with a key property.  Keyed child nodes are reordered
    // to suit the vDOM before patching.  This can dramatically reduce
    // DOM node creation when, say, the list order changes or an item
    // is removed.  In Od we further insist that the parent element have
    // the property 'keyed: true'.
    const reorderKeyedChildren =
    (vdomChildren: Vdom[], dom: Node): void => {

        trace("  Reordering keyed children.");

        const vChildren = vdomChildren as IVdom[]; // This is safe.
        const domFirstChild = dom.firstChild;
        const numVChildren = vChildren.length;
        if (numVChildren === 0 || !domFirstChild) return;

        // Construct a mapping from keys to DOM nodes.
        const keyToDom = {} as { [key: string]: Node };
        for (var domI = dom.firstChild; domI; domI = domI.nextSibling) {
            const keyI = (domI as any).key;
            if (isNully(keyI)) return; // We insist that all children have keys.
            keyToDom[keyI] = domI;
        }

        // Reorder the DOM nodes to match the vDOM order, unless
        // we need to insert a new node.
        var domI = dom.firstChild;
        for (var i = 0; i < numVChildren; i++) {
            var vdomI = vChildren[i];
            var vTagI = vdomI.tag;
            if (isNully(vTagI) && vdomI.dom) vTagI = vdomI.dom.nodeName;
            if (!vTagI) return; // This only works for ordinary elements.
            const vKeyI = vdomPropsKey(vdomI.props);
            if (isNully(vKeyI)) return;
            const dKeyI = domI && (domI as any).key;
            const domVKeyI = keyToDom[vKeyI];
            if (domI) {
                if (dKeyI === vKeyI) {
                    domI = domI.nextSibling;
                } else if (domVKeyI) {
                    dom.insertBefore(domVKeyI, domI);
                } else {
                    dom.insertBefore(document.createElement(vTagI), domI);
                }
            } else if (domVKeyI) {
                dom.appendChild(domVKeyI);
            } else {
                dom.appendChild(document.createElement(vTagI));
            }
        }
    };

    // This is used for the static HTML constructors to pretend they're
    // derived from observables.

    const staticHtmlObs = Obs.of(null as IVdom);
    const staticHtmlSubs = null as Obs.ISubscription;

    // This is always of even length and consists of consecutive
    // property-name (string) property-value (any) pairs, in ascending
    // property-name order.  The reason for this is it allows us to
    // do property patching in O(n) time.
    export type PropAssocList = any[];

    const propsToPropAssocList = (props: IProps): PropAssocList => {
        if (!props) return null;
        const propAssocList = [] as PropAssocList;
        var keys = Object.keys(props).sort();
        var iTop = keys.length;
        for (var i = 0; i < iTop; i++) {
            const key = keys[i];
            propAssocList.push(key, props[key]);
        }
        return propAssocList;
    };

    type PropList = string[];

    const emptyPropList = [] as PropList;

    // We attach lists of (ordered) property names to elements so we can
    // perform property updates in O(n) time.

    const getEltOdProps = (elt: Node): IProps =>
        (elt as any).__Od__props;

    const setEltOdProps = (elt: Node, props: IProps): void => {
        (elt as any).__Od__props = props;
    };

    const vdomPropsKey = (props: IProps): string =>
        props && props["key"];

    const getDomComponent = (dom: Node): IVdom =>
        (dom as any).__Od__component;

    const setDomComponent = (dom: Node, component: IVdom): void => {
        if (dom) (dom as any).__Od__component = component;
    };

    const domBelongsToComponent = (dom: Node): boolean =>
        !!getDomComponent(dom);

    function updateComponent(): void {
        const component = this as IVdom;
        // If the component has anonymous subcomponents, we should dispose
        // of them now -- they will be recreated if needed.  Named
        // subcomponents will persist.
        disposeAnonymousSubcomponents(component);
        const dom = component.dom;
        // If a DOM node is already associated with the component, we
        // can defer the patching operation (which is nicer for the
        // web browser).
        if (dom) {
            enqueueComponentForPatching(component);
            return;
        }
        // Otherwise we have to establish the association up front.
        const vdom = component.obs();
        const domParent = dom && dom.parentNode;
        setDomComponent(dom, null);
        const newDom = patchDom(vdom, dom, domParent);
        setDomComponent(newDom, component);
        component.dom = newDom;
        lifecycleHooks(dom ? "updated" : "created", newDom);
    }

    const disposeAnonymousSubcomponents = (vdom: IVdom): void => {
        const anonymousSubcomponents =
            vdom.subcomponents && vdom.subcomponents[""] as IVdom[];
        if (!anonymousSubcomponents) return;
        anonymousSubcomponents.forEach(dispose);
        vdom.subcomponents[""] = null;
    };

    // We defer DOM updates using requestAnimationFrame.  It's better to
    // batch DOM updates where possible.

    const requestAnimationFrameSubstitute = (callback: () => void): number => {
        return setTimeout(callback, 16); // 16 ms = 1/60 s.
    };

    const requestAnimationFrame =
        window.requestAnimationFrame || requestAnimationFrameSubstitute;

    var componentsAwaitingUpdate = [] as IVdom[];

    var requestAnimationFrameID = 0;

    const enqueueComponentForPatching = (component: IVdom): void => {
        if (!deferComponentUpdates) {
            patchUpdatedComponent(component);
            return;
        }
        componentsAwaitingUpdate.push(component);
        if (requestAnimationFrameID) return;
        requestAnimationFrameID = requestAnimationFrame(patchQueuedComponents);
    };

    const patchQueuedComponents = (): void => {
        // Ensure we don't patch the same component twice, should it have
        // been updated more than once.
        const patchedComponents = {} as { [id: number]: boolean };
        const iTop = componentsAwaitingUpdate.length;
        for (var i = 0; i < iTop; i++) {
            const component = componentsAwaitingUpdate[i];
            const id = component.obs.obsid;
            if (patchedComponents[id]) continue;
            trace("Patching queued component #", id);
            patchUpdatedComponent(component);
            patchedComponents[id] = true;
        }
        // Clear the queue.
        componentsAwaitingUpdate = [];
        // Tell enqueueComponentForPatching that it needs to make a
        // new RAF request on the next update.
        requestAnimationFrameID = 0;
    };

    const patchUpdatedComponent = (component: IVdom): void => {
        const vdom = component.obs();
        const dom = component.dom;
        const domParent = dom && dom.parentNode;
        if (domWillBeReplaced(vdom, dom)) {
            // Component DOM nodes don't get stripped by default.
            setDomComponent(dom, null);
            enqueueNodeForStripping(dom);
        } else {
            // Component DOM nodes don't get patched by default.
            setDomComponent(dom, null);
        }
        const newDom = patchDom(vdom, dom, domParent);
        setDomComponent(newDom, component);
        lifecycleHooks("updated", newDom);
        component.dom = newDom;
    };

    // A DOM node will be replaced by a new DOM structure if it
    // cannot be adjusted to match the corresponding vDOM node.
    const domWillBeReplaced = (vdom: Vdom, dom: Node): boolean => {
        if (!dom) return false;
        if (typeof (vdom) === "string") return dom.nodeType !== Node.TEXT_NODE;
        return (dom as HTMLElement).nodeName !== (vdom as IVdom).tag;
    }

    // We track DOM nodes we've discarded so we can clean them up, remove
    // dangling event handlers and that sort of thing.  We do this in
    // the background to reduce the time between patching the DOM and
    // handing control back to the browser so it can re-paint.

    const nodesPendingStripping = [] as Node[];

    const enqueueNodeForStripping = (dom: Node): void => {
        if (!dom) return;
        if (domBelongsToComponent(dom)) return; // Can't touch this!
        trace("  Discarded", dom.nodeName || "#text");
        nodesPendingStripping.push(dom);
        if (stripNodesID) return;
        stripNodesID = setTimeout(stripNodes, 100);
    };

    var stripNodesID = 0;

    const stripNodes = (): void => {
        var dom = nodesPendingStripping.pop();
        while (dom) {
            stripNode(dom);
            var dom = nodesPendingStripping.pop();
        }
    };

    const stripNode = (dom: Node): void => {
        // We don't want to strip anything owned by a sub-component.
        if (domBelongsToComponent(dom)) return; // Can't touch this!
        // Strip any properties...
        const props = getEltOdProps(dom);
        for (var prop in props) (dom as any)[prop] = null;
        // Recursively strip any child nodes.
        const children = dom.childNodes;
        const numChildren = children.length;
        for (var i = 0; i < numChildren; i++) stripNode(children[i]);
    };

    // Decide how a DOM node should be replaced.
    const replaceNode =
    (newDom: Node, oldDom: Node, domParent?: Node): void => {
        if (!newDom) {
            if (!oldDom) return;
            enqueueNodeForStripping(oldDom);
            if (domParent) domParent.removeChild(oldDom);
        } else {
            if (!oldDom) {
                trace("  Inserted", newDom.nodeName || "#text");
                if (domParent) domParent.appendChild(newDom);
            } else {
                if (newDom === oldDom) return;
                enqueueNodeForStripping(oldDom);
                if (!domParent) return;
                trace("  Inserted", newDom.nodeName || "#text");
                if (domParent) domParent.replaceChild(newDom, oldDom);
            }
        }
    };

    // Some component nodes will have life-cycle hooks to call.
    const lifecycleHooks = (what: string, dom: Node): void => {
        const props = dom && getEltOdProps(dom);
        const hook = props && props["onodevent"];
        if (!hook) return;
        switch (what) {
            case "created": pendingOnCreatedNodes.push(dom); break;
            case "updated": pendingOnUpdatedNodes.push(dom); break;
            case "removed": pendingOnRemovedNodes.push(dom); break;
        }
        if (pendingOdEventsID) return;
        pendingOdEventsID = setTimeout(processPendingOdEvents, 0);
    };

    var pendingOdEventsID = 0;
    const pendingOnCreatedNodes = [] as Node[];
    const pendingOnUpdatedNodes = [] as Node[];
    const pendingOnRemovedNodes = [] as Node[];

    // We process Od lifecycle events after the DOM has had a chance to
    // rearrange itself.
    const processPendingOdEvents = (): void => {
        var node: Node;
        while (node = pendingOnCreatedNodes.pop()) {
            (node as any).onodevent("created", node);
        }
        while (node = pendingOnUpdatedNodes.pop()) {
            (node as any).onodevent("updated", node);
        }
        while (node = pendingOnRemovedNodes.pop()) {
            (node as any).onodevent("removed", node);
        }
        pendingOdEventsID = 0;
    };

    // Debugging.
    const trace: any = function() {
        if (!debug) return;
        if (!window.console || !window.console.log) return;
        console.log.apply(console, arguments);
    }
}