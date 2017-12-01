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
//
//
// Experiment, 2016-07-24: closures, not structures.
//
// I've been thinking on remarks made by J.A.Forbes on the Mithril discussion
// list (https://gitter.im/lhorie/mithril.js).  The initial version of Od
// had functions to construct vDOM structures, which would then be traversed
// by the patching function to update the DOM.  It occurs to me that we could
// profitably cut out a step here by simply making vDOM structures patching
// functions in their own right.  I'm going to try that experiment now.
//
// The experiment was a success!
//
/// <reference path="./Obs.ts"/>

namespace Od {

    const debug = false;

    // ---- Public interface. ----

    // A vDOM node is just a patching function with an optional ordering key.
    export type Vdom = number | string | VdomPatcher;

    export interface VdomArray extends Array<Vdoms> {}

    export type Vdoms = Vdom | VdomArray;

    export interface VdomPatcher {
        (dom: Node, parent: Node): Node;
        key?: string | number; // For the keyed-children optimisation.
        dispose?: () => void; // For components.
    }

    // Lifecycle events on components are
    // "created" when the component is created,
    // "attached" when the component is attached to the document.body,
    // "updated" when the component is patched, 
    // "removed" when the component is about to be stripped, and
    // "disposed" when the component is about to be disposed.
    //
    // "attached" events are run bottom-up in the sense that the Od-event
    // handlers of a parent node's children will receive the "attached"
    // event before the parent node itself.
    export type LifecycleFn = (what: string, dom: Node) => void;

    export const flattenVdoms = (xs: Vdoms): Vdom[] => {
        if (xs == null) return null;
        if (!(xs instanceof Array)) return [xs as Vdom];
        // Otherwise xs should be an array.
        const ys = xs as any[];
        const n = ys.length;
        var hasNestedArray = false;
        for (var i = 0; i < n; i++) {
            if (!(ys[i] instanceof Array)) continue;
            hasNestedArray = true;
            break;
        }
        if (!hasNestedArray) return xs as Vdom[];
        // The array is inhomogeneous.  Let's flatten it.
        const zs = [] as Vdom[];
        flattenNestedVdoms(xs as any[], zs);
        return zs;
    };

    const flattenNestedVdoms = (xs: any[], zs: Vdom[]): void => {
        const n = xs.length;
        for (var i = 0; i < n; i++) {
            var x = xs[i];
            if (x instanceof Array) flattenNestedVdoms(x, zs); else zs.push(x);
        }
    };

    // Properties are used to set attributes, event handlers, and so forth.
    // There are two special property names: "class" is allowed as a synonym
    // for "className"; and "style" can be either a string of the form
    // "color: red; width: 2em;" or an object of the form { color: "red",
    // width: "2em" }.
    export interface Props { [prop: string]: any };

    // We don't have a special representation for text nodes, we simply
    // represent them as strings or numbers.
    const patchText =
        (content: number | string, dom: Node, parent: Node): Node => {
            var txt = (content == null ? null : content.toString());
            if (dom == null || dom.nodeName !== "#text" || isComponentDom(dom)) {
                const newDom = document.createTextNode(txt);
                patchNode(newDom, dom, parent);
                return newDom;
            }
            if (dom.nodeValue !== txt) dom.nodeValue = txt;
            return dom;
        };

    // Patch from an arbitrary Vdom node.
    const patchFromVdom = (vdom: Vdom, dom: Node, parent: Node): Node => {
        return (vdom instanceof Function
            ? (vdom as VdomPatcher)(dom, parent)
            : patchText(vdom as string, dom, parent)
        );
    };

    // Create an element node.
    export const element =
    (tag: string, props?: Props, children?: Vdoms): Vdom => {

        tag = tag.toUpperCase();
        const vchildren = flattenVdoms(children);

        const vdom: Vdom = (dom, parent) => {
            const elt = dom as HTMLElement;
            const newDom =
                ( (dom == null || elt.tagName !== tag || isComponentDom(dom))
                ? document.createElement(tag)
                : elt
                );
            patchNode(newDom, dom, parent);
            patchProps(newDom, props);
            patchChildren(newDom, vchildren);
            handleElementLifecycleFn(props, newDom, dom);
            return newDom;
        };

        // Special-handling of 'keyed' nodes.
        const key = props && props["key"];
        if (key != null) (vdom as VdomPatcher).key = key;

        // Special-handling of 'Od event handler' nodes.
        if (odEventHandler(props) != null && parentComponentInfo != null) {
            parentComponentInfo.hasOdEventHandlers = true;
        }

        return vdom;
    };

    const odEventHandler = (x: any): any => x && x["onodevent"];

    const handleElementLifecycleFn =
    (props: Props, newDom: Node, oldDom: Node) => {
        const lifecycleFn = odEventHandler(props);
        if (lifecycleFn == null) return;
        if (newDom !== oldDom) {
            pendingCreatedEventCallbacks.push(newDom);
            return;
        }
        pendingUpdatedEventCallbacks.push(newDom);
    };

    // Patch a DOM node.
    // Do nothing if the replacement is identical.
    // Otherwise enqueue the old node for stripping.
    // Replace the old node or add the new node as a child accordingly.
    const patchNode = (newDom: Node, oldDom: Node, parent: Node): void => {
        if (newDom === oldDom) return;
        enqueueNodeForStripping(oldDom);
        if (parent == null) return;
        if (newDom == null) {
            if (oldDom == null) return;
            parent.removeChild(oldDom);
            const cmptInfo = domComponentInfo(oldDom);
            //if (cmptInfo && cmptInfo.isAttached) propagateAttachmentDown(oldDom, false);
            updateIsAttached(cmptInfo, false);
        }
        else if (oldDom == null) {
            parent.appendChild(newDom);
        }
        else {
            parent.replaceChild(newDom, oldDom);
            const cmptInfo = domComponentInfo(oldDom);
            //if (cmptInfo && cmptInfo.isAttached) propagateAttachmentDown(oldDom, false);
            updateIsAttached(cmptInfo, false);
        }
    };

    // A DOM node corresponding to the root of a component has an
    // __Od__componentInfo property with a non-zero value.
    //
    const isComponentDom = (dom: Node): boolean =>
        domComponentInfo(dom) != null;

    const domComponentInfo = (dom: Node): ComponentInfo =>
        (dom as any).__Od__componentInfo;

    const setDomComponentInfo = (dom: Node, cmptInfo: ComponentInfo): void => {
        if (domComponentInfo(dom) == null) (dom as any).__Od__componentInfo = cmptInfo;
    };

    const clearDomComponentInfo = (dom: Node): void => {
        (dom as any).__Od__componentInfo = null;
    };

    export type ComponentName = string | number;

    interface ComponentInfo {
        name: ComponentName;
        componentID: number;
        dom: Node;
        isAttached: boolean; // Trye iff the node is attached to document.body.
        obs: Obs.Observable<Vdom>;
        subs: Obs.Subscription;
        anonymousSubcomponents: Vdom[];
        namedSubcomponents: { [name: string]: Vdom };
        hasOdEventHandlers: boolean;
        updateIsPending: boolean;
    }

    var nextComponentID = 1; // Name supply.

    var parentComponentInfo = null as ComponentInfo; // Used for scoping.

    const existingNamedComponent = (name: ComponentName): Vdom =>
        (name != null && parentComponentInfo != null
            ? parentComponentInfo.namedSubcomponents[name as string] as Vdom
            : null
        );

    // Normally, component updates will be batched via requestAnimationFrame
    // (i.e., they will occur at most once per display frame).  Setting this
    // to false ensures updates happen eagerly (i.e., they will not be
    // deferred).
    export var deferComponentUpdates = true;

    // Create a component, which represents a DOM subtree that updates
    // entirely independently of all other components.
    //
    // A named component persists within the scope of the component within
    // which it is defined.  That is, the immediate parent component can
    // be re-evaluated, but any named child components will persist from
    // the original construction of the parent, rather than being
    // recreated.  Names need only be unique within the scope of the
    // immediate parent component.
    //
    // Passing a null name creates an anonymous component, which will be
    // re-created every time the parent component updates.  Typically you
    // do not want this!

    export const component =
        (name: ComponentName, fn: () => Vdom): Vdom => {
            // If this component already exists in this scope, return that.
            const existingCmpt = existingNamedComponent(name);
            if (existingCmpt != null) return existingCmpt;
            // Okay, we need to create a new component.
            const cmptID = nextComponentID++;
            // console.log("Creating component", name, cmptID);
            const cmptInfo = {
                name: name,
                componentID: cmptID,
                dom: null as Node,
                isAttached: false,
                obs: null as Obs.Observable<Vdom>,
                subs: null as Obs.Subscription,
                anonymousSubcomponents: [] as Vdom[],
                namedSubcomponents: {} as { [name: string]: Vdom },
                hasOdEventHandlers: false,
                updateIsPending: false
            };
            // A component, like any vDOM, is a patching function.
            const cmpt: VdomPatcher = (dom: Node, parent: Node) => {
                const cmptDom = cmptInfo.dom;
                patchNode(cmptDom, dom, parent);
                if (cmptDom !== dom && cmptInfo.hasOdEventHandlers) {
                    const isAttached =
                        ( parentComponentInfo != null
                        ? parentComponentInfo.isAttached
                        : domIsAttachedToBody(cmptDom)
                        );
                    updateIsAttached(cmptInfo, isAttached);
                    //if (isAttached != cmptInfo.isAttached) propagateAttachmentDown(cmptDom, isAttached);
                }
                return cmptDom;
            };
            // Register this component with the parent component (if any).
            if (parentComponentInfo != null) {
                if (name == null)
                    parentComponentInfo.anonymousSubcomponents.push(cmpt);
                else
                    parentComponentInfo.namedSubcomponents[name] = cmpt;
            }
            // Establish the observable in the context of this new component
            // so any sub-components will be registered with this component.
            const obs = Obs.fn(() => {
                // if (name !== "log") console.log("Updating component", name, cmptID);
                const oldParentComponentInfo = parentComponentInfo;
                parentComponentInfo = cmptInfo;
                disposeAnonymousSubcomponents(cmptInfo);
                const vdom = fn();
                parentComponentInfo = oldParentComponentInfo;
                return vdom;
            });
            // Create the initial DOM node for this component.
            // Peek here, because we don't want any parent component
            // acquiring a dependency on this component's private observable.
            const dom = patchFromVdom(Obs.peek(obs), null, null);
            // Check that we haven't been given another component's DOM subtree.
            if (domComponentInfo(dom) != null) throw new Error("Od components must have distinct root DOM nodes.");
            // Mark this DOM subtree as belonging to this component.
            setDomComponentInfo(dom, cmptInfo);
            // Fire off any creation events.
            runPendingOdEventCallbacks();
            // Set up the update subscription.
            const subs = Obs.subscribe([obs], () => {
                if (deferComponentUpdates) {
                    deferComponentUpdate(cmptInfo);
                }
                else {
                    updateComponent(cmptInfo);
                    runPendingOdEventCallbacks();
                }
            });
            // Set up the disposal method.
            cmpt.dispose = () => { disposeComponent(cmptInfo); };
            // Fill in the ComponentInfo.
            cmptInfo.dom = dom;
            cmptInfo.obs = obs;
            cmptInfo.subs = subs;
            // Set the key, if we have one.
            cmpt.key = (dom as any).key;
            // And we're done!
            return cmpt;
        }

    const updateComponent = (cmptInfo: ComponentInfo): void => {
        const oldParentComponentInfo = parentComponentInfo;
        parentComponentInfo = cmptInfo;
        const cmptID = cmptInfo.componentID;
        const dom = cmptInfo.dom;
        const obs = cmptInfo.obs;
        const parent = dom && dom.parentNode;
        clearDomComponentInfo(dom); // So patching will apply internally.
        const newDom = patchFromVdom(obs(), dom, parent);
        setDomComponentInfo(newDom, cmptInfo); // Restore DOM ownership.
        cmptInfo.dom = newDom;
        cmptInfo.updateIsPending = false;
        parentComponentInfo = oldParentComponentInfo;
    };

    const disposeComponent = (cmptInfo: ComponentInfo): void => {
        // console.log("Disposing component", cmptInfo.name, cmptInfo.componentID);
        disposeAnonymousSubcomponents(cmptInfo);
        disposeNamedSubcomponents(cmptInfo);
        Obs.dispose(cmptInfo.subs);
        Obs.dispose(cmptInfo.obs);
        const dom = cmptInfo.dom;
        const domRemove = dom && (dom as HTMLElement).remove;
        //if (domRemove != null) domRemove.call(dom);
        clearDomComponentInfo(dom);
        enqueueNodeForStripping(dom);
    };

    const disposeAnonymousSubcomponents = (cmptInfo: ComponentInfo): void => {
        const cmpts = cmptInfo.anonymousSubcomponents;
        for (var cmpt = cmpts.pop(); cmpt != null; cmpt = cmpts.pop()) {
            dispose(cmpt);
        }
    };

    const disposeNamedSubcomponents = (cmptInfo: ComponentInfo): void => {
        var cmpts = cmptInfo.namedSubcomponents;
        for (var name in cmpts) {
            const cmpt = cmpts[name];
            dispose(cmpt);
            cmpts[name] = null;
        }
    };

    // Note that disposing a component removes its DOM subtree from the
    // main DOM tree and enqueues its nodes for stripping.  Any elements
    // with onodevent handlers will receive "removed" events.
    export const dispose = (vdom: Vdom): void => {
        const dispose = vdom && (vdom as VdomPatcher).dispose;
        if (dispose != null) dispose();
    };

    const componentInfosPendingUpdate = [] as ComponentInfo[];

    var deferredComponentUpdatesID = 0;

    const deferComponentUpdate = (cmptInfo: ComponentInfo): void => {
        if (cmptInfo.updateIsPending) return;
        cmptInfo.updateIsPending = true;
        componentInfosPendingUpdate.push(cmptInfo);
        if (deferredComponentUpdatesID !== 0) return;
        deferredComponentUpdatesID = raf(
            updateDeferredComponents
        );
    };

    const updateDeferredComponents = (): void => {
        // console.log("Updating deferred components...");
        var cmptInfos = componentInfosPendingUpdate;
        for (
            var cmptInfo = cmptInfos.pop();
            cmptInfo != null;
            cmptInfo = cmptInfos.pop()
        ) {
            updateComponent(cmptInfo);
        }
        runPendingOdEventCallbacks();
        deferredComponentUpdatesID = 0;
        // console.log("Updating deferred components done.");
    };

    // Construct a static DOM subtree from an HTML string.
    export const fromHtml =
        (html: string): Vdom => {
            // First, turn the HTML into a DOM tree.
            const tmp = document.createElement("DIV");
            tmp.innerHTML = html;
            // If this is a bunch of nodes, return the whole DIV.
            const newDom = (tmp.childNodes.length === 1 ? tmp.firstChild : tmp);
            // Prevent this DOM subtree from being patched.
            setDomComponentInfo(newDom, {} as ComponentInfo);
            const vdom = (dom: Node, parent: Node) => {
                patchNode(newDom, dom, parent);
                return newDom;
            };
            return vdom;
        };

    // Take a DOM subtree directly.  The patching algorithm will not
    // touch the contents of this subtree.
    export const fromDom =
        (srcDom: Node): Vdom => {
            setDomComponentInfo(srcDom, {} as ComponentInfo);
            const vdom = (dom: Node, parent: Node) => {
                patchNode(srcDom, dom, parent);
                return srcDom;
            };
            return vdom;
        };

    // Bind a vDOM node to a DOM node.  For example,
    // Od.bind(myVdom, document.body.getElementById("foo"));
    // This will either update or replace the DOM node in question.
    export const bind = (vdom: Vdom, dom: Node): Node => {
        const domParent = dom && dom.parentNode;
        const newDom = patchFromVdom(vdom, dom, domParent);
        const isAttached = domIsAttachedToBody(dom);
        propagateAttachmentDown(newDom, isAttached);
        return newDom;
    };

    // Bind a vDOM node to a DOM node as new child.  For example,
    // Od.appendChild(myVdom, document.body);
    export const appendChild = (vdom: Vdom, parent: Node): Node => {
        const newDom = patchFromVdom(vdom, null, parent);
        const isAttached = domIsAttachedToBody(parent);
        propagateAttachmentDown(newDom, isAttached);
        return newDom;
    };

    const isArray = (x: any): boolean => x instanceof Array;

    const patchProps =
        (elt: HTMLElement, newProps: Props): void => {
            const oldProps = getEltOdProps(elt);
            if (newProps)
                for (var prop in newProps)
                    if (prop !== "style") setDomProp(elt, prop, newProps[prop]);
            if (oldProps)
                for (var prop in oldProps)
                    if (!newProps || !(prop in newProps)) removeDomProp(elt, prop);
            // Style properties are special.
            const eltStyleProps = oldProps && oldProps["style"];
            const vdomStyleProps = newProps && newProps["style"];
            patchStyleProps(elt, eltStyleProps, vdomStyleProps);
            const eltAttrProps = oldProps && oldProps["attrs"];
            const vdomAttrProps = newProps && newProps["attrs"];
            patchAttrProps(elt, eltAttrProps, vdomAttrProps);
            setEltOdProps(elt, newProps);
        };

    const patchStyleProps =
        (elt: HTMLElement, oldStyleProps: Props, newStyleProps: Props): void => {
            if (typeof (newStyleProps) === "string") {
                (elt as any).style = newStyleProps;
                return;
            }
            if (!newStyleProps) {
                // Don't reset all style properties unless there were some before.
                if (oldStyleProps) elt.removeAttribute("style");
                return;
            }
            const eltStyle = elt.style as Props;
            for (var prop in newStyleProps) eltStyle[prop] = newStyleProps[prop];
            if (!oldStyleProps) return;
            for (var prop in oldStyleProps) if (!(prop in newStyleProps))
                eltStyle[prop] = null;
        };

    const patchAttrProps =
        (elt: HTMLElement, oldAttrProps: Props, newAttrProps: Props): void => {
            if (newAttrProps) for (var attr in newAttrProps) {
                elt.setAttribute(attr, newAttrProps[attr]);
            }
            if (oldAttrProps) for (var attr in oldAttrProps) {
                if (newAttrProps && (attr in newAttrProps)) continue;
                elt.removeAttribute(attr);
            }
        };

    const getEltOdProps = (elt: Node): Props =>
        (elt as any).__Od__props;

    const setEltOdProps = (elt: Node, props: Props): void => {
        (elt as any).__Od__props = props;
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
        (parent: HTMLElement, vchildren: Vdom[]): void => {
            if (vchildren == null) vchildren = [];
            if ((parent as any).keyed) reorderKeyedChildren(vchildren, parent);
            var echild = parent.firstChild;
            const numVdomChildren = vchildren.length;
            // Patch or add the number of required children.
            for (var i = 0; i < numVdomChildren; i++) {
                const vchild = vchildren[i];
                const patchedEChild = patchFromVdom(vchild, echild, parent);
                echild = patchedEChild.nextSibling;
            }
            // Remove any extraneous children.
            while (echild) {
                const nextEChild = echild.nextSibling;
                patchNode(null, echild, parent);
                echild = nextEChild;
            }
        };

    // A common vDOM optimisation for supporting lists is to associate
    // each list item with a key property.  Keyed child nodes are reordered
    // to suit the vDOM before patching.  This can dramatically reduce
    // DOM node creation when, say, the list order changes or an item
    // is removed.  In Od we further insist that the parent element have
    // the property 'keyed: true'.
    const reorderKeyedChildren =
        (vchildren: Vdom[], parent: Node): void => {

            const firstChild = parent.firstChild;
            const numVChildren = vchildren.length;
            if (numVChildren === 0 || !firstChild) return;

            // Construct a mapping from keys to DOM nodes.
            const keyToChild = {} as { [key: string]: Node };
            for (var child = firstChild; child; child = child.nextSibling) {
                const key = (child as any).key;
                if (key == null) return; // We insist that all children have keys.
                keyToChild[key] = child;
            }

            // Reorder the DOM nodes to match the vDOM order, unless
            // we need to insert a new node.
            var child = firstChild;
            for (var i = 0; i < numVChildren; i++) {
                var vchild = vchildren[i];
                const vkey = (vchild as VdomPatcher).key;
                if (vkey == null) return;
                const ckey = child && (child as any).key;
                const requiredChild = keyToChild[vkey];
                if (child) {
                    if (ckey === vkey) {
                        child = child.nextSibling;
                    } else if (requiredChild) {
                        parent.insertBefore(requiredChild, child);
                    } else {
                        parent.insertBefore(document.createElement("DIV"), child);
                    }
                } else if (requiredChild) {
                    parent.appendChild(requiredChild);
                } else {
                    parent.appendChild(document.createElement("DIV"));
                }
            }
        };

    // We defer DOM updates using requestAnimationFrame.  It's better to
    // batch DOM updates where possible.

    const requestAnimationFrameSubstitute = (callback: () => void): number => {
        return setTimeout(callback, 16); // 16 ms = 1/60 s.
    };

    const raf = window.requestAnimationFrame || requestAnimationFrameSubstitute;

    // We track DOM nodes we've discarded so we can clean them up, remove
    // dangling event handlers and that sort of thing.  We do this in
    // the background to reduce the time between patching the DOM and
    // handing control back to the browser so it can re-paint.

    const nodesPendingStripping = [] as Node[];

    const enqueueNodeForStripping = (dom: Node): void => {
        if (!dom) return;
        const cmptInfo = domComponentInfo(dom);
        if (cmptInfo != null) {
            //if (cmptInfo.isAttached) propagateAttachmentDown(dom, false);
            updateIsAttached(cmptInfo, false);
            return; // Otherwise, we leave this alone: it belongs to the component.
        }
        nodesPendingStripping.push(dom);
        if (stripNodesID !== 0) return;
        stripNodesID = setTimeout(stripNodes, 0);
    };

    var stripNodesID = 0;

    const stripNodes = (): void => {
        const nodes = nodesPendingStripping;
        for (var dom = nodes.pop(); dom != null; dom = nodes.pop()) {
            stripNode(dom);
        }
        stripNodesID = 0;
    };

    const stripNode = (dom: Node): void => {
        // We don't want to strip anything owned by a component.
        if (dom == null) return;
        const cmptInfo = domComponentInfo(dom);
        if (cmptInfo != null) {
            // console.log("Not stripping component node:", dom, domComponentInfo(dom));
            //if (cmptInfo.hasOdEventHandlers && cmptInfo.isAttached) propagateAttachmentDown(dom, false);
            updateIsAttached(cmptInfo, false);
            return;
        }
        // Strip any properties...
        const props = getEltOdProps(dom);
        const lifecycleFn = odEventHandler(props);
        if (lifecycleFn) lifecycleFn("removed", dom);
        const anyDom = dom as any;
        for (var prop in props) if (prop !== "src" || anyDom.tagName !== "IMG") anyDom[prop] = null;
        // Recursively strip any child nodes.
        const children = dom.childNodes;
        const numChildren = children.length;
        for (var i = 0; i < numChildren; i++) stripNode(children[i]);
    };

    var runningPendingOdEvents = false;
    var pendingCreatedEventCallbacks = [] as Node[];
    var pendingUpdatedEventCallbacks = [] as Node[];

    const runPendingOdEventCallbacks = (): void => {
        // Guard against infinite loops!
        if (runningPendingOdEvents) return;
        runningPendingOdEvents = true;
        // XXX
        //setTimeout(
            //() => {
                runPendingCreatedEventCallbacks();
                runPendingUpdatedEventCallbacks();
                runningPendingOdEvents = false;
            //},
            //processPendingOdEventsDelay
        //);
    };

    const runPendingCreatedEventCallbacks = (): void => {
        for (var i = 0; i < pendingCreatedEventCallbacks.length; i++) {
            var dom = pendingCreatedEventCallbacks[i];
            var callback = (dom as any).onodevent;
            if (callback != null) callback("created", dom);
        }
        pendingCreatedEventCallbacks = [];
    };

    const runPendingUpdatedEventCallbacks = (): void => {
        for (var i = 0; i < pendingUpdatedEventCallbacks.length; i++) {
            var dom = pendingUpdatedEventCallbacks[i];
            var callback = (dom as any).onodevent;
            if (callback != null) callback("updated", dom);
        }
        pendingUpdatedEventCallbacks = [];
    };

    // We need to support an "attached" Od-event to indicate when a node
    // has been attached to the live DOM rooted at the document body.

    // To try to reduce the amount of work involved (and we assume these
    // Od event handlers will be rare), we use the following logic:
    // 
    // (1) When a DOM element with an onodevent handler is created, its parent
    // component is made aware of the situation.
    //
    // (2) Such a component, when patching and replacing its root DOM
    // element with another, will decide whether it has become attached to the
    // document.body or not.
    //
    // (3) If it is, the component traverses its entire DOM tree looking
    // for onodevent handlers, whereupon it will execute those handlers with
    // "attached" events.
    //
    // (4) This "attachment" data is cached on component root DOM nodes.  This
    // means that node stripping must remove such annotations.

    const domIsAttachedToBody = (dom: Node): boolean => {
        var body = document.body;
        for (; dom != null; dom = dom.parentNode) {
            if (dom === body) return true;
            var cmptInfo = domComponentInfo(dom);
            if (cmptInfo == null) continue;
            return cmptInfo.isAttached;
        }
        return false;
    };

    const updateIsAttached = (cmptInfo: ComponentInfo, isAttached: boolean): void => {
        if (cmptInfo == null) return;
        if (cmptInfo.isAttached == isAttached) return; // No change.
        propagateAttachmentDown(cmptInfo.dom, isAttached);
    };

    const propagateAttachmentDown = (dom: Node, isAttached: boolean): void => {
        const what = (isAttached ? "attached" : "detached");
        while (dom != null) {
            // Propagate bottom-up.
            propagateAttachmentDown(dom.firstChild, isAttached);
            // In case the lifecycle function plays silly buggers...
            var nextSibling = dom.nextSibling;
            var cmptInfo = domComponentInfo(dom);
            if (cmptInfo != null) cmptInfo.isAttached = isAttached;
            const lifecycleFn = odEventHandler(dom);
            if (lifecycleFn != null) lifecycleFn(what, dom);
            dom = nextSibling;
        }
    };

}