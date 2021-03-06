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
    // Create a mutable observable.  The default equality test is ===.
    // This, of course, cannot spot changes to the contents of objects
    // and arrays.  In those cases, you may need Obs.updateDependents.
    Obs.of = function (x, eq) {
        if (eq === void 0) { eq = null; }
        eq = eq || Obs.defaultEq;
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
        return obs && obs.obsid && (obs instanceof Function);
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
        return "{obs " + (this.id || "") + " = " + valueStr + "}";
    };
    // Break the connection between an observable and its dependencies.
    Obs.dispose = function (obs) {
        var obsAny = obs;
        obsAny.value = null;
        breakDependencies(obsAny);
        obsAny.dependents = {};
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
    var clearDomComponentInfo = function (dom) {
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
        // console.log("Od: creating component", name, cmptID);
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
            // if (name !== "log") console.log("Od: updating component", name, cmptID);
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
        // Check that we haven't been given another component's DOM subtree.
        if (domComponentInfo(dom) != null)
            throw new Error("Od components must have distinct root DOM nodes.");
        // Mark this DOM subtree as belonging to this component.
        setDomComponentInfo(dom, cmptInfo);
        // Fire off any creation events.
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
        clearDomComponentInfo(dom); // So patching will apply internally.
        var newDom = patchFromVdom(obs(), dom, parent);
        setDomComponentInfo(newDom, cmptInfo); // Restore DOM ownership.
        cmptInfo.dom = newDom;
        cmptInfo.updateIsPending = false;
        parentComponentInfo = oldParentComponentInfo;
    };
    var disposeComponent = function (cmptInfo) {
        disposeAnonymousSubcomponents(cmptInfo);
        disposeNamedSubcomponents(cmptInfo);
        Obs.dispose(cmptInfo.subs);
        Obs.dispose(cmptInfo.obs);
        var dom = cmptInfo.dom;
        var domRemove = dom && dom.remove;
        //if (domRemove != null) domRemove.call(dom);
        clearDomComponentInfo(dom);
        // console.log("Od: disposing component and enqueuing node for stripping.", cmptInfo.name || "");
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
        // console.log("Updating deferred components...");
        var cmptInfos = componentInfosPendingUpdate;
        for (var cmptInfo = cmptInfos.pop(); cmptInfo != null; cmptInfo = cmptInfos.pop()) {
            updateComponent(cmptInfo);
        }
        runPendingOdEventCallbacks();
        deferredComponentUpdatesID = 0;
        // console.log("Updating deferred components done.");
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
            // console.log("Not stripping component node:", dom, domComponentInfo(dom));
            //if (cmptInfo.hasOdEventHandlers && cmptInfo.isAttached) propagateAttachmentDown(dom, false);
            updateIsAttached(cmptInfo, false);
            return;
        }
        // Strip any properties...
        var props = getEltOdProps(dom);
        if (props == null)
            return; // This has already been deleted or is not an Od node.
        setEltOdProps(dom, null);
        var lifecycleFn = odEventHandler(props);
        if (lifecycleFn)
            lifecycleFn("removed", dom);
        var anyDom = dom;
        for (var prop in props)
            stripProperty(anyDom, prop);
        // Recursively strip any child nodes.
        var children = dom.childNodes;
        var numChildren = children.length;
        for (var i = 0; i < numChildren; i++)
            stripNode(children[i]);
    };
    // We strip node properties to avoid space leaks.
    // This can only happen when the property value is a closure or
    // other object.  Note: we particularly want to avoid clearing
    // certain string properties (see, e.g., https://gtmetrix.com/avoid-empty-src-or-href.html)
    // because setting them, even to null, can trigger browsers to
    // doing something in response, which we clearly don't intend here!
    var stripProperty = function (dom, prop) {
        if (dom[prop] instanceof Object)
            dom[prop] = null;
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

// Elements.ts
//
// This library provides some handy syntactic sugar.  Rather than writing
// any of
//
//  Od.element("HR")
//  Od.element("DIV", null, [children...])
//  Od.element("A", { href: "..." }, [children...])
//  Od.element("INPUT", { type: "text" })
//
// you can write the somewhat more perspicuous
//
//  Od.HR()
//  Od.DIV([children...])
//  Od.A({ href: "..." }, [children...])
//  Od.INPUT({ type: "text" })
// 
/// <reference path="../Od/Od.ts"/>
var Od;
(function (Od) {
    var elt = function (tag, fst, snd) {
        return (typeof (fst) === "object" && !(fst instanceof Array)
            ? Od.element(tag, fst, Od.flattenVdoms(snd))
            : Od.element(tag, null, Od.flattenVdoms(fst)));
    };
    // This approach is short, but sweet.
    ["A",
        "ABBR",
        "ACRONYM",
        "ADDRESS",
        "APPLET",
        "AREA",
        "ARTICLE",
        "ASIDE",
        "AUDIO",
        "B",
        "BASE",
        "BASEFONT",
        "BDI",
        "BDO",
        "BGSOUND",
        "BIG",
        "BLINK",
        "BLOCKQUOTE",
        "BODY",
        "BR",
        "BUTTON",
        "CANVAS",
        "CAPTION",
        "CENTER",
        "CITE",
        "CODE",
        "COL",
        "COLGROUP",
        "COMMAND",
        "CONTENT",
        "DATA",
        "DATALIST",
        "DD",
        "DEL",
        "DETAILS",
        "DFN",
        "DIALOG",
        "DIR",
        "DIV",
        "DL",
        "DT",
        "ELEMENT",
        "EM",
        "EMBED",
        "FIELDSET",
        "FIGCAPTION",
        "FIGURE",
        "FONT",
        "FOOTER",
        "FORM",
        "FRAME",
        "FRAMESET",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "HEAD",
        "HEADER",
        "HGROUP",
        "HR",
        "HTML",
        "I",
        "IFRAME",
        "IMAGE",
        "IMG",
        "INPUT",
        "INS",
        "ISINDEX",
        "KBD",
        "KEYGEN",
        "LABEL",
        "LEGEND",
        "LI",
        "LINK",
        "LISTING",
        "MAIN",
        "MAP",
        "MARK",
        "MARQUEE",
        "MENU",
        "MENUITEM",
        "META",
        "METER",
        "MULTICOL",
        "NAV",
        "NOBR",
        "NOEMBED",
        "NOFRAMES",
        "NOSCRIPT",
        "OBJECT",
        "OL",
        "OPTGROUP",
        "OPTION",
        "OUTPUT",
        "P",
        "PARAM",
        "PICTURE",
        "PLAINTEXT",
        "PRE",
        "PROGRESS",
        "Q",
        "RP",
        "RT",
        "RTC",
        "RUBY",
        "S",
        "SAMP",
        "SCRIPT",
        "SECTION",
        "SELECT",
        "SHADOW",
        "SMALL",
        "SOURCE",
        "SPACER",
        "SPAN",
        "STRIKE",
        "STRONG",
        "STYLE",
        "SUB",
        "SUMMARY",
        "SUP",
        "TABLE",
        "TBODY",
        "TD",
        "TEMPLATE",
        "TEXTAREA",
        "TFOOT",
        "TH",
        "THEAD",
        "TIME",
        "TITLE",
        "TR",
        "TRACK",
        "TT",
        "U",
        "UL",
        "VAR",
        "VIDEO",
        "WBR",
        "XMP"
    ].forEach(function (tag) {
        Od[tag] = function (fst, snd) { return elt(tag, fst, snd); };
    });
})(Od || (Od = {}));

// Jigsaw - a simple location-hash router.
var Jigsaw;
(function (Jigsaw) {
    // ---- Public interface. ----
    // A route is a possibly-empty set of "parts" separated by '/' slashes.
    // Each route part is matched against the corresponding part of the
    // window location hash, stripped of its leading '#' character.
    //
    // Parts match as follows:
    //  xyx     -   Must match the exact string "xyz" (case sensitive);
    //  :foo    -   Required parameter, matches anything;
    //  ?bar    -   Optional parameter, matches anything;
    //  *baz    -   Parameter matching all remaining parts of the hash.
    //
    // A successful matching results in the corresponding route handler
    // being called with a dictionary mapping parameters to argument values.
    //
    // Parameter names are exactly as written (i.e., they include the leading
    // character indicating the parameter kind).  Argument values are all
    // simple strings (preprocessed via decodeURIComponent), except for
    // '*' parameters, whose values are arrays of such.
    //
    // Two special parameters are added to the dictionary: "#" is the
    // original location hash and "?" is any query string (which you may
    // choose to process via parseQuery).
    //
    // Routes are tested in the order in which they were added, the first
    // match taking priority.
    //
    Jigsaw.addRoute = function (route, handler) {
        var compiledRoute = {
            route: route,
            matcher: routeMatcher(route),
            handler: handler
        };
        compiledRoutes.push(compiledRoute);
    };
    Jigsaw.removeRoute = function (route) {
        compiledRoutes = compiledRoutes.filter(function (x) { return x.route === route; });
    };
    Jigsaw.clearRoutes = function () {
        compiledRoutes = [];
    };
    // If no route matches, the default route handler will be called
    // if one has been specified.
    //
    Jigsaw.defaultRouteHandler = null;
    Jigsaw.takeRoute = function (hash) {
        var queryIdx = hash.lastIndexOf("?");
        var query = "";
        if (queryIdx !== -1) {
            query = hash.substr(queryIdx + 1);
            hash = hash.substr(0, queryIdx);
        }
        var parts = (!hash ? [] : hash.split("/").map(decodeURIComponent));
        for (var i = 0; i < compiledRoutes.length; i++) {
            var compiledRoute = compiledRoutes[i];
            var args = compiledRoute.matcher(parts, 0, {});
            if (args) {
                // Success!
                args["#"] = hash;
                args["?"] = query;
                if (query != null)
                    args["?"] = query;
                compiledRoute.handler(args);
                return;
            }
        }
        // Nooooo...
        if (Jigsaw.defaultRouteHandler)
            Jigsaw.defaultRouteHandler(hash);
    };
    Jigsaw.startRouter = function () {
        window.addEventListener("hashchange", processHash);
    };
    Jigsaw.stopRouter = function () {
        window.removeEventListener("hashchange", processHash);
    };
    // A utility function to convert query strings into key/value
    // dictionaries.
    Jigsaw.parseQuery = function (query) {
        var pairs = (query || "").replace(/\+/g, " ").split(/[&;]/);
        var args = {};
        pairs.forEach(function (pair) {
            var i = pair.indexOf("=");
            if (i === -1)
                i = pair.length;
            var key = pair.substr(0, i);
            var value = decodeURIComponent(pair.substr(i + 1));
            args[key] = value;
        });
        return args;
    };
    // ---- Implementation detail. ----
    var previousHash = null;
    // Rapid changes to the location hash can cause the application
    // to receive multiple onhashchange events, but each receiving only
    // the very latest hash.  We "debounce" that behaviour here.
    var processHash = function () {
        var hash = location.hash.substr(1);
        if (hash === previousHash)
            return;
        Jigsaw.takeRoute(hash);
        previousHash = hash;
    };
    var matchEnd = function (parts, i, args) { return (parts[i] == null) && args; };
    // '.../foo/...'
    var matchExact = function (word, cont) { return function (parts, i, args) {
        return (parts[i] === word) && cont(parts, i + 1, args);
    }; };
    // '.../:bar/...'
    var matchParam = function (param, cont) { return function (parts, i, args) {
        var arg = parts[i];
        if (arg == null)
            return null;
        args[param] = arg;
        return cont(parts, i + 1, args);
    }; };
    // '.../?baz/...'
    var matchOptParam = function (param, cont) { return function (parts, i, args) {
        var arg = parts[i];
        args[param] = arg;
        return cont(parts, i + 1, args);
    }; };
    // '.../*quux'
    var matchRest = function (param, cont) { return function (parts, i, args) {
        args[param] = parts.slice(i);
        return cont(parts, parts.length, args);
    }; };
    var routeMatcher = function (route) {
        if (!route)
            return matchEnd;
        var params = route.split("/");
        var matcher = matchEnd;
        for (var i = params.length - 1; 0 <= i; i--) {
            var param = params[i];
            switch (param[0]) {
                case ":":
                    matcher = matchParam(param, matcher);
                    continue;
                case "?":
                    matcher = matchOptParam(param, matcher);
                    continue;
                case "*":
                    matcher = matchRest(param, matcher);
                    continue;
                default:
                    matcher = matchExact(param, matcher);
                    continue;
            }
        }
        return matcher;
    };
    var compiledRoutes = [];
})(Jigsaw || (Jigsaw = {}));

var Oath;
(function (Oath) {
    var nextID = 1;
    Oath.resolve = function (x) {
        return Oath.make(function (pass, fail) { return pass(x); });
    };
    Oath.reject = function (r) {
        return Oath.make(function (pass, fail) { return fail(r); });
    };
    Oath.all = function (ps) {
        return Oath.make(function (pass, fail) {
            var xs = [];
            var n = ps.length;
            ps.forEach(function (p, i) {
                p.then(function (x) { xs[i] = x; if (!--n)
                    pass(xs); });
            });
        });
    };
    Oath.race = function (ps) {
        return Oath.make(function (pass, fail) {
            var done = false;
            ps.forEach(function (p, i) {
                p.then(function (x) { if (!done)
                    pass(x); done = true; });
            });
        });
    };
    Oath.delay = function (t, f) {
        return Oath.make(function (pass, fail) {
            setTimeout(function () {
                pass(isFunction(f) ? f() : f);
            }, t);
        });
    };
    var isFunction = function (x) {
        return x instanceof Function;
    };
    var isThenable = function (x) {
        return x && isFunction(x.then);
    };
    Oath.make = function (setup) {
        var p = {
            value: null,
            state: pending,
            onFulfilled: null,
            onRejected: null,
            then: null,
            id: nextID++
        };
        // console.log("Oath: created", p.id);
        var pass = function (x) { return resolveOath(p, x); };
        var fail = function (r) { return rejectOath(p, r); };
        setup(pass, fail);
        p.then =
            function (passed, failed) {
                return Oath.make(function (pass, fail) {
                    p.state(p, passed, failed, pass, fail);
                });
            };
        return p;
    };
    var resolveOath = function (p, x) {
        if (p.state !== pending)
            return;
        p.state = fulfilled;
        p.value = x;
        if (p.onFulfilled)
            setTimeout(p.onFulfilled, 0, x);
        p.onFulfilled = null;
        // console.log("Oath: resolved", p.id);
    };
    var rejectOath = function (p, r) {
        if (p.state !== pending)
            return;
        p.state = rejected;
        p.value = r;
        if (p.onRejected)
            setTimeout(p.onRejected, 0, r);
        p.onRejected = null;
        // console.log("Oath: rejected", p.id);
    };
    var pending = function (p, passed, failed, pass, fail) {
        var onF = p.onFulfilled;
        p.onFulfilled = function (x) {
            if (onF)
                onF(x);
            if (passed)
                handleCallback(p, passed, pass, fail);
            else
                pass(x);
        };
        var onR = p.onRejected;
        p.onRejected = function (r) {
            if (onR)
                onR(r);
            if (failed)
                handleCallback(p, failed, pass, fail);
            else
                fail(r);
        };
    };
    var fulfilled = function (p, passed, failed, pass, fail) {
        if (passed)
            setTimeout(handleCallback, 0, p, passed, pass, fail);
    };
    var rejected = function (p, passed, failed, pass, fail) {
        if (failed)
            setTimeout(handleCallback, 0, p, failed, pass, fail);
    };
    var handleCallback = function (p, f, pass, fail) {
        try {
            if (!isFunction(f))
                return;
            // console.log("Oath: evaluating callback on", p.id);
            var x = p.value;
            var y = f(x);
            if (y === p)
                throw new TypeError("Cyclic promise.");
            if (isThenable(y))
                y.then(pass, fail);
            else
                pass(y);
        }
        catch (r) {
            fail(r);
        }
    };
})(Oath || (Oath = {}));

/// <reference path="./Oath.ts"/>
var Xhr;
(function (Xhr) {
    // send(url, opts)
    //
    // Make an XMLHttpRequest to the given URL with the provided options.
    // The result is a promise which will be fulfilled with the XMLHttpRequest
    // if the request succeeds (i.e., the status code is in 200..299) or
    // rejected with the XMLHttpRequest if the request fails (i.e., the status
    // code is anything else).
    // 
    Xhr.send = function (url, opts) {
        if (opts === void 0) { opts = {}; }
        var xhr = new XMLHttpRequest();
        var method = opts.method || "GET";
        var async = (opts.async !== false);
        var user = opts.user;
        var password = opts.password;
        xhr.open(method, url, async, user, password);
        var requestHeaders = opts.requestHeaders;
        if (requestHeaders)
            for (var header in requestHeaders) {
                var value = requestHeaders[header];
                xhr.setRequestHeader(header, value);
            }
        if (opts.timeout != null)
            xhr.timeout = opts.timeout;
        if (opts.withCredentials != null)
            xhr.withCredentials = opts.withCredentials;
        if (opts.onprogress)
            xhr.addEventListener("progress", opts.onprogress);
        if (opts.overrideMimeType)
            xhr.overrideMimeType(opts.overrideMimeType);
        var promise = Oath.make(function (pass, fail) {
            xhr.onreadystatechange = readyStateChangeHandler(xhr, pass, fail);
        });
        xhr.send(opts.data);
        return promise;
    };
    var readyStateChangeHandler = function (xhr, pass, fail) { return function (v) {
        if (xhr.readyState !== 4 /* DONE */)
            return;
        (200 <= xhr.status && xhr.status < 300 ? pass : fail)(xhr);
    }; };
})(Xhr || (Xhr = {}));