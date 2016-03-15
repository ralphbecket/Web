// Obs.ts
// (C) Ralph Becket, 2016
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
//          equality test eq (the default equality test is (p, q) => p === q)
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
    // The default equality test for observables.
    Obs.defaultEq = function (x, y) { return x === y; };
    // This is useful for Dates.
    Obs.valueOfEq = function (x, y) {
        return (x && y && x.valueOf() === y.valueOf()) ||
            (!x && !y);
    };
    // The "equality test" for observables that always indicates a change.
    Obs.alwaysUpdate = function (x, y) { return false; };
    // Create a mutable observable.  The default equality test for 
    // numbers, strings, and booleans is ===, otherwise any update is
    // assumed to provide a different value, hence triggering any
    // dependents.
    Obs.of = function (x, eq) {
        if (eq === void 0) { eq = null; }
        eq = (eq ? eq : hasSimpleType(x) ? Obs.defaultEq : Obs.alwaysUpdate);
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
    var hasSimpleType = function (x) {
        var typeofX = typeof (x);
        return typeofX === "number" ||
            typeofX === "string" ||
            typeofX === "boolean";
    };
    // Create a computed observable.
    Obs.fn = function (f, eq) {
        if (eq === void 0) { eq = Obs.defaultEq; }
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
    // Decide if an object is observable or not.
    // This just tests whether the object has an 'id' property.
    Obs.isObservable = function (obs) {
        return !!obs.id;
    };
    // Decide if an observable is computed or not.
    // This just tests whether the object has a 'fn' property.
    Obs.isComputed = function (obs) {
        return !!obs.fn;
    };
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
    var readOrWriteObs = function (obs, eq, newX, argc) {
        if (argc) {
            if (obs.fn)
                throw new Error("Computed observables cannot be assigned to.");
            trace("Updating obs", obs.id);
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
        trace("  Enqueueing obs", obs.id);
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
        trace("    UpdateQ =", JSON.stringify(updateQ.map(function (x) { return x.id; })));
    };
    var dequeueUpdate = function () {
        if (!updateQ.length)
            return undefined;
        var obs = updateQ[0];
        obs.isInUpdateQueue = false;
        trace("  Dequeueing obs", obs.id);
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
        trace("Reevaluating obs", obs.id, "...");
        var oldCurrentDependencies = currentDependencies;
        currentDependencies = obs.dependencies;
        breakDependencies(obs);
        var hasChanged = tryReevaluateObsFn(obs);
        establishDependencies(obs);
        currentDependencies = oldCurrentDependencies;
        if (hasChanged)
            updateDependents(obs);
        trace("Reevaluating obs", obs.id, "done.");
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
            trace("  Obs", obsID, "depends on obs", obsDepcy.id);
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
    // Debugging.
    var trace = function () {
        if (!debug)
            return;
        if (!window.console || !window.console.log)
            return;
        console.log.apply(console, arguments);
    };
})(Obs || (Obs = {}));
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
var Od;
(function (Od) {
    var debug = true;
    Od.text = function (text) {
        return ({ text: isNully(text) ? "" : text.toString() });
    };
    ;
    // Construct a vDOM node.
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
    // Construct a component node from a function computing a vDOM node.
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
    // Construct a static DOM subtree from an HTML string.
    // Note: this vDOM node can, like DOM nodes, only appear
    // in one place in the resulting DOM!  If you need copies,
    // you need duplicate fromHtml instances.
    Od.fromHtml = function (html) {
        // First, turn the HTML into a DOM tree.
        var tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        var dom = tmp.firstChild;
        // We create a pretend component to host the HTML.
        var vdom = { obs: staticHtmlObs, subs: staticHtmlSubs, dom: dom };
        return vdom;
    };
    // Take a DOM subtree directly.
    // Note: this vDOM node can, like DOM nodes, only appear
    // in one place in the resulting DOM!  If you need copies,
    // you need duplicate fromDom instances.
    Od.fromDom = function (dom) {
        // We create a pretend component to host the HTML.
        var vdom = { obs: staticHtmlObs, subs: staticHtmlSubs, dom: dom };
        return vdom;
    };
    // Bind a vDOM node to a DOM node.  For example,
    // Od.bind(myVdom, document.body.getElementById("foo"));
    Od.bind = function (vdom, dom) {
        var domParent = dom.parentNode;
        Od.patchDom(vdom, dom, domParent);
    };
    // Bind a vDOM node to a DOM node as new child.  For example,
    // Od.appendChild(myVdom, document.body);
    Od.appendChild = function (vdom, domParent) {
        var dom = null;
        Od.patchDom(vdom, dom, domParent);
    };
    // Normally, component updates will be batched via requestAnimationFrame
    // (i.e., they will occur at most once per display frame).  Setting this
    // to false ensures updates happen eagerly (i.e., they will not be
    // deferred).
    Od.deferComponentUpdates = true;
    // ---- Implementation detail. ----
    var isArray = function (x) { return x instanceof Array; };
    var isNully = function (x) { return x === null || x === undefined; };
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
        var newElt = (!elt || elt.tagName !== tag || domBelongsToComponent(elt)
            ? document.createElement(tag)
            : elt);
        if (newElt !== elt)
            trace("  Created", tag);
        patchProps(newElt, vdomPropDict);
        patchChildren(newElt, vdomChildren);
        replaceNode(newElt, dom, domParent);
        return newElt;
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
        if (!vdomChildren)
            vdomChildren = emptyIVdomList;
        if (elt.keyed)
            reorderKeyedChildren(vdomChildren, elt);
        var eltChildren = elt.childNodes;
        var numEltChildren = eltChildren.length;
        var numVdomChildren = vdomChildren.length;
        // Remove any extraneous existing children.
        // We do this first, and backwards, because removing a child node
        // changes the indices of any succeeding children.
        for (var i = numEltChildren - 1; numVdomChildren <= i; i--) {
            var eltChild = eltChildren[i];
            replaceNode(null, eltChild, elt);
            trace("Removed child", i + 1);
        }
        // Patch or add the number of required children.
        for (var i = 0; i < numVdomChildren; i++) {
            trace("Patching child", i + 1);
            var vdomChild = vdomChildren[i];
            var eltChild = eltChildren[i];
            Od.patchDom(vdomChild, eltChild, elt);
            trace("Patched child", i + 1);
        }
    };
    // A common vDOM optimisation for supporting lists is to associate
    // each list item with a key property.  Keyed child nodes are reordered
    // to suit the vDOM before patching.  This can dramatically reduce
    // DOM node creation when, say, the list order changes or an item
    // is removed.  In Od we further insist that the parent element have
    // the property 'keyed: true'.
    var reorderKeyedChildren = function (vdomChildren, dom) {
        trace("  Reordering keyed children.");
        var vChildren = vdomChildren; // This is safe.
        var domFirstChild = dom.firstChild;
        var numVChildren = vChildren.length;
        if (numVChildren === 0 || !domFirstChild)
            return;
        // Construct a mapping from keys to DOM nodes.
        var keyToDom = {};
        for (var domI = dom.firstChild; domI; domI = domI.nextSibling) {
            var keyI = domI.key;
            if (isNully(keyI))
                return; // We insist that all children have keys.
            keyToDom[keyI] = domI;
        }
        // Reorder the DOM nodes to match the vDOM order, unless
        // we need to insert a new node.
        var domI = dom.firstChild;
        for (var i = 0; i < numVChildren; i++) {
            var vdomI = vChildren[i];
            var vTagI = vdomI.tag;
            if (isNully(vTagI) && vdomI.dom)
                vTagI = vdomI.dom.nodeName;
            if (!vTagI)
                return; // This only works for ordinary elements.
            var vKeyI = vdomPropsKey(vdomI.props);
            if (isNully(vKeyI))
                return;
            var dKeyI = domI && domI.key;
            var domVKeyI = keyToDom[vKeyI];
            if (domI) {
                if (dKeyI === vKeyI) {
                    domI = domI.nextSibling;
                }
                else if (domVKeyI) {
                    dom.insertBefore(domVKeyI, domI);
                }
                else {
                    dom.insertBefore(document.createElement(vTagI), domI);
                }
            }
            else if (domVKeyI) {
                dom.appendChild(domVKeyI);
            }
            else {
                dom.appendChild(document.createElement(vTagI));
            }
        }
    };
    // This is used for the static HTML constructors to pretend they're
    // derived from observables.
    var staticHtmlObs = Obs.of(null);
    var staticHtmlSubs = null;
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
    var emptyPropList = [];
    // We attach lists of (ordered) property names to elements so we can
    // perform property updates in O(n) time.
    var getEltPropList = function (elt) {
        return elt.__Od__props;
    };
    var setEltPropList = function (elt, propList) {
        elt.__Od__props = propList;
    };
    var lookupPropsAssocList = function (props, key) {
        if (!props)
            return null;
        var iTop = props.length;
        for (var i = 0; i < iTop; i += 2) {
            if (props[i] === key)
                return props[i + 1];
        }
        return null;
    };
    var vdomPropsKey = function (props) {
        return lookupPropsAssocList(props, "key");
    };
    var getDomComponent = function (dom) {
        return dom.__Od__component;
    };
    var setDomComponent = function (dom, component) {
        if (dom)
            dom.__Od__component = component;
    };
    var domBelongsToComponent = function (dom) {
        return !!getDomComponent(dom);
    };
    function updateComponent() {
        var component = this;
        var dom = component.dom;
        // If a DOM node is already associated with the component, we
        // can defer the patching operation (which is nicer for the
        // web browser).
        if (dom) {
            enqueueComponentForPatching(component);
            return;
        }
        // Otherwise we have to establish the association up front.
        var vdom = component.obs();
        var domParent = dom && dom.parentNode;
        setDomComponent(dom, null);
        var newDom = Od.patchDom(vdom, dom, domParent);
        setDomComponent(newDom, component);
        component.dom = newDom;
    }
    // We defer DOM updates using requestAnimationFrame.  It's better to
    // batch DOM updates where possible.
    var requestAnimationFrameSubstitute = function (callback) {
        return setTimeout(callback, 16); // 16 ms = 1/60 s.
    };
    var requestAnimationFrame = window.requestAnimationFrame || requestAnimationFrameSubstitute;
    var componentsAwaitingUpdate = [];
    var requestAnimationFrameID = 0;
    var enqueueComponentForPatching = function (component) {
        if (!Od.deferComponentUpdates) {
            patchUpdatedComponent(component);
            return;
        }
        componentsAwaitingUpdate.push(component);
        if (requestAnimationFrameID)
            return;
        requestAnimationFrameID = requestAnimationFrame(patchQueuedComponents);
    };
    var patchQueuedComponents = function () {
        // Ensure we don't patch the same component twice, should it have
        // been updated more than once.
        var patchedComponents = {};
        var iTop = componentsAwaitingUpdate.length;
        for (var i = 0; i < iTop; i++) {
            var component_1 = componentsAwaitingUpdate[i];
            var id = component_1.obs.id;
            if (patchedComponents[id])
                continue;
            trace("Patching queued component #", id);
            patchUpdatedComponent(component_1);
            patchedComponents[id] = true;
        }
        // Clear the queue.
        componentsAwaitingUpdate = [];
        // Tell enqueueComponentForPatching that it needs to make a
        // new RAF request on the next update.
        requestAnimationFrameID = 0;
    };
    var patchUpdatedComponent = function (component) {
        var vdom = component.obs();
        var dom = component.dom;
        var domParent = dom && dom.parentNode;
        if (domWillBeReplaced(vdom, dom)) {
            // Component DOM nodes don't get stripped by default.
            setDomComponent(dom, null);
            enqueueNodeForStripping(dom);
        }
        else {
            // Component DOM nodes don't get patched by default.
            setDomComponent(dom, null);
        }
        var newDom = Od.patchDom(vdom, dom, domParent);
        setDomComponent(newDom, component);
        component.dom = newDom;
    };
    // A DOM node will be replaced by a new DOM structure if it
    // cannot be adjusted to match the corresponding vDOM node.
    var domWillBeReplaced = function (vdom, dom) {
        if (!dom)
            return false;
        if (typeof (vdom) === "string")
            return dom.nodeType !== Node.TEXT_NODE;
        return dom.nodeName !== vdom.tag;
    };
    // We track DOM nodes we've discarded so we can clean them up, remove
    // dangling event handlers and that sort of thing.  We do this in
    // the background to reduce the time between patching the DOM and
    // handing control back to the browser so it can re-paint.
    var nodesPendingStripping = [];
    var enqueueNodeForStripping = function (dom) {
        if (!dom)
            return;
        if (domBelongsToComponent(dom))
            return; // Can't touch this!
        trace("  Discarded", dom.nodeName || "#text");
        nodesPendingStripping.push(dom);
        if (stripNodesID)
            return;
        stripNodesID = setTimeout(stripNodes, 100);
    };
    var stripNodesID = 0;
    var stripNodes = function () {
        var dom = nodesPendingStripping.pop();
        while (dom) {
            stripNode(dom);
            var dom = nodesPendingStripping.pop();
        }
    };
    var stripNode = function (dom) {
        // We don't want to strip anything owned by a sub-component.
        if (domBelongsToComponent(dom))
            return; // Can't touch this!
        // Strip any properties...
        var props = getEltPropList(dom) || [];
        var numProps = props.length;
        for (var i = 0; i < numProps; i++)
            dom[props[i]] = undefined;
        // Recursively strip any child nodes.
        var children = dom.childNodes;
        var numChildren = children.length;
        for (var i = 0; i < numChildren; i++)
            stripNode(children[i]);
    };
    // Decide how a DOM node should be replaced.
    var replaceNode = function (newDom, oldDom, domParent) {
        if (!newDom) {
            if (!oldDom)
                return;
            enqueueNodeForStripping(oldDom);
            if (domParent)
                domParent.removeChild(oldDom);
        }
        else {
            if (!oldDom) {
                trace("  Inserted", newDom.nodeName || "#text");
                if (domParent)
                    domParent.appendChild(newDom);
            }
            else {
                if (newDom === oldDom)
                    return;
                enqueueNodeForStripping(oldDom);
                if (!domParent)
                    return;
                trace("  Inserted", newDom.nodeName || "#text");
                if (domParent)
                    domParent.replaceChild(newDom, oldDom);
            }
        }
    };
    // Debugging.
    var trace = function () {
        if (!debug)
            return;
        if (!window.console || !window.console.log)
            return;
        console.log.apply(console, arguments);
    };
})(Od || (Od = {}));
// Od version of ThreadIt.
//
// This is about thirty lines longer than the Mithril implementation, but,
// unlike the Mithril version (as of 2016-03-15):
// - this has full asynchronous activity reporting and error handling;
// - implements its own rudimentary router (~10 LOC);
// - implements its own AJAX request scheme (~40 LOC).
// In practice the latter two would certainly be handled by an external
// library.
//
// What's interesting about Od is that view components update independently
// without requiring a complete rebuild of the entire vDOM.
var State;
(function (State) {
    State[State["LoadingThreads"] = 0] = "LoadingThreads";
    State[State["LoadingThreadsFailed"] = 1] = "LoadingThreadsFailed";
    State[State["ShowingThreads"] = 2] = "ShowingThreads";
    State[State["LoadingComments"] = 3] = "LoadingComments";
    State[State["LoadingCommentsFailed"] = 4] = "LoadingCommentsFailed";
    State[State["ShowingComments"] = 5] = "ShowingComments";
})(State || (State = {}));
var currentState = Obs.of(State.LoadingThreads);
var threads = [];
var commentDict = {};
var addNewComment = function (newComment) {
    var id = newComment.id;
    var parentID = newComment.parent_id;
    commentDict[id] = newComment;
    newComment.child_comments = Obs.of([]);
    var parentComment = parentID && commentDict[parentID];
    if (parentComment) {
        var parentChildComments = parentComment.child_comments();
        parentChildComments.push(newComment);
        parentComment.child_comments(parentChildComments);
    }
};
var updateCommentDict = function (newComments) {
    newComments.forEach(addNewComment);
};
var currentThreadID = null; // Set if viewing comments for a thread.
var e = Od.element;
var view = Od.component(function () {
    var vdom = null;
    switch (currentState()) {
        case State.LoadingThreads:
            vdom = "Loading threads...";
            break;
        case State.LoadingThreadsFailed:
            return e("DIV", null, [
                "There was an error loading the top-level threads.",
                e("P", null, e("A", { onclick: function () { fetchThreads(); } }, "Retry"))
            ]);
            break;
        case State.ShowingThreads:
            vdom = viewThreads(threads);
            break;
        case State.LoadingComments:
            vdom = "Loading thread comments...";
            break;
        case State.LoadingCommentsFailed:
            vdom = e("DIV", null, [
                "There was an error loading the thread comments.",
                e("P", null, e("A", { onclick: function () { fetchComments(currentThreadID); } }, "Retry"))
            ]);
            break;
        case State.ShowingComments:
            var currentThread = commentDict[currentThreadID];
            vdom = viewCommentTree(currentThread);
            break;
    }
    return e("DIV", { className: "main" }, vdom);
});
var viewThreads = function (threads) {
    var vdoms = [];
    var iTop = threads.length;
    for (var i = 0; i < iTop; i++) {
        var thread = threads[i];
        vdoms.push(e("A", { href: "#thread/" + thread.id }, thread.text));
        vdoms.push(e("P", { className: "comment_count" }, plural(thread.comment_count, "comment")));
        vdoms.push(e("HR"));
    }
    // XXX Add new thread post box.
    return vdoms;
};
var viewCommentTree = function (comment) {
    var vdom = e("DIV", { className: "comment" }, [
        e("P", null, comment.text),
        e("DIV", { className: "reply" }, commentReply(comment.id)),
        e("DIV", { className: "children" }, comment.child_comments().map(viewCommentTree))
    ]);
    return vdom;
};
var ReplyState;
(function (ReplyState) {
    ReplyState[ReplyState["NotReplying"] = 0] = "NotReplying";
    ReplyState[ReplyState["EditingReply"] = 1] = "EditingReply";
    ReplyState[ReplyState["SendingReply"] = 2] = "SendingReply";
    ReplyState[ReplyState["ReplyFailed"] = 3] = "ReplyFailed";
})(ReplyState || (ReplyState = {}));
var commentReply = function (parentID) {
    var replyText = Obs.of("");
    var replyState = Obs.of(ReplyState.NotReplying);
    return Od.component(function () {
        switch (replyState()) {
            case ReplyState.NotReplying: return (e("A", {
                onclick: function () { replyState(ReplyState.EditingReply); }
            }, "Reply!"));
            case ReplyState.EditingReply: return (e("FORM", null, [
                e("TEXTAREA", {
                    oninput: function (e) { replyText(e.target.value); }
                }),
                e("INPUT", {
                    type: "submit",
                    value: "Reply!",
                    onclick: function () {
                        submitReply(parentID, replyText, replyState);
                    }
                }),
                e("DIV", { className: "preview" }, replyText())
            ]));
            case ReplyState.SendingReply: return (e("DIV", null, [
                e("A", null, "Sending reply..."),
                e("DIV", { className: "preview" }, replyText())
            ]));
            case ReplyState.ReplyFailed: return (e("DIV", null, [
                e("A", {
                    onclick: function () {
                        submitReply(parentID, replyText, replyState);
                    }
                }, "Sending reply failed...  Retry"),
                e("DIV", { className: "preview" }, replyText())
            ]));
        }
    });
};
var submitReply = function (parentID, replyText, replyState) {
    replyState(ReplyState.SendingReply);
    //sendTestReply(parentID, replyText(),
    POST("http://api.threaditjs.com/comments/create", { parent: parentID, text: replyText() }, function (newComment) {
        replyText("");
        addNewComment(newComment);
        replyState(ReplyState.NotReplying);
    }, function (e) {
        replyState(ReplyState.ReplyFailed);
    });
};
var plural = function (n, singular, plural) {
    return n.toString() + " " +
        (n === 1 ? singular : (plural || singular + "s"));
};
var fetchThreads = function () {
    // Testing code for now.
    currentState(State.LoadingThreads);
    //fetchTestThreads(
    GET("http://api.threaditjs.com/threads", function (newThreads) {
        threads = newThreads;
        currentState(State.ShowingThreads);
    }, function () {
        currentState(State.LoadingThreadsFailed);
    });
};
var fetchComments = function (id) {
    // Testing code for now.
    currentThreadID = id;
    currentState(State.LoadingComments);
    //fetchTestComments(id,
    GET("http://api.threaditjs.com/comments/" + id, function (threadComments) {
        commentDict = {};
        updateCommentDict(threadComments);
        currentState(State.ShowingComments);
    }, function () {
        currentState(State.LoadingCommentsFailed);
    });
};
// Basic AJAX.
var GET = function (url, pass, fail) {
    SEND("GET", url, null, pass, fail);
};
var POST = function (url, body, pass, fail) {
    SEND("POST", url, body, pass, fail);
};
var SEND = function (method, url, body, pass, fail) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onreadystatechange = function () {
        if (xhr.readyState != XMLHttpRequest.DONE)
            return;
        try {
            var package = JSON.parse(xhr.responseText);
            if (!("data" in package))
                throw (xhr.responseText);
            pass(package.data);
        }
        catch (e) {
            fail(e);
        }
    };
    xhr.send(JSON.stringify(body));
};
// ---- Routing. ----
// This is a *really* simple router!
var processLocationHash = function () {
    var hash = window.location.hash.substr(1);
    var parts = hash.split("/");
    switch (parts[0]) {
        case "thread":
            fetchComments(parts[1]);
            return;
        default:
            fetchThreads();
            return;
    }
};
// ---- Get the show on the road. ----
var main = function () {
    Od.appendChild(view, document.body);
    window.onhashchange = processLocationHash;
    processLocationHash();
};
window.onload = function () {
    main();
};
// ---- Testing code. ----
var fetchTestThreads = function (pass, fail) {
    setTimeout(function () {
        if (Math.random() < 0.1) {
            fail("Disaster!");
            return;
        }
        var threads = genTestThreads(7);
        pass(threads);
    }, 200);
};
var fetchTestComments = function (threadID, pass, fail) {
    setTimeout(function () {
        if (Math.random() < 0.1) {
            fail("Calamity!");
            return;
        }
        var thread = {
            id: threadID,
            text: "Blah blah blah " + threadID,
            children: [],
            comment_count: 0
        };
        var threadComments = genTestComments(3, 3, thread.id);
        var children = threadComments.filter(function (x) { return x.parent_id === threadID; }).map(function (x) { return x.id; });
        thread.children = children;
        thread.comment_count = children.length;
        threadComments.unshift(thread);
        pass(threadComments);
    }, 200);
};
var sendTestReply = function (parentID, replyText, pass, fail) {
    setTimeout(function () {
        if (Math.random() < 0.4) {
            fail("Ragnarok!");
            return;
        }
        var comment = {
            id: (nextTestCommentID++).toString(),
            text: replyText,
            children: [],
            comment_count: 0,
            parent_id: parentID
        };
        pass(comment);
    }, 200);
};
var nextTestCommentID = 1;
var genTestThreads = function (maxThreads) {
    if (maxThreads === void 0) { maxThreads = 7; }
    var threads = [];
    var numThreads = 1 + Math.floor(maxThreads * Math.random());
    for (var i = 0; i < numThreads; i++) {
        var id = (nextTestCommentID++).toString();
        var thread = {
            id: id,
            text: "Blah blah blah " + id,
            children: [],
            comment_count: Math.floor(Math.random() * 5)
        };
        threads.push(thread);
    }
    return threads;
};
var genTestComments = function (maxChildren, maxDepth, parentID) {
    if (maxChildren === void 0) { maxChildren = 3; }
    if (maxDepth === void 0) { maxDepth = 1; }
    if (parentID === void 0) { parentID = null; }
    var comments = [];
    var id = (nextTestCommentID++).toString();
    var subComments = [];
    if (1 < maxDepth)
        for (var i = Math.floor(maxChildren * Math.random()); i; i--) {
            var subSubComments = genTestComments(maxChildren, maxDepth - 1, id);
            for (var j = 0; j < subSubComments.length; j++)
                subComments.push(subSubComments[j]);
        }
    var children = subComments.filter(function (x) { return x.parent_id === id; }).map(function (x) { return x.id; });
    var numChildren = children.length;
    var comment = {
        id: id,
        parent_id: parentID,
        text: "Blah blah blah " + id,
        comment_count: numChildren,
        children: children
    };
    comments.push(comment);
    for (var j = 0; j < subComments.length; j++)
        comments.push(subComments[j]);
    return comments;
};
//# sourceMappingURL=app.js.map