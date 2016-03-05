// Od.ts
// (C) Ralph Becket, 2015
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
var Od;
(function (Od) {
    var debug = true;
    Od.text = function (text) {
        return ({ text: isNully(text) ? "" : text.toString() });
    };
    ;
    Od.element = function (tag, props, childOrChildren) {
        tag = tag.toUpperCase();
        var propAssocList = propsToPropAssocList(props);
        var children = (!childOrChildren
            ? null
            : isArray(childOrChildren)
                ? childOrChildren
                : [childOrChildren]);
        return { tag: tag, props: propAssocList, children: children };
    };
    Od.component = function (fn) {
        var obs = (Obs.isObservable(fn)
            ? fn
            : Obs.fn(fn));
        var vdom = { obs: obs, subs: null, dom: null };
        var subs = Obs.subscribe([obs], updateComponent.bind(vdom));
        vdom.subs = subs;
        subs(); // Initialise the dom component.
        return vdom;
    };
    // Implementation detail.
    var isArray = function (x) { return x instanceof Array; };
    var isNully = function (x) { return x === null || x === undefined; };
    var emptyPropDict = [];
    var propsToPropAssocList = function (props) {
        if (!props)
            return null;
        var propAssocList = [];
        var keys = Object.keys(props).sort();
        var iTop = keys.length;
        for (var i = 0; i < iTop; i++) {
            var key = keys[i];
            propAssocList.push(key, props[key]);
        }
        return propAssocList;
    };
    ;
    Od.patchDom = function (vdomOrString, dom, domParent) {
        var vdom = (typeof (vdomOrString) === "string"
            ? Od.text(vdomOrString)
            : vdomOrString);
        if (vdom.tag)
            return patchElement(vdom, dom, domParent);
        if (vdom.obs)
            return patchComponent(vdom, dom, domParent);
        return patchText(vdom, dom, domParent);
    };
    var patchText = function (vdom, dom, domParent) {
        var newText = vdom.text;
        var newDom = (!dom || dom.nodeName !== "#text"
            ? document.createTextNode(newText)
            : dom);
        if (newDom.textContent !== newText)
            newDom.textContent = newText;
        replaceNode(newDom, dom, domParent);
        return newDom;
    };
    var patchComponent = function (component, dom, domParent) {
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
        var newDom = component.dom;
        if (newDom !== dom)
            replaceNode(newDom, dom, domParent);
        return newDom;
    };
    var patchElement = function (vdom, dom, domParent) {
        var tag = vdom.tag;
        var vdomPropDict = vdom.props;
        var vdomChildren = vdom.children;
        var elt = dom;
        var newElt = (!elt || elt.tagName !== tag || isComponent(elt)
            ? document.createElement(tag)
            : elt);
        if (debug && newElt !== elt)
            console.log("Created", tag);
        patchProps(newElt, vdomPropDict);
        patchChildren(newElt, vdomChildren);
        replaceNode(newElt, dom, domParent);
        return newElt;
    };
    var isComponent = function (dom) { return !!getDomComponent(dom); };
    var emptyPropList = [];
    // We attach lists of (ordered) property names to elements so we can
    // perform property updates in O(n) time.
    var getEltPropList = function (elt) {
        return elt.__Od__props;
    };
    var setEltPropList = function (elt, propList) {
        elt.__Od__props = propList;
    };
    // We perform an ordered traversal of the old properties of the element
    // (if any) and the new properties, deleting, updating, and adding as
    // required.
    var patchProps = function (elt, vdomPropDict) {
        var eltPropList = getEltPropList(elt);
        if (!vdomPropDict && !eltPropList)
            return;
        if (!eltPropList)
            eltPropList = emptyPropList;
        if (!vdomPropDict)
            vdomPropDict = emptyPropDict;
        var iElt = 0;
        var iVdom = 0;
        var iEltTop = eltPropList.length;
        var iVdomTop = vdomPropDict.length;
        var newEltPropList = [];
        // Clear out any old properties that aren't replaced.
        // Update any changed properties.
        // Add any new properties.
        while (iElt < iEltTop && iVdom < iVdomTop) {
            var eltProp = eltPropList[iElt];
            var vdomProp = vdomPropDict[iVdom];
            if (eltProp < vdomProp) {
                removeDomProp(elt, eltProp);
                iElt += 1;
            }
            else {
                var vdomPropValue = vdomPropDict[iVdom + 1];
                setDomProp(elt, vdomProp, vdomPropValue, newEltPropList);
                iVdom += 2;
                iElt += (eltProp === vdomProp ? 1 : 0);
            }
        }
        while (iElt < iEltTop) {
            var eltProp = eltPropList[iElt];
            removeDomProp(elt, eltProp);
            iElt += 1;
        }
        while (iVdom < iVdomTop) {
            var vdomProp = vdomPropDict[iVdom];
            var vdomPropValue = vdomPropDict[iVdom + 1];
            setDomProp(elt, vdomProp, vdomPropValue, newEltPropList);
            iVdom += 2;
        }
        // Update the property list for the element so we can update it
        // correctly next time we visit it.
        setEltPropList(elt, newEltPropList);
    };
    // XXX We can put special property handling here (e.g., 'className' vs
    // 'class', and 'style' etc.)
    var removeDomProp = function (dom, prop) {
        dom[prop] = undefined;
        if (dom instanceof HTMLElement)
            dom.removeAttribute(prop);
    };
    var setDomProp = function (dom, prop, value, propList) {
        dom[prop] = value;
        propList.push(prop);
    };
    var emptyIVdomList = [];
    var patchChildren = function (elt, vdomChildren) {
        var eltChildren = elt.childNodes;
        if (!vdomChildren)
            vdomChildren = emptyIVdomList;
        var numEltChildren = eltChildren.length;
        var numVdomChildren = vdomChildren.length;
        // Remove any extraneous existing children.
        // We do this first, and backwards, because removing a child node
        // changes the indices of any succeeding children.
        for (var i = numEltChildren - 1; numVdomChildren <= i; i--) {
            var eltChild = eltChildren[i];
            replaceNode(null, eltChild, elt);
            if (debug)
                console.log("Removed child", i + 1);
        }
        // Patch or add the number of required children.
        for (var i = 0; i < numVdomChildren; i++) {
            if (debug)
                console.log("Patching child", i + 1);
            var vdomChild = vdomChildren[i];
            var eltChild = eltChildren[i];
            Od.patchDom(vdomChild, eltChild, elt);
            if (debug)
                console.log("Patched child", i + 1);
        }
    };
    var getDomComponent = function (dom) {
        return dom.__Od__component;
    };
    var setDomComponent = function (dom, component) {
        if (dom)
            dom.__Od__component = component;
    };
    function updateComponent() {
        var component = this;
        var vdom = component.obs();
        var dom = component.dom;
        var domParent = dom && dom.parentNode;
        setDomComponent(dom, null);
        var newDom = Od.patchDom(vdom, dom, domParent);
        setDomComponent(newDom, component);
        component.dom = newDom;
    }
    // We track nodes we've deleted so we can clean them up: remove
    // dangling event handlers and that sort of thing.
    // XXX Add a background process to do that.
    var deletedNodes = [];
    var replaceNode = function (newDom, oldDom, domParent) {
        if (!newDom) {
            if (!oldDom)
                return;
            if (debug)
                console.log("Deleted", oldDom.nodeName || "#text");
            deletedNodes.push(oldDom);
            if (domParent)
                domParent.removeChild(oldDom);
        }
        else {
            if (!oldDom) {
                if (debug)
                    console.log("Inserted", newDom.nodeName || "#text");
                if (domParent)
                    domParent.appendChild(newDom);
            }
            else {
                if (newDom === oldDom)
                    return;
                if (debug)
                    console.log("Deleted", oldDom.nodeName || "#text");
                deletedNodes.push(oldDom);
                if (!domParent)
                    return;
                if (debug)
                    console.log("Inserted", newDom.nodeName || "#text");
                if (domParent)
                    domParent.replaceChild(newDom, oldDom);
            }
        }
    };
})(Od || (Od = {}));
//# sourceMappingURL=Od.js.map