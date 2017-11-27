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
var Od;
(function (Od) {
    var debug = false;
    Od.flattenVdoms = function (xs) {
        if (xs == null)
            return null;
        if (!(xs instanceof Array))
            return [xs];
        // Otherwise xs should be an array.
        var ys = xs;
        var n = ys.length;
        var hasNestedArray = false;
        for (var i = 0; i < n; i++) {
            if (!(ys[i] instanceof Array))
                continue;
            hasNestedArray = true;
            break;
        }
        if (!hasNestedArray)
            return xs;
        // The array is inhomogeneous.  Let's flatten it.
        var zs = [];
        flattenNestedVdoms(xs, zs);
        return zs;
    };
    var flattenNestedVdoms = function (xs, zs) {
        var n = xs.length;
        for (var i = 0; i < n; i++) {
            var x = xs[i];
            if (x instanceof Array)
                flattenNestedVdoms(x, zs);
            else
                zs.push(x);
        }
    };
    ;
    // We don't have a special representation for text nodes, we simply
    // represent them as strings or numbers.
    var patchText = function (content, dom, parent) {
        var txt = (content == null ? null : content.toString());
        if (dom == null || dom.nodeName !== "#text" || isComponentDom(dom)) {
            var newDom = document.createTextNode(txt);
            patchNode(newDom, dom, parent);
            return newDom;
        }
        if (dom.nodeValue !== txt)
            dom.nodeValue = txt;
        return dom;
    };
    // Patch from an arbitrary Vdom node.
    var patchFromVdom = function (vdom, dom, parent) {
        return (vdom instanceof Function
            ? vdom(dom, parent)
            : patchText(vdom, dom, parent));
    };
    // Create an element node.
    Od.element = function (tag, props, children) {
        tag = tag.toUpperCase();
        var vchildren = Od.flattenVdoms(children);
        var vdom = function (dom, parent) {
            var elt = dom;
            var newDom = ((dom == null || elt.tagName !== tag || isComponentDom(dom))
                ? document.createElement(tag)
                : elt);
            patchNode(newDom, dom, parent);
            patchProps(newDom, props);
            patchChildren(newDom, vchildren);
            handleElementLifecycleFn(props, newDom, dom);
            return newDom;
        };
        // Special-handling of 'keyed' nodes.
        var key = props && props["key"];
        if (key != null)
            vdom.key = key;
        // Special-handling of 'Od event handler' nodes.
        if (odEventHandler(props) != null && parentComponentInfo != null) {
            parentComponentInfo.hasOdEventHandlers = true;
        }
        return vdom;
    };
    var odEventHandler = function (x) { return x && x["onodevent"]; };
    var handleElementLifecycleFn = function (props, newDom, oldDom) {
        var lifecycleFn = odEventHandler(props);
        if (lifecycleFn == null)
            return;
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
    var patchNode = function (newDom, oldDom, parent) {
        if (newDom === oldDom)
            return;
        enqueueNodeForStripping(oldDom);
        if (parent == null)
            return;
        if (newDom == null) {
            if (oldDom == null)
                return;
            parent.removeChild(oldDom);
            var cmptInfo = domComponentInfo(oldDom);
            //if (cmptInfo && cmptInfo.isAttached) propagateAttachmentDown(oldDom, false);
            updateIsAttached(cmptInfo, false);
        }
        else if (oldDom == null) {
            parent.appendChild(newDom);
        }
        else {
            parent.replaceChild(newDom, oldDom);
            var cmptInfo = domComponentInfo(oldDom);
            //if (cmptInfo && cmptInfo.isAttached) propagateAttachmentDown(oldDom, false);
            updateIsAttached(cmptInfo, false);
        }
    };
    // A DOM node corresponding to the root of a component has an
    // __Od__componentInfo property with a non-zero value.
    //
    var isComponentDom = function (dom) {
        return domComponentInfo(dom) != null;
    };
    var domComponentInfo = function (dom) {
        return dom.__Od__componentInfo;
    };
    var setDomComponentInfo = function (dom, cmptInfo) {
        if (domComponentInfo(dom) == null)
            dom.__Od__componentInfo = cmptInfo;
    };
    var clearDomComponentInfo = function (dom, cmptInfo) {
        if (domComponentInfo(dom) === cmptInfo)
            dom.__Od__componentInfo = null;
    };
    var nextComponentID = 1; // Name supply.
    var parentComponentInfo = null; // Used for scoping.
    var existingNamedComponent = function (name) {
        return (name != null && parentComponentInfo != null
            ? parentComponentInfo.namedSubcomponents[name]
            : null);
    };
    // Normally, component updates will be batched via requestAnimationFrame
    // (i.e., they will occur at most once per display frame).  Setting this
    // to false ensures updates happen eagerly (i.e., they will not be
    // deferred).
    Od.deferComponentUpdates = true;
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
    Od.component = function (name, fn) {
        // If this component already exists in this scope, return that.
        var existingCmpt = existingNamedComponent(name);
        if (existingCmpt != null)
            return existingCmpt;
        // Okay, we need to create a new component.
        var cmptID = nextComponentID++;
        console.log("Creating component", name, cmptID);
        var cmptInfo = {
            name: name,
            componentID: cmptID,
            dom: null,
            isAttached: false,
            obs: null,
            subs: null,
            anonymousSubcomponents: [],
            namedSubcomponents: {},
            hasOdEventHandlers: false,
            updateIsPending: false
        };
        // A component, like any vDOM, is a patching function.
        var cmpt = function (dom, parent) {
            var cmptDom = cmptInfo.dom;
            patchNode(cmptDom, dom, parent);
            if (cmptDom !== dom && cmptInfo.hasOdEventHandlers) {
                var isAttached = (parentComponentInfo != null
                    ? parentComponentInfo.isAttached
                    : domIsAttachedToBody(cmptDom));
                updateIsAttached(cmptInfo, isAttached);
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
        var obs = Obs.fn(function () {
            if (name !== "log")
                console.log("Updating component", name, cmptID);
            var oldParentComponentInfo = parentComponentInfo;
            parentComponentInfo = cmptInfo;
            disposeAnonymousSubcomponents(cmptInfo);
            var vdom = fn();
            parentComponentInfo = oldParentComponentInfo;
            return vdom;
        });
        // Create the initial DOM node for this component.
        // Peek here, because we don't want any parent component
        // acquiring a dependency on this component's private observable.
        var dom = patchFromVdom(Obs.peek(obs), null, null);
        setDomComponentInfo(dom, cmptInfo);
        runPendingOdEventCallbacks();
        // Set up the update subscription.
        var subs = Obs.subscribe([obs], function () {
            if (Od.deferComponentUpdates) {
                deferComponentUpdate(cmptInfo);
            }
            else {
                updateComponent(cmptInfo);
                runPendingOdEventCallbacks();
            }
        });
        // Set up the disposal method.
        cmpt.dispose = function () { disposeComponent(cmptInfo); };
        // Fill in the ComponentInfo.
        cmptInfo.dom = dom;
        cmptInfo.obs = obs;
        cmptInfo.subs = subs;
        // Set the key, if we have one.
        cmpt.key = dom.key;
        // And we're done!
        return cmpt;
    };
    var updateComponent = function (cmptInfo) {
        var oldParentComponentInfo = parentComponentInfo;
        parentComponentInfo = cmptInfo;
        var cmptID = cmptInfo.componentID;
        var dom = cmptInfo.dom;
        var obs = cmptInfo.obs;
        var parent = dom && dom.parentNode;
        clearDomComponentInfo(dom, cmptInfo); // So patching will apply internally.
        var newDom = patchFromVdom(obs(), dom, parent);
        setDomComponentInfo(newDom, cmptInfo); // Restore DOM ownership.
        cmptInfo.dom = newDom;
        cmptInfo.updateIsPending = false;
        parentComponentInfo = oldParentComponentInfo;
    };
    var disposeComponent = function (cmptInfo) {
        console.log("Disposing component", cmptInfo.name, cmptInfo.componentID);
        disposeAnonymousSubcomponents(cmptInfo);
        disposeNamedSubcomponents(cmptInfo);
        Obs.dispose(cmptInfo.subs);
        Obs.dispose(cmptInfo.obs);
        var dom = cmptInfo.dom;
        var domRemove = dom && dom.remove;
        //if (domRemove != null) domRemove.call(dom);
        clearDomComponentInfo(dom, cmptInfo);
        enqueueNodeForStripping(dom);
    };
    var disposeAnonymousSubcomponents = function (cmptInfo) {
        var cmpts = cmptInfo.anonymousSubcomponents;
        for (var cmpt = cmpts.pop(); cmpt != null; cmpt = cmpts.pop()) {
            Od.dispose(cmpt);
        }
    };
    var disposeNamedSubcomponents = function (cmptInfo) {
        var cmpts = cmptInfo.namedSubcomponents;
        for (var name in cmpts) {
            var cmpt = cmpts[name];
            Od.dispose(cmpt);
            cmpts[name] = null;
        }
    };
    // Note that disposing a component removes its DOM subtree from the
    // main DOM tree and enqueues its nodes for stripping.  Any elements
    // with onodevent handlers will receive "removed" events.
    Od.dispose = function (vdom) {
        var dispose = vdom && vdom.dispose;
        if (dispose != null)
            dispose();
    };
    var componentInfosPendingUpdate = [];
    var deferredComponentUpdatesID = 0;
    var deferComponentUpdate = function (cmptInfo) {
        if (cmptInfo.updateIsPending)
            return;
        cmptInfo.updateIsPending = true;
        componentInfosPendingUpdate.push(cmptInfo);
        if (deferredComponentUpdatesID !== 0)
            return;
        deferredComponentUpdatesID = raf(updateDeferredComponents);
    };
    var updateDeferredComponents = function () {
        console.log("Updating deferred components...");
        var cmptInfos = componentInfosPendingUpdate;
        for (var cmptInfo = cmptInfos.pop(); cmptInfo != null; cmptInfo = cmptInfos.pop()) {
            updateComponent(cmptInfo);
        }
        runPendingOdEventCallbacks();
        deferredComponentUpdatesID = 0;
        console.log("Updating deferred components done.");
    };
    // Construct a static DOM subtree from an HTML string.
    Od.fromHtml = function (html) {
        // First, turn the HTML into a DOM tree.
        var tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        // If this is a bunch of nodes, return the whole DIV.
        var newDom = (tmp.childNodes.length === 1 ? tmp.firstChild : tmp);
        // Prevent this DOM subtree from being patched.
        setDomComponentInfo(newDom, {});
        var vdom = function (dom, parent) {
            patchNode(newDom, dom, parent);
            return newDom;
        };
        return vdom;
    };
    // Take a DOM subtree directly.  The patching algorithm will not
    // touch the contents of this subtree.
    Od.fromDom = function (srcDom) {
        setDomComponentInfo(srcDom, {});
        var vdom = function (dom, parent) {
            patchNode(srcDom, dom, parent);
            return srcDom;
        };
        return vdom;
    };
    // Bind a vDOM node to a DOM node.  For example,
    // Od.bind(myVdom, document.body.getElementById("foo"));
    // This will either update or replace the DOM node in question.
    Od.bind = function (vdom, dom) {
        var domParent = dom && dom.parentNode;
        var newDom = patchFromVdom(vdom, dom, domParent);
        var isAttached = domIsAttachedToBody(dom);
        propagateAttachmentDown(newDom, isAttached);
        return newDom;
    };
    // Bind a vDOM node to a DOM node as new child.  For example,
    // Od.appendChild(myVdom, document.body);
    Od.appendChild = function (vdom, parent) {
        var newDom = patchFromVdom(vdom, null, parent);
        var isAttached = domIsAttachedToBody(parent);
        propagateAttachmentDown(newDom, isAttached);
        return newDom;
    };
    var isArray = function (x) { return x instanceof Array; };
    var patchProps = function (elt, newProps) {
        var oldProps = getEltOdProps(elt);
        if (newProps)
            for (var prop in newProps)
                if (prop !== "style")
                    setDomProp(elt, prop, newProps[prop]);
        if (oldProps)
            for (var prop in oldProps)
                if (!newProps || !(prop in newProps))
                    removeDomProp(elt, prop);
        // Style properties are special.
        var eltStyleProps = oldProps && oldProps["style"];
        var vdomStyleProps = newProps && newProps["style"];
        patchStyleProps(elt, eltStyleProps, vdomStyleProps);
        var eltAttrProps = oldProps && oldProps["attrs"];
        var vdomAttrProps = newProps && newProps["attrs"];
        patchAttrProps(elt, eltAttrProps, vdomAttrProps);
        setEltOdProps(elt, newProps);
    };
    var patchStyleProps = function (elt, oldStyleProps, newStyleProps) {
        if (typeof (newStyleProps) === "string") {
            elt.style = newStyleProps;
            return;
        }
        if (!newStyleProps) {
            // Don't reset all style properties unless there were some before.
            if (oldStyleProps)
                elt.removeAttribute("style");
            return;
        }
        var eltStyle = elt.style;
        for (var prop in newStyleProps)
            eltStyle[prop] = newStyleProps[prop];
        if (!oldStyleProps)
            return;
        for (var prop in oldStyleProps)
            if (!(prop in newStyleProps))
                eltStyle[prop] = null;
    };
    var patchAttrProps = function (elt, oldAttrProps, newAttrProps) {
        if (newAttrProps)
            for (var attr in newAttrProps) {
                elt.setAttribute(attr, newAttrProps[attr]);
            }
        if (oldAttrProps)
            for (var attr in oldAttrProps) {
                if (newAttrProps && (attr in newAttrProps))
                    continue;
                elt.removeAttribute(attr);
            }
    };
    var getEltOdProps = function (elt) {
        return elt.__Od__props;
    };
    var setEltOdProps = function (elt, props) {
        elt.__Od__props = props;
    };
    var removeDomProp = function (dom, prop) {
        dom[prop] = null;
        if (dom instanceof HTMLElement)
            dom.removeAttribute(prop);
    };
    var setDomProp = function (dom, prop, value) {
        if (prop === "class")
            prop = "className"; // This is convenient.
        dom[prop] = value;
    };
    var patchChildren = function (parent, vchildren) {
        if (vchildren == null)
            vchildren = [];
        if (parent.keyed)
            reorderKeyedChildren(vchildren, parent);
        var echild = parent.firstChild;
        var numVdomChildren = vchildren.length;
        // Patch or add the number of required children.
        for (var i = 0; i < numVdomChildren; i++) {
            var vchild = vchildren[i];
            var patchedEChild = patchFromVdom(vchild, echild, parent);
            echild = patchedEChild.nextSibling;
        }
        // Remove any extraneous children.
        while (echild) {
            var nextEChild = echild.nextSibling;
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
    var reorderKeyedChildren = function (vchildren, parent) {
        var firstChild = parent.firstChild;
        var numVChildren = vchildren.length;
        if (numVChildren === 0 || !firstChild)
            return;
        // Construct a mapping from keys to DOM nodes.
        var keyToChild = {};
        for (var child = firstChild; child; child = child.nextSibling) {
            var key = child.key;
            if (key == null)
                return; // We insist that all children have keys.
            keyToChild[key] = child;
        }
        // Reorder the DOM nodes to match the vDOM order, unless
        // we need to insert a new node.
        var child = firstChild;
        for (var i = 0; i < numVChildren; i++) {
            var vchild = vchildren[i];
            var vkey = vchild.key;
            if (vkey == null)
                return;
            var ckey = child && child.key;
            var requiredChild = keyToChild[vkey];
            if (child) {
                if (ckey === vkey) {
                    child = child.nextSibling;
                }
                else if (requiredChild) {
                    parent.insertBefore(requiredChild, child);
                }
                else {
                    parent.insertBefore(document.createElement("DIV"), child);
                }
            }
            else if (requiredChild) {
                parent.appendChild(requiredChild);
            }
            else {
                parent.appendChild(document.createElement("DIV"));
            }
        }
    };
    // We defer DOM updates using requestAnimationFrame.  It's better to
    // batch DOM updates where possible.
    var requestAnimationFrameSubstitute = function (callback) {
        return setTimeout(callback, 16); // 16 ms = 1/60 s.
    };
    var raf = window.requestAnimationFrame || requestAnimationFrameSubstitute;
    // We track DOM nodes we've discarded so we can clean them up, remove
    // dangling event handlers and that sort of thing.  We do this in
    // the background to reduce the time between patching the DOM and
    // handing control back to the browser so it can re-paint.
    var nodesPendingStripping = [];
    var enqueueNodeForStripping = function (dom) {
        if (!dom)
            return;
        var cmptInfo = domComponentInfo(dom);
        if (cmptInfo != null) {
            //if (cmptInfo.isAttached) propagateAttachmentDown(dom, false);
            updateIsAttached(cmptInfo, false);
            return; // Otherwise, we leave this alone: it belongs to the component.
        }
        nodesPendingStripping.push(dom);
        if (stripNodesID !== 0)
            return;
        stripNodesID = setTimeout(stripNodes, 0);
    };
    var stripNodesID = 0;
    var stripNodes = function () {
        var nodes = nodesPendingStripping;
        for (var dom = nodes.pop(); dom != null; dom = nodes.pop()) {
            stripNode(dom);
        }
        stripNodesID = 0;
    };
    var stripNode = function (dom) {
        // We don't want to strip anything owned by a component.
        if (dom == null)
            return;
        var cmptInfo = domComponentInfo(dom);
        if (cmptInfo != null) {
            console.log("Not stripping component node:", dom, domComponentInfo(dom));
            //if (cmptInfo.hasOdEventHandlers && cmptInfo.isAttached) propagateAttachmentDown(dom, false);
            updateIsAttached(cmptInfo, false);
            return;
        }
        // Strip any properties...
        var props = getEltOdProps(dom);
        var lifecycleFn = odEventHandler(props);
        if (lifecycleFn)
            lifecycleFn("removed", dom);
        var anyDom = dom;
        for (var prop in props)
            if (prop !== "src" || anyDom.tagName !== "IMG")
                anyDom[prop] = null;
        // Recursively strip any child nodes.
        var children = dom.childNodes;
        var numChildren = children.length;
        for (var i = 0; i < numChildren; i++)
            stripNode(children[i]);
    };
    var runningPendingOdEvents = false;
    var pendingCreatedEventCallbacks = [];
    var pendingUpdatedEventCallbacks = [];
    var runPendingOdEventCallbacks = function () {
        // Guard against infinite loops!
        if (runningPendingOdEvents)
            return;
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
    var runPendingCreatedEventCallbacks = function () {
        for (var i = 0; i < pendingCreatedEventCallbacks.length; i++) {
            var dom = pendingCreatedEventCallbacks[i];
            var callback = dom.onodevent;
            if (callback != null)
                callback("created", dom);
        }
        pendingCreatedEventCallbacks = [];
    };
    var runPendingUpdatedEventCallbacks = function () {
        for (var i = 0; i < pendingUpdatedEventCallbacks.length; i++) {
            var dom = pendingUpdatedEventCallbacks[i];
            var callback = dom.onodevent;
            if (callback != null)
                callback("updated", dom);
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
    var domIsAttachedToBody = function (dom) {
        var body = document.body;
        for (; dom != null; dom = dom.parentNode) {
            if (dom === body)
                return true;
            var cmptInfo = domComponentInfo(dom);
            if (cmptInfo == null)
                continue;
            return cmptInfo.isAttached;
        }
        return false;
    };
    var updateIsAttached = function (cmptInfo, isAttached) {
        if (cmptInfo == null)
            return;
        if (cmptInfo.isAttached == isAttached)
            return; // No change.
        propagateAttachmentDown(cmptInfo.dom, isAttached);
    };
    var propagateAttachmentDown = function (dom, isAttached) {
        var what = (isAttached ? "attached" : "detached");
        while (dom != null) {
            // Propagate bottom-up.
            propagateAttachmentDown(dom.firstChild, isAttached);
            // In case the lifecycle function plays silly buggers...
            var nextSibling = dom.nextSibling;
            var cmptInfo = domComponentInfo(dom);
            if (cmptInfo != null)
                cmptInfo.isAttached = isAttached;
            var lifecycleFn = odEventHandler(dom);
            if (lifecycleFn != null)
                lifecycleFn(what, dom);
            dom = nextSibling;
        }
    };
})(Od || (Od = {}));
