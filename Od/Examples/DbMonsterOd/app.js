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
// Forcing re-evaluation of dependents:
//
//      Obs.updateDependents(x);
//          All dependents of x will be re-evaluated.  This is occasionally
//          useful if the type of x is such that it is infeasible or
//          inefficient to exactly detect updates (typically when the type
//          of x is not observable and non-trivial).
//
// Observable identities:
//
//      x.id is the unique numeric identifier for observable x.
//
// Disposal:
//
//      Obs.dispose(x)
//          Breaks the connection between x and any of its dependencies and
//          sets its value to undefined.  This is sometimes necessary to
//          prevent garbage retention, since a dependency link is a two-way
//          relation.
//
var Obs;
(function (Obs) {
    // The public interface.
    var debug = false;
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
        var obs = null;
        // We need 'function' so we can use 'arguments'.  Sorry.
        obs = (function (newX) {
            return readOrWriteObs(obs, eq, newX, arguments.length);
        });
        obs.obsid = nextID++;
        obs.value = x;
        obs.toString = obsToString;
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
        var obs = null;
        // We need 'function' so we can use 'arguments'.  Sorry.
        obs = (function (newX) {
            return readOrWriteObs(obs, eq, newX, arguments.length);
        });
        obs.obsid = nextID++;
        obs.fn = function () { return updateComputedObs(obs, f, eq); };
        obs.dependencies = {};
        obs.toString = obsToString;
        reevaluateComputedObs(obs);
        return obs;
    };
    // Peek at the value of an observable without establishing a dependency.
    Obs.peek = function (obs) { return obs.value; };
    // Decide if an object is observable or not.
    // This just tests whether the object is a function with an 'obsid' property.
    Obs.isObservable = function (obs) {
        return obs && obs.obsid && (typeof (obs) === "function");
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
            currentDependencies = null; // Suspend dependency tracking.
            action();
            currentDependencies = tmp;
        };
        var obs = subsAction;
        var id = nextID++;
        // Set this up as a dependency of its subscriptions.
        var subscriptions = obss;
        for (var i = 0; i < subscriptions.length; i++) {
            var obsAnyI = subscriptions[i];
            if (!obsAnyI.dependents)
                obsAnyI.dependents = {};
            obsAnyI.dependents[id] = obs;
        }
        ;
        obs.obsid = id;
        obs.fn = subsAction;
        obs.value = "{subscription}"; // For obsToString;
        obs.toString = obsToString;
        obs.subscriptions = subscriptions;
        obs.level = 999999999; // Ensure subscriptions run last.
        return obs;
    };
    Obs.value = function (ish) {
        return Obs.isObservable(ish) ? ish() : ish;
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
    // Break the connection between an observable and its dependencies.
    Obs.dispose = function (obs) {
        var obsAny = obs;
        obsAny.value = null;
        breakDependencies(obsAny);
        obsAny.dependents = null;
        // Break any dependencies if this is a subscription.
        var id = obsAny.obsid;
        var subscriptions = obsAny.subscriptions;
        if (!subscriptions)
            return;
        for (var i = 0; i < subscriptions.length; i++) {
            var subscription = subscriptions[i];
            var subscriptionDependents = subscription.dependents;
            if (!subscriptionDependents)
                continue;
            subscriptionDependents[id] = null;
        }
        obsAny.subscriptions = null;
    };
    var readOrWriteObs = function (obs, eq, newX, argc) {
        if (argc) {
            if (obs.fn)
                throw new Error("Computed observables cannot be assigned to.");
            trace("Updating obs", obs.obsid);
            var oldX = obs.value;
            obs.value = newX;
            if (!eq(oldX, newX))
                Obs.updateDependents(obs);
        }
        else {
            // This is a read -- we need to record it as a dependency.
            if (currentDependencies)
                currentDependencies[obs.obsid] = obs;
        }
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
        trace("  Enqueueing obs", obs.obsid);
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
        trace("    UpdateQ =", JSON.stringify(updateQ.map(function (x) { return x.obsid; })));
    };
    var dequeueUpdate = function () {
        if (!updateQ.length)
            return undefined;
        var obs = updateQ[0];
        obs.isInUpdateQueue = false;
        trace("  Dequeueing obs", obs.obsid);
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
    var currentDependencies = null;
    var reevaluateComputedObs = function (obs) {
        trace("Reevaluating obs", obs.obsid, "...");
        var oldCurrentDependencies = currentDependencies;
        currentDependencies = obs.dependencies;
        breakDependencies(obs);
        var hasChanged = tryReevaluateObsFn(obs);
        establishDependencies(obs);
        currentDependencies = oldCurrentDependencies;
        if (hasChanged)
            Obs.updateDependents(obs);
        trace("Reevaluating obs", obs.obsid, "done.");
    };
    // Break the connection between a computed observable and its dependencies
    // prior to reevaluating its value (reevaluation may change the set of
    // dependencies).
    var breakDependencies = function (obs) {
        var obsID = obs.obsid;
        var dependencies = obs.dependencies;
        if (!dependencies)
            return;
        for (var id in dependencies) {
            var obsDepcy = dependencies[id];
            if (!obsDepcy)
                continue;
            dependencies[id] = null;
            obsDepcy.dependents[obsID] = null;
        }
    };
    // Establish a connection with observables used while reevaluating a
    // computed observable.
    var establishDependencies = function (obs) {
        var obsID = obs.obsid;
        var dependencies = obs.dependencies;
        var obsLevel = 0;
        for (var id in dependencies) {
            var obsDepcy = dependencies[id];
            if (!obsDepcy)
                continue;
            if (!obsDepcy.dependents)
                obsDepcy.dependents = {};
            obsDepcy.dependents[obsID] = obs;
            trace("  Obs", obsID, "depends on obs", obsDepcy.obsid);
            var obsDepcyLevel = obsDepcy.level | 0;
            if (obsLevel <= obsDepcyLevel)
                obsLevel = 1 + obsDepcyLevel;
        }
        obs.level = obsLevel;
    };
    // After an observable has been updated, we need to also update its
    // dependents in level order.
    Obs.updateDependents = function (obs) {
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
// Every "dynamic" DOM subtree (i.e., something that can change as the
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
    var debug = false;
    ;
    Od.text = function (text) {
        return ({ text: isNully(text) ? "" : text.toString() });
    };
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
        return Od.namedComponent(null, fn);
    };
    // A named component persists within the scope of the component within
    // which it is defined.  That is, the parent component can be re-evaluated,
    // but any named child components will persist from the original
    // construction of the parent, rather than being recreated.  Passing a
    // falsy name is equivalent to calling the plain 'component' function.
    Od.namedComponent = function (name, fn) {
        var existingVdom = existingNamedComponentInstance(name);
        if (existingVdom)
            return existingVdom;
        var obs = (Obs.isObservable(fn)
            ? fn
            : Obs.fn(fn));
        var vdom = {
            obs: obs,
            subscription: null,
            subcomponents: null,
            dom: null
        };
        var subs = Obs.subscribe([obs], updateComponent.bind(vdom));
        vdom.subscription = subs;
        // Attach this component as a subcomponent of the parent context.
        addAsParentSubcomponent(name, vdom);
        // Set the component context for the component body.
        var tmp = parentSubcomponents;
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
    var parentSubcomponents = null;
    var existingNamedComponentInstance = function (name) {
        return name &&
            parentSubcomponents &&
            parentSubcomponents[name];
    };
    var addAsParentSubcomponent = function (name, child) {
        if (!parentSubcomponents)
            parentSubcomponents = {};
        if (name) {
            parentSubcomponents[name] = child;
            return;
        }
        // Otherwise, this child has no name.  Aww.  In this case we
        // store a list of these nameless children under the special name "".
        if (!("" in parentSubcomponents))
            parentSubcomponents[""] = [];
        parentSubcomponents[""].push(child);
    };
    // Construct a static DOM subtree from an HTML string.
    // Note: this vDOM node can, like DOM nodes, only appear
    // in one place in the resulting DOM!  If you need copies,
    // you need duplicate fromHtml instances.
    Od.fromHtml = function (html) {
        // First, turn the HTML into a DOM tree.
        var tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        // If this is a bunch of nodes, return the whole DIV.
        var dom = (tmp.childNodes.length === 1 ? tmp.firstChild : tmp);
        // We create a pretend component to host the HTML.
        var vdom = {
            obs: staticHtmlObs,
            subscription: staticHtmlSubs,
            dom: dom
        };
        return vdom;
    };
    // Take a DOM subtree directly.
    // Note: this vDOM node can, like DOM nodes, only appear
    // in one place in the resulting DOM!  If you need copies,
    // you need duplicate fromDom instances.
    Od.fromDom = function (dom) {
        // We create a pretend component to host the HTML.
        var vdom = {
            obs: staticHtmlObs,
            subscription: staticHtmlSubs,
            dom: dom
        };
        return vdom;
    };
    // Bind a vDOM node to a DOM node.  For example,
    // Od.bind(myVdom, document.body.getElementById("foo"));
    // This will either update or replace the DOM node in question.
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
    // Dispose of a component, removing any observable dependencies
    // it may have.
    Od.dispose = function (vdom) {
        if (!vdom)
            return;
        if (vdom.obs) {
            Obs.dispose(vdom.obs);
            vdom.obs = null;
        }
        if (vdom.subscription) {
            Obs.dispose(vdom.subscription);
            vdom.subscription = null;
        }
        if (vdom.dom) {
            enqueueNodeForStripping(vdom.dom);
            vdom.dom = null;
        }
        if (vdom.subcomponents) {
            disposeSubcomponents(vdom.subcomponents);
            vdom.subcomponents = null;
        }
    };
    var disposeSubcomponents = function (subcomponents) {
        for (var name in subcomponents) {
            var subcomponent = subcomponents[name];
            if (name === "") {
                // These are anonymous subcomponents, kept in an list.
                subcomponent.forEach(Od.dispose);
            }
            else {
                Od.dispose(subcomponent);
            }
        }
    };
    // Normally, component updates will be batched via requestAnimationFrame
    // (i.e., they will occur at most once per display frame).  Setting this
    // to false ensures updates happen eagerly (i.e., they will not be
    // deferred).
    Od.deferComponentUpdates = true;
    // ---- Implementation detail. ----
    var isArray = function (x) { return x instanceof Array; };
    var isNully = function (x) { return x == null; };
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
        dom[prop] = null;
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
        // If the component has anonymous subcomponents, we should dispose
        // of them now -- they will be recreated if needed.  Named
        // subcomponents will persist.
        disposeAnonymousSubcomponents(component);
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
    var disposeAnonymousSubcomponents = function (vdom) {
        var anonymousSubcomponents = vdom.subcomponents && vdom.subcomponents[""];
        if (!anonymousSubcomponents)
            return;
        anonymousSubcomponents.forEach(Od.dispose);
        vdom.subcomponents[""] = null;
    };
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
            var id = component_1.obs.obsid;
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
            dom[props[i]] = null;
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
var DbMonsterOd;
(function (DbMonsterOd) {
    // Arguably, this is not the way you'd do this in practice.  However,
    // this whole exercise is artificial, in that we're showing pages of
    // data updating at high speed.  There's a good argument that if you
    // really do have to do that, then manipulate the DOM directly.  Still,
    // here is how you'd get top speed going via Od.  DO NOT take this as
    // representative of "idiomatic" Od!
    //
    var vdom = null;
    var obss = null;
    var update = function () {
        var keepIdentity = true;
        var rows = ENV.generateData(keepIdentity).toArray();
        if (vdom) {
            // We've already initialised the vDOM, we just need to update
            // the underlying observables which will trigger any required
            // DOM patching.
            //Obs.startUpdate(); // Batch all updates together.
            var i = 0;
            rows.forEach(function (row) {
                var lastSample = row.lastSample;
                obss[i++](lastSample.nbQueries.toString());
                obss[i++](lastSample.countClassName);
                var cols = lastSample.topFiveQueries;
                cols.forEach(function (col) {
                    obss[i++](col.query);
                    obss[i++](col.formatElapsed);
                    obss[i++](col.elapsedClassName);
                });
            });
        }
        else {
            // We're just getting started.  We need to set up the vDOM and
            // the observables on which it depends.  Since this is an high
            // speed application, we arrange for the minimal amount of
            // patching work to be redone with respect to each kind of update.
            // In practice, we'd be unlikely to go to such lengths.
            //
            // The approach used here is to make each thing which can update
            // independently into a separate component.  It is only when the
            // observables change on which a component depends that the
            // component (and its corresponding DOM subtree) will be updated.
            // Assigning the same value to an observable does not trigger an
            // update, an update will only trigger when an observable is
            // assigned a new value distinct from its previous one.
            //
            var e_1 = Od.element;
            obss = [];
            var tableRows = [];
            var i = 0;
            rows.forEach(function (row) {
                var lastSample = row.lastSample;
                var tableCols = [];
                tableCols.push(e_1("TD", { className: "dbname" }, row.dbname));
                var nbQueries = (obss[i++] = Obs.of(lastSample.nbQueries.toString()));
                var countClassName = (obss[i++] = Obs.of(lastSample.countClassName));
                tableCols.push(Od.component(function () {
                    return e_1("TD", { className: "query-count" }, e_1("SPAN", { className: countClassName() }, nbQueries()));
                }));
                var cols = lastSample.topFiveQueries;
                cols.forEach(function (col) {
                    var query = (obss[i++] = Obs.of(col.query));
                    var formatElapsed = (obss[i++] = Obs.of(col.formatElapsed));
                    var elapsedClassName = (obss[i++] = Obs.of(col.elapsedClassName));
                    var elapsedTextCmpt = Od.component(formatElapsed);
                    var popoverTextCmpt = Od.component(query);
                    var popoverCmpt = Od.component(function () {
                        return e_1("DIV", { className: "popover left" }, [
                            e_1("DIV", { className: "popover-content" }, popoverTextCmpt),
                            e_1("DIV", { className: "arrow" })
                        ]);
                    });
                    var elapsedCmpt = Od.component(function () {
                        return e_1("TD", { className: elapsedClassName() }, [
                            e_1("SPAN", null, elapsedTextCmpt),
                            popoverCmpt
                        ]);
                    });
                    tableCols.push(elapsedCmpt);
                });
                tableRows.push(e_1("TR", null, tableCols));
            });
            vdom =
                e_1("TABLE", { className: "table table-striped latest-data" }, [
                    e_1("TBODY", null, tableRows)
                ]);
            Od.appendChild(vdom, document.getElementById("app"));
        }
    };
    DbMonsterOd.run = function () {
        update();
        Monitoring.renderRate.ping();
        setTimeout(DbMonsterOd.run, ENV.timeout);
    };
})(DbMonsterOd || (DbMonsterOd = {}));
// Standard DbMonster Env.js file lightly adapted for TypeScript.
var ENV = ENV || (function () {
    var first = true;
    var counter = 0;
    var data;
    var _base;
    (_base = String.prototype).lpad || (_base.lpad = function (padding, toLength) {
        return padding.repeat((toLength - this.length) / padding.length).concat(this);
    });
    function formatElapsed(value) {
        var str = parseFloat(value).toFixed(2);
        if (value > 60) {
            var minutes = Math.floor(value / 60);
            var comps = (value % 60).toFixed(2).split('.');
            var seconds = comps[0].lpad('0', 2);
            var ms = comps[1];
            str = minutes + ":" + seconds + "." + ms;
        }
        return str;
    }
    function getElapsedClassName(elapsed) {
        var className = 'Query elapsed';
        if (elapsed >= 10.0) {
            className += ' warn_long';
        }
        else if (elapsed >= 1.0) {
            className += ' warn';
        }
        else {
            className += ' short';
        }
        return className;
    }
    function countClassName(queries) {
        var countClassName = "label";
        if (queries >= 20) {
            countClassName += " label-important";
        }
        else if (queries >= 10) {
            countClassName += " label-warning";
        }
        else {
            countClassName += " label-success";
        }
        return countClassName;
    }
    function updateQuery(object) {
        if (!object) {
            object = {};
        }
        var elapsed = Math.random() * 15;
        object.elapsed = elapsed;
        object.formatElapsed = formatElapsed(elapsed);
        object.elapsedClassName = getElapsedClassName(elapsed);
        object.query = "SELECT blah FROM something";
        object.waiting = Math.random() < 0.5;
        if (Math.random() < 0.2) {
            object.query = "<IDLE> in transaction";
        }
        if (Math.random() < 0.1) {
            object.query = "vacuum";
        }
        return object;
    }
    function cleanQuery(value) {
        if (value) {
            value.formatElapsed = "";
            value.elapsedClassName = "";
            value.query = "";
            value.elapsed = null;
            value.waiting = null;
        }
        else {
            return {
                query: "***",
                formatElapsed: "",
                elapsedClassName: ""
            };
        }
    }
    function generateRow(object, keepIdentity, counter) {
        var nbQueries = Math.floor((Math.random() * 10) + 1);
        if (!object) {
            object = {};
        }
        object.lastMutationId = counter;
        object.nbQueries = nbQueries;
        if (!object.lastSample) {
            object.lastSample = {};
        }
        if (!object.lastSample.topFiveQueries) {
            object.lastSample.topFiveQueries = [];
        }
        if (keepIdentity) {
            // for Angular optimization
            if (!object.lastSample.queries) {
                object.lastSample.queries = [];
                for (var l = 0; l < 12; l++) {
                    object.lastSample.queries[l] = cleanQuery();
                }
            }
            for (var j in object.lastSample.queries) {
                var value = object.lastSample.queries[j];
                if (j <= nbQueries) {
                    updateQuery(value);
                }
                else {
                    cleanQuery(value);
                }
            }
        }
        else {
            object.lastSample.queries = [];
            for (var k = 0; k < 12; k++) {
                if (k < nbQueries) {
                    var value = updateQuery(cleanQuery());
                    object.lastSample.queries.push(value);
                }
                else {
                    object.lastSample.queries.push(cleanQuery());
                }
            }
        }
        for (var i = 0; i < 5; i++) {
            var source = object.lastSample.queries[i];
            object.lastSample.topFiveQueries[i] = source;
        }
        object.lastSample.nbQueries = nbQueries;
        object.lastSample.countClassName = countClassName(nbQueries);
        return object;
    }
    function getData(keepIdentity) {
        var oldData = data;
        if (!keepIdentity) {
            data = [];
            for (var i = 1; i <= ENV.rows; i++) {
                data.push({ dbname: 'cluster' + i, query: "", formatElapsed: "", elapsedClassName: "" });
                data.push({ dbname: 'cluster' + i + ' slave', query: "", formatElapsed: "", elapsedClassName: "" });
            }
        }
        if (!data) {
            data = [];
            for (var i = 1; i <= ENV.rows; i++) {
                data.push({ dbname: 'cluster' + i });
                data.push({ dbname: 'cluster' + i + ' slave' });
            }
            oldData = data;
        }
        for (var j in data) {
            var row = data[j];
            if (!keepIdentity && oldData && oldData[j]) {
                row.lastSample = oldData[j].lastSample;
            }
            if (!row.lastSample || Math.random() < ENV.mutations()) {
                counter = counter + 1;
                if (!keepIdentity) {
                    row.lastSample = null;
                }
                generateRow(row, keepIdentity, counter);
            }
            else {
                data[j] = oldData[j];
            }
        }
        first = false;
        return {
            toArray: function () {
                return data;
            }
        };
    }
    var mutationsValue = 0.5;
    function mutations(value) {
        if (value) {
            mutationsValue = value;
            return mutationsValue;
        }
        else {
            return mutationsValue;
        }
    }
    var body = document.querySelector('body');
    var theFirstChild = body.firstChild;
    var sliderContainer = document.createElement('div');
    sliderContainer.style.cssText = "display: flex";
    var slider = document.createElement('input');
    var text = document.createElement('label');
    text.innerHTML = 'mutations : ' + (mutationsValue * 100).toFixed(0) + '%';
    text.id = "ratioval";
    slider.setAttribute("type", "range");
    slider.style.cssText = 'margin-bottom: 10px; margin-top: 5px';
    slider.addEventListener('change', function (e) {
        ENV.mutations(e.target.value / 100);
        document.querySelector('#ratioval').innerHTML = 'mutations : ' + (ENV.mutations() * 100).toFixed(0) + '%';
    });
    sliderContainer.appendChild(text);
    sliderContainer.appendChild(slider);
    body.insertBefore(sliderContainer, theFirstChild);
    return {
        generateData: getData,
        rows: 50,
        timeout: 0,
        mutations: mutations
    };
})();
/**
* @author mrdoob / http://mrdoob.com/
* @author jetienne / http://jetienne.com/
* @author paulirish / http://paulirish.com/
*/
var MemoryStats = function () {
    var msMin = 100;
    var msMax = 0;
    var container = document.createElement('div');
    container.id = 'stats';
    container.style.cssText = 'width:80px;opacity:0.9;cursor:pointer';
    var msDiv = document.createElement('div');
    msDiv.id = 'ms';
    msDiv.style.cssText = 'padding:0 0 3px 3px;text-align:left;background-color:#020;';
    container.appendChild(msDiv);
    var msText = document.createElement('div');
    msText.id = 'msText';
    msText.style.cssText = 'color:#0f0;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
    msText.innerHTML = 'Memory';
    msDiv.appendChild(msText);
    var msGraph = document.createElement('div');
    msGraph.id = 'msGraph';
    msGraph.style.cssText = 'position:relative;width:74px;height:30px;background-color:#0f0';
    msDiv.appendChild(msGraph);
    while (msGraph.children.length < 74) {
        var bar = document.createElement('span');
        bar.style.cssText = 'width:1px;height:30px;float:left;background-color:#131';
        msGraph.appendChild(bar);
    }
    var updateGraph = function (dom, height, color) {
        var child = dom.appendChild(dom.firstChild);
        child.style.height = height + 'px';
        if (color)
            child.style.backgroundColor = color;
    };
    var perf = (window.performance || {});
    // polyfill usedJSHeapSize
    if (!perf && !perf.memory) {
        perf.memory = { usedJSHeapSize: 0 };
    }
    if (perf && !perf.memory) {
        perf.memory = { usedJSHeapSize: 0 };
    }
    // support of the API?
    if (perf.memory.totalJSHeapSize === 0) {
        console.warn('totalJSHeapSize === 0... performance.memory is only available in Chrome .');
    }
    // TODO, add a sanity check to see if values are bucketed.
    // If so, reminde user to adopt the --enable-precise-memory-info flag.
    // open -a "/Applications/Google Chrome.app" --args --enable-precise-memory-info
    var lastTime = Date.now();
    var lastUsedHeap = perf.memory.usedJSHeapSize;
    return {
        domElement: container,
        update: function () {
            // refresh only 30time per second
            if (Date.now() - lastTime < 1000 / 30)
                return;
            lastTime = Date.now();
            var delta = perf.memory.usedJSHeapSize - lastUsedHeap;
            lastUsedHeap = perf.memory.usedJSHeapSize;
            var color = delta < 0 ? '#830' : '#131';
            var ms = perf.memory.usedJSHeapSize;
            msMin = Math.min(msMin, ms);
            msMax = Math.max(msMax, ms);
            msText.textContent = "Mem: " + bytesToSize(ms, 2);
            var normValue = ms / (30 * 1024 * 1024);
            var height = Math.min(30, 30 - normValue * 30);
            updateGraph(msGraph, height, color);
            function bytesToSize(bytes, nFractDigit) {
                var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                if (bytes == 0)
                    return 'n/a';
                nFractDigit = nFractDigit !== undefined ? nFractDigit : 0;
                var precision = Math.pow(10, nFractDigit);
                var i = Math.floor(Math.log(bytes) / Math.log(1024));
                return Math.round(bytes * precision / Math.pow(1024, i)) / precision + ' ' + sizes[i];
            }
            ;
        }
    };
};
var Monitoring = Monitoring || (function () {
    var stats = MemoryStats();
    stats.domElement.style.position = 'fixed';
    stats.domElement.style.right = '0px';
    stats.domElement.style.bottom = '0px';
    document.body.appendChild(stats.domElement);
    requestAnimationFrame(function rAFloop() {
        stats.update();
        requestAnimationFrame(rAFloop);
    });
    var RenderRate = function () {
        var container = document.createElement('div');
        container.id = 'stats';
        container.style.cssText = 'width:150px;opacity:0.9;cursor:pointer;position:fixed;right:80px;bottom:0px;';
        var msDiv = document.createElement('div');
        msDiv.id = 'ms';
        msDiv.style.cssText = 'padding:0 0 3px 3px;text-align:left;background-color:#020;';
        container.appendChild(msDiv);
        var msText = document.createElement('div');
        msText.id = 'msText';
        msText.style.cssText = 'color:#0f0;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
        msText.innerHTML = 'Repaint rate: 0/sec';
        msDiv.appendChild(msText);
        var bucketSize = 20;
        var bucket = [];
        var lastTime = Date.now();
        return {
            domElement: container,
            ping: function () {
                var start = lastTime;
                var stop = Date.now();
                var rate = 1000 / (stop - start);
                bucket.push(rate);
                if (bucket.length > bucketSize) {
                    bucket.shift();
                }
                var sum = 0;
                for (var i = 0; i < bucket.length; i++) {
                    sum = sum + bucket[i];
                }
                msText.textContent = "Repaint rate: " + (sum / bucket.length).toFixed(2) + "/sec";
                lastTime = stop;
            }
        };
    };
    var renderRate = RenderRate();
    document.body.appendChild(renderRate.domElement);
    return {
        memoryStats: stats,
        renderRate: renderRate
    };
})();
//# sourceMappingURL=app.js.map