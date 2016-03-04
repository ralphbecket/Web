var Greeter = (function () {
    function Greeter(element) {
        this.element = element;
        this.element.innerHTML += "The time is: ";
        this.span = document.createElement('span');
        this.element.appendChild(this.span);
        this.span.innerText = new Date().toUTCString();
    }
    Greeter.prototype.start = function () {
        var _this = this;
        this.timerToken = setInterval(function () { return _this.span.innerHTML = new Date().toUTCString(); }, 500);
    };
    Greeter.prototype.stop = function () {
        clearTimeout(this.timerToken);
    };
    return Greeter;
})();
window.onload = function () {
    var el = document.getElementById('content');
    var greeter = new Greeter(el);
    greeter.start();
    var x = Obs.of(123);
};
// Obs.ts
// (C) Ralph Becket, 2015
//
// My implementation of Knockout-style observables, albeit with deferred
// updates and dependency ordering to minimise redundant recomputation.
//
// API
//
// Constructing observables:
//
//      var x = Obs.of(k);
//      var x = Obs.of(k, eq);
//          creates a new mutable observable initialised to k with
//          equality test eq (the default equality test us (p, q) => p === q)
//          used to decide whether the new value is different to the
//          previous value.  If an observable's value does change, its
//          dependents (computed observables and subscriptions) will be
//          scheduled for re- evaluation.
//
// Reading and writing observables:
//
//      x() is the current value of x.
//      x(j) updates the value of x.
//
// Constructing computed observables:
//
//      var u = Obs.fn(() => Math.min(x(), y()));
//      var u = Obs.fn(() => Math.min(x(), y()), eq);
//          creates a new computed observable which will be re-evaluated
//          whenever x() or y() changes; the computed observable will use
//          the eq equality test (the default is as for mutable observables)
//          when deciding whether the computed observable's value has changed,
//          leading to its dependents being scheduled for re-evaluation.
//
// Reading computed observables:
//
//      u() is the current value of u.
//      It is an error to try to update the value of a computed observable.
//
// Peeking at the value of a mutable or computed observable:
//
//      Obs.peek(x) returns the current value of observable x without
//      establishing a dependency on x (which is what happens when
//      reading x via x()).
//
// Subscriptions:
//
//      var w = Obs.subscribe([x, y, u], () => { ...; });
//          creates a new subscription on x, y, and u.  Whenever any of these
//          observables changes, the subscribed function will be scheduled for
//          re-evaluation.
//
//      w()
//          Forces re-evaluation of w's subscribed function.
//
// Order of re-evaluation:
//
//      A mutable observable has level 0.
//
//      A computed observable has a level one greater than any of its
//      dependencies Cyclic dependencies (should you manage to create them)
//      have undefined behaviour: don't create cycles.
//
//      Subscriptions effectively have level infinity.
//
//      When re-evaluation is triggered, it occurs in ascending order of level.
//      This ensures that if, say, computed observable v depends on observables
//      x and u and computed observable u depends on x, then updating x will
//      cause v to be re-evaluated just once, rather than twice.
// 
// Suspending re-evaluation:
//
//      Obs.startUpdate();
//      x(123);
//      y(456);
//      ...
//      Obs.endUpdate();
//          Dependents of x, y, and any other updated mutable observables in
//          the update region will be scheduled, but not evaluated, until the
//          end of the update region is reached.  This means that if, say,
//          computed observable depends on x and y, it will be re-evaluated
//          just once, rather than twice.
//
//          Update regions can be nested; re-evaluation will only take place
//          once the end of the outermost update region is reached.
//
// Observable identities:
//
//      x.id is the unique numeric identifier for observable x.
//
// Disposal:
//
//      x.dispose()
//          Breaks the connection between x and any of its dependencies and
//          sets its value to undefined.  This is sometimes necessary to
//          prevent garbage retention, since a dependency link is a two-way
//          relation.
//
var Obs;
(function (Obs) {
    // The public interface.
    var debug = true;
    // Create a mutable observable.
    Obs.of = function (x, eq) {
        if (eq === void 0) { eq = defaultEq; }
        var obs = undefined;
        // We need 'function' so we can use 'arguments'.  Sorry.
        obs = (function (newX) {
            return readOrWriteObs(obs, eq, newX, arguments.length);
        });
        obs.id = nextID++;
        obs.value = x;
        obs.toString = obsToString;
        obs.dispose = disposeObs;
        return obs;
    };
    // Create a computed observable.
    Obs.fn = function (f, eq) {
        if (eq === void 0) { eq = defaultEq; }
        var obs = undefined;
        // We need 'function' so we can use 'arguments'.  Sorry.
        obs = (function (newX) {
            return readOrWriteObs(obs, eq, newX, arguments.length);
        });
        obs.id = nextID++;
        obs.fn = function () { return updateComputedObs(obs, f, eq); };
        obs.dependencies = {};
        obs.toString = obsToString;
        obs.dispose = disposeObs;
        reevaluateComputedObs(obs);
        return obs;
    };
    // Peek at the value of an observable without establishing a dependency.
    Obs.peek = function (obs) { return obs.value; };
    // Create a subscription on a set of observables.  The action can read
    // any observables without establishing a dependency.  Subscriptions
    // run after all other affected computed observables have run.
    Obs.subscribe = function (obss, action) {
        var subsAction = function () {
            var tmp = currentDependencies;
            currentDependencies = undefined; // Suspend dependency tracking.
            action();
            currentDependencies = tmp;
        };
        var obs = subsAction;
        var id = nextID++;
        var obsAnys = obss;
        for (var i = 0; i < obsAnys.length; i++) {
            var obsI = obsAnys[i];
            if (!obsI.dependents)
                obsI.dependents = {};
            obsI.dependents[id] = obs;
        }
        ;
        obs.id = id;
        obs.level = 999999999; // Ensure subscriptions run last.
        obs.fn = subsAction;
        obs.value = "{subscription}"; // For obsToString;
        obs.toString = obsToString;
        obs.dispose = function () {
            disposeSubs(obs, obsAnys);
        };
        return obs;
    };
    // Implementation detail.
    Obs.toStringMaxValueLength = 32;
    // We need 'function' rather than '=>' so we can use 'this'.  Sorry.
    var obsToString = function () {
        var valueStr = JSON.stringify(this.value);
        if (valueStr && Obs.toStringMaxValueLength < valueStr.length) {
            valueStr = valueStr.substr(0, Obs.toStringMaxValueLength) + "...";
        }
        return "{obs " + this.id + " = " + valueStr + "}";
    };
    // We need 'function' rather than '=>' so we can use 'this'.  Sorry.
    var disposeObs = function () {
        var obs = this;
        obs.value = undefined;
        breakDependencies(obs);
        obs.dependents = undefined;
    };
    var disposeSubs = function (obs, obsAnys) {
        var id = obs.id;
        for (var i = 0; i < obsAnys.length; i++)
            obsAnys[i].dependents[id] = undefined;
    };
    var defaultEq = function (x, y) { return x === y; };
    var readOrWriteObs = function (obs, eq, newX, argc) {
        if (argc) {
            if (obs.fn)
                throw new Error("Computed observables cannot be assigned to.");
            if (debug)
                console.log("Updating obs " + obs.id);
            var oldX = obs.value;
            obs.value = newX;
            if (!eq(oldX, newX))
                updateDependents(obs);
        }
        if (currentDependencies)
            currentDependencies[obs.id] = obs;
        return obs.value;
    };
    var updateComputedObs = function (obs, f, eq) {
        var oldX = obs.value;
        var newX = f();
        obs.value = newX;
        return !eq(oldX, newX); // True iff the new result is different.
    };
    // Name supply of identifiers.
    var nextID = 1;
    // A basic binary heap priority queue used to efficiently order
    // evaluation of observables in ascending level order.
    var updateQ = [];
    var enqueueUpdate = function (obs) {
        if (obs.isInUpdateQueue)
            return;
        if (debug)
            console.log("  Enqueueing obs " + obs.id);
        // This is usually called "DownHeap" in the literature.
        var i = updateQ.length;
        updateQ.push(obs);
        obs.isInUpdateQueue = true;
        var j = i >> 1; // This is how we cast to int in JS.
        var levelI = obs.level;
        while (i) {
            var obsJ = updateQ[j];
            var levelJ = obsJ.level;
            if (levelJ <= levelI)
                break;
            updateQ[i] = obsJ;
            i = j;
            j = i >> 1;
        }
        updateQ[i] = obs;
        if (debug)
            console.log("    UpdateQ = " + JSON.stringify(updateQ.map(function (x) { return x.id; })));
    };
    var dequeueUpdate = function () {
        if (!updateQ.length)
            return undefined;
        var obs = updateQ[0];
        obs.isInUpdateQueue = false;
        if (debug)
            console.log("  Dequeueing obs " + obs.id);
        // This is usually called "UpHeap" in the literature.
        var obsI = updateQ.pop();
        var levelI = obsI.level;
        var n = updateQ.length;
        if (!n)
            return obs;
        var i = 0;
        var j = 1;
        while (j < n) {
            var k = Math.min(j + 1, n - 1);
            var objJ = updateQ[j];
            var objK = updateQ[k];
            var levelJ = objJ.level;
            var levelK = objK.level;
            if (levelJ <= levelK) {
                if (levelI <= levelJ)
                    break;
                updateQ[i] = objJ;
                i = j;
            }
            else {
                if (levelI <= levelK)
                    break;
                updateQ[i] = objK;
                i = k;
            }
            j = i << 1;
        }
        updateQ[i] = obsI;
        return obs;
    };
    // If this is non-zero the update propagation is being batched.
    var updateDepth = 0;
    // Call this to batch update propagation (this is useful when updating
    // several assignable observables with mutual dependents).
    Obs.startUpdate = function () {
        updateDepth++;
    };
    // Call this once a batch update has completed.
    Obs.endUpdate = function () {
        if (updateDepth)
            updateDepth--;
        if (updateDepth === 0)
            processUpdateQueue();
    };
    var processUpdateQueue = function () {
        while (true) {
            var obs = dequeueUpdate();
            if (!obs)
                return;
            reevaluateComputedObs(obs);
        }
    };
    // The dependencies identified while performing an update.
    // If this is undefined then no dependencies will be recorded.
    var currentDependencies = undefined;
    var reevaluateComputedObs = function (obs) {
        if (debug)
            console.log("Reevaluating obs " + obs.id + "...");
        var oldCurrentDependencies = currentDependencies;
        currentDependencies = obs.dependencies;
        breakDependencies(obs);
        var hasChanged = tryReevaluateObsFn(obs);
        establishDependencies(obs);
        currentDependencies = oldCurrentDependencies;
        if (hasChanged)
            updateDependents(obs);
        if (debug)
            console.log("Reevaluating obs " + obs.id + " done.");
    };
    // Break the connection between a computed observable and its dependencies
    // prior to reevaluating its value (reevaluation may change the set of
    // dependencies).
    var breakDependencies = function (obs) {
        var obsID = obs.id;
        var dependencies = obs.dependencies;
        if (!dependencies)
            return;
        for (var id in dependencies) {
            var obsDepcy = dependencies[id];
            if (!obsDepcy)
                continue;
            dependencies[id] = undefined;
            obsDepcy.dependents[obsID] = undefined;
        }
    };
    // Establish a connection with observables used while reevaluating a
    // computed observable.
    var establishDependencies = function (obs) {
        var obsID = obs.id;
        var dependencies = obs.dependencies;
        var obsLevel = 0;
        for (var id in dependencies) {
            var obsDepcy = dependencies[id];
            if (!obsDepcy)
                continue;
            if (!obsDepcy.dependents)
                obsDepcy.dependents = {};
            obsDepcy.dependents[obsID] = obs;
            if (debug)
                console.log("  Obs " + obsID + " depends on obs " + obsDepcy.id);
            var obsDepcyLevel = obsDepcy.level | 0;
            if (obsLevel <= obsDepcyLevel)
                obsLevel = 1 + obsDepcyLevel;
        }
        obs.level = obsLevel;
    };
    // After an observable has been updated, we need to also update its
    // dependents in level order.
    var updateDependents = function (obs) {
        var dependents = obs.dependents;
        if (!dependents)
            return;
        Obs.startUpdate();
        for (var id in dependents) {
            var depdtObs = dependents[id];
            if (!depdtObs)
                continue;
            enqueueUpdate(depdtObs);
        }
        Obs.endUpdate();
    };
    // Attempt to handle exceptions gracefully.
    Obs.exceptionReporter = function (e) {
        return (window.console && window.console.log
            ? window.console.log(e)
            : alert("Exception reevaluating computed observable:\n" +
                JSON.stringify(e)));
    };
    // This is separated out because try/catch prevents optimization by
    // most contemporary JavaScript engines.
    var tryReevaluateObsFn = function (obs) {
        try {
            return obs.fn();
        }
        catch (e) {
            Obs.exceptionReporter(e);
            return false;
        }
    };
})(Obs || (Obs = {}));
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
    Od.component = function (obs) {
        var subs = Obs.subscribe([obs], updateComponent);
        var vdom = { obs: obs, subs: subs, dom: null };
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
        var iTop = Math.max(eltChildren.length, vdomChildren.length);
        for (var i = 0; i < iTop; i++) {
            if (debug)
                console.log("Patching child", i + 1);
            var vdomChild = vdomChildren[i];
            var eltChild = eltChildren[i];
            if (vdomChild) {
                Od.patchDom(vdomChild, eltChild, elt);
            }
            else {
                replaceNode(null, eltChild, elt);
            }
            if (debug)
                console.log("Patched child", i + 1);
        }
    };
    var getDomComponent = function (dom) {
        return dom.__Od__component;
    };
    var setDomComponent = function (dom, component) {
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
//# sourceMappingURL=app.js.map