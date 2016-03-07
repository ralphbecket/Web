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
// Every "active" DOM subtree (i.e., something that can change as the
// application runs) is managed via an observable whose value is a vDOM
// subtree.  When the observable changes, the patching algorithm is only
// applied to the affected DOM subtree.
//
// This mechanism is general: "components" are just observables, like any
// other managed part of the DOM/vDOM relationship.
//
//
//
// Credit where it's due: the following efforts have been inspirational and,
// in many cases, of enormous practical benefit: Knockout, Mithril, Inferno,
// and React.  I'd also like to mention the reactive school, but in the end
// I find the observables-based approach more natural.  For today, at least.
//
module Od {

    const debug = true;

    // Public interface.

    export interface IVdom { }

    export type Vdom = string | IVdom;

    export const text = (text: string): IVdom =>
        ({ text: isNully(text) ? "" : text.toString() });

    interface IProps { [prop: string]: any };

    type VdomChildren = Vdom | Vdom[];

    // Construct a vDOM node.
    export const element =
    (tag: string, props?: IProps, childOrChildren?: VdomChildren): IVdom => {
        tag = tag.toUpperCase();
        const propAssocList = propsToPropAssocList(props);
        const children =
            ( !childOrChildren
            ? null
            : isArray(childOrChildren)
            ? childOrChildren
            : [childOrChildren]
            ) as Vdom[];
        return { tag: tag, props: propAssocList, children: children };
    };

    // Construct a component node from a function computing a vDOM node.
    export const component = (fn: () => Vdom): IVdom => {
        const obs =
            ( Obs.isObservable(fn)
            ? fn as Obs.IObservable<Vdom>
            : Obs.fn(fn)
            );
        const vdom = { obs: obs, subs: null, dom: null } as IVdom;
        const subs = Obs.subscribe([obs], updateComponent.bind(vdom));
        vdom.subs = subs;
        subs(); // Initialise the dom component.
        return vdom;
    };

    // Bind a vDOM node to a DOM node.  For example,
    // Od.bind(myVdom, document.body.getElementById("foo"));
    export const bind = (vdom: Vdom, dom: Node): void => {
        const domParent = dom.parentNode;
        patchDom(vdom, dom, domParent);
    };

    // Bind a vDOM node to a DOM node as new child.  For example,
    // Od.appendChild(myVdom, document.body);
    export const appendChild = (vdom: Vdom, domParent: Node): void => {
        const dom = null as Node;
        patchDom(vdom, dom, domParent);
    };

    // Normally, component updates will be batched via requestAnimationFrame
    // (i.e., they will occur at most once per display frame).  Setting this
    // to false ensures updates happen eagerly (i.e., they will not be
    // deferred).
    export var deferComponentUpdates = true;

    // Implementation detail.

    const isArray = (x: any): boolean => x instanceof Array;
    const isNully = (x: any): boolean => x === null || x === undefined;

    // This is always of even length and consists of consecutive
    // property-name (string) property-value (any) pairs, in ascending
    // property-name order.  The reason for this is it allows us to
    // do property patching in O(n) time.
    type PropAssocList = any[];

    const emptyPropDict = [] as PropAssocList;

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

    export interface IVdom {

        // For text nodes.
        text?: string;

        // For non-text nodes.
        tag?: string; // This MUST be in upper case!
        props?: PropAssocList;
        children?: Vdom[];

        // For "active" nodes.
        obs?: Obs.IObservable<Vdom>
        subs?: Obs.ISubscription;
        dom?: Node;

    };

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
        if (newDom.textContent !== newText) newDom.textContent = newText;
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
        const vdomPropDict = vdom.props;
        const vdomChildren = vdom.children;
        const elt = dom as HTMLElement;
        const newElt =
            ( !elt || elt.tagName !== tag || domBelongsToComponent(elt)
            ? document.createElement(tag)
            : elt
            );
        if (newElt !== elt) trace("  Created", tag);
        patchProps(newElt, vdomPropDict);
        patchChildren(newElt, vdomChildren);
        replaceNode(newElt, dom, domParent);
        return newElt;
    };

    type PropList = string[];

    const emptyPropList = [] as PropList;

    // We attach lists of (ordered) property names to elements so we can
    // perform property updates in O(n) time.

    const getEltPropList = (elt: Node): PropList =>
        (elt as any).__Od__props;

    const setEltPropList = (elt: Node, propList: PropList): void => {
        (elt as any).__Od__props = propList;
    };

    // We perform an ordered traversal of the old properties of the element
    // (if any) and the new properties, deleting, updating, and adding as
    // required.
    const patchProps =
    (elt: HTMLElement, vdomPropDict: PropAssocList): void => {
        var eltPropList = getEltPropList(elt);
        if (!vdomPropDict && !eltPropList) return;
        if (!eltPropList) eltPropList = emptyPropList;
        if (!vdomPropDict) vdomPropDict = emptyPropDict;
        var iElt = 0;
        var iVdom = 0;
        var iEltTop = eltPropList.length;
        var iVdomTop = vdomPropDict.length;
        const newEltPropList = [] as string[];
        // Clear out any old properties that aren't replaced.
        // Update any changed properties.
        // Add any new properties.
        while (iElt < iEltTop && iVdom < iVdomTop) {
            const eltProp = eltPropList[iElt];
            const vdomProp = vdomPropDict[iVdom];
            if (eltProp < vdomProp) {
                removeDomProp(elt, eltProp);
                iElt += 1;
            } else {
                const vdomPropValue = vdomPropDict[iVdom + 1];
                setDomProp(elt, vdomProp, vdomPropValue, newEltPropList);
                iVdom += 2;
                iElt += (eltProp === vdomProp ? 1 : 0);
            }
        }
        while (iElt < iEltTop) {
            const eltProp = eltPropList[iElt];
            removeDomProp(elt, eltProp);
            iElt += 1;
        }
        while (iVdom < iVdomTop) {
            const vdomProp = vdomPropDict[iVdom];
            const vdomPropValue = vdomPropDict[iVdom + 1];
            setDomProp(elt, vdomProp, vdomPropValue, newEltPropList);
            iVdom += 2;
        }
        // Update the property list for the element so we can update it
        // correctly next time we visit it.
        setEltPropList(elt, newEltPropList);
    };

    // XXX We can put special property handling here (e.g., 'className' vs
    // 'class', and 'style' etc.)

    const removeDomProp =
    (dom: Node, prop: string): void => {
        (dom as any)[prop] = undefined;
        if (dom instanceof HTMLElement) dom.removeAttribute(prop);
    };

    const setDomProp =
    (dom: Node, prop: string, value: any, propList: PropList): void => {
        (dom as any)[prop] = value;
        propList.push(prop);
    };

    const emptyIVdomList = [] as IVdom[];

    const patchChildren =
    (elt: HTMLElement, vdomChildren: Vdom[]): void => {
        const eltChildren = elt.childNodes;
        if (!vdomChildren) vdomChildren = emptyIVdomList;
        const numEltChildren = eltChildren.length;
        const numVdomChildren = vdomChildren.length;
        // Remove any extraneous existing children.
        // We do this first, and backwards, because removing a child node
        // changes the indices of any succeeding children.
        for (var i = numEltChildren - 1; numVdomChildren <= i; i--) {
            const eltChild = eltChildren[i];
            replaceNode(null, eltChild, elt);
            trace("Removed child", i + 1);
        }
        // Patch or add the number of required children.
        for (var i = 0; i < numVdomChildren; i++) {
            trace("Patching child", i + 1);
            const vdomChild = vdomChildren[i];
            const eltChild = eltChildren[i];
            patchDom(vdomChild, eltChild, elt);
            trace("Patched child", i + 1);
        }
    };

    const getDomComponent = (dom: Node): IVdom =>
        (dom as any).__Od__component;

    const setDomComponent = (dom: Node, component: IVdom): void => {
        if (dom) (dom as any).__Od__component = component;
    };

    const domBelongsToComponent = (dom: Node): boolean =>
        !!getDomComponent(dom);

    function updateComponent(): void {
        const component = this as IVdom;
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
    }

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
            const id = component.obs.id;
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
        const props = getEltPropList(dom) || [];
        const numProps = props.length;
        for (var i = 0; i < numProps; i++) (dom as any)[props[i]] = undefined;
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

    // Debugging.

    const trace: any = function() {
        if (!debug) return;
        if (!window.console || !window.console.log) return;
        console.log.apply(console, arguments);
    }
}