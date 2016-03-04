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
var Od;
(function (Od) {
    var emptyPropDict = [];
    ;
    Od.patchDom = function (vdom, dom, domParent) {
        if (vdom.tag)
            return patchElement(vdom, dom, domParent);
        if (vdom.obs)
            return patchObs(vdom, dom, domParent);
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
    var patchElement = function (vdom, dom, domParent) {
        var tag = vdom.tag;
        var vdomPropDict = vdom.props;
        var vdomChildren = vdom.children;
        var elt = dom;
        var newElt = (!elt || elt.tagName !== tag
            ? document.createElement(tag)
            : elt);
        patchProps(newElt, vdomPropDict);
        patchChildren(newElt, vdomChildren);
        replaceNode(newElt, dom, domParent);
        return newElt;
    };
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
    //
    // XXX At some point I want to handle style properties separately because
    // 'style' is supposed to be read-only (even though most browsers support
    // writing to it).  Just for now, this will do.
    //
    var patchProps = function (elt, vdomPropDict) {
        var eltPropList = getEltPropList(elt);
        if (!vdomPropDict && !eltPropList)
            return;
        if (!eltPropList)
            eltPropList = emptyPropList;
        var iElt = 0;
        var iVdom = 0;
        var iEltTop = eltPropList.length;
        var iVdomTop = vdomPropDict.length;
        var anyElt = elt;
        while (iElt < iEltTop && iVdom < iVdomTop) {
            var eltProp = eltPropList[iElt];
            var vdomProp = vdomPropDict[iVdom];
            if (eltProp < vdomProp) {
                anyElt[eltProp] = undefined;
                iElt += 1;
            }
            else {
                var vdomPropValue = vdomPropDict[iVdom + 1];
                anyElt[vdomProp] = vdomPropValue;
                iVdom += 2;
                iElt += (eltProp === vdomProp ? 1 : 0);
            }
        }
        while (iElt < iEltTop) {
            var eltProp = eltPropList[iElt];
            anyElt[eltProp] = undefined;
            iElt += 1;
        }
        while (iVdom < iVdomTop) {
            var vdomProp = vdomPropDict[iVdom];
            var vdomPropValue = vdomPropDict[iVdom + 1];
            anyElt[vdomProp] = vdomPropValue;
            iVdom += 2;
        }
    };
    var emptyIVdomList = [];
    var patchChildren = function (elt, vdomChildren) {
        var eltChildren = elt.childNodes;
        if (!vdomChildren)
            vdomChildren = emptyIVdomList;
        var iTop = Math.max(eltChildren.length, vdomChildren.length);
        for (var i = 0; i < iTop; i++) {
            var vdomChild = vdomChildren[i];
            var eltChild = eltChildren[i];
            if (vdomChild) {
                Od.patchDom(vdomChild, eltChild, elt);
            }
            else {
                replaceNode(null, eltChild, elt);
            }
        }
    };
    // We record the association between observables and DOM nodes.
    var getDomVdom = function (dom) {
        return dom.__Od__vdom;
    };
    var setDomVdom = function (dom, vdom) {
        dom.__Od__vdom = vdom;
    };
    var attachDomVdom = function (dom, vdom) {
        vdom.dom = dom;
        setDomVdom(dom, vdom);
    };
    var detachDomVdom = function (dom) {
        var eltVdom = getDomVdom(dom);
        if (!eltVdom)
            return;
        setDomVdom(dom, undefined);
        eltVdom.dom = undefined;
    };
    var patchObs = function (vdom, dom, domParent) {
        // XXX We're going to need a subscription here.
        // This isn't quite right.
        vdom = vdom.obs();
        var newDom = Od.patchDom(vdom, dom, domParent);
        attachDomVdom(newDom, vdom);
        return newDom;
    };
    // We track nodes we've deleted so we can clean them up: remove
    // dangling event handlers and that sort of thing.
    var deletedNodes = [];
    var replaceNode = function (newDom, dom, domParent) {
        if (newDom === dom)
            return;
        if (!dom) {
            if (domParent)
                domParent.appendChild(newDom);
        }
        else {
            if (domParent)
                domParent.replaceChild(newDom, dom);
            // Detach the DOM node from its corresponding obs, if it has one.
            detachDomVdom(dom);
            // Schedule the deleted DOM node for 
            deletedNodes.push(dom);
        }
    };
})(Od || (Od = {}));
//# sourceMappingURL=Od.js.map