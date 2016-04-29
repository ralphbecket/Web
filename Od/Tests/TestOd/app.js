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
        return "{obs " + (this.id || "") + " = " + valueStr + "}";
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
var Od;
(function (Od) {
    // XXX This is to help diagnose Mihai's bug.
    // Set to -ve to process immediately.
    // Otherwise Od events will be processed with this setTimeout delay.
    var processPendingOdEventsDelay = -1;
    var debug = false;
    ;
    Od.text = function (text) {
        return ({ isIVdom: true, text: isNully(text) ? "" : text.toString() });
    };
    // Construct a vDOM node.
    Od.element = function (tag, props, childOrChildren) {
        tag = tag.toUpperCase();
        var children = (!childOrChildren
            ? null
            : isArray(childOrChildren)
                ? childOrChildren
                : [childOrChildren]);
        return { isIVdom: true, tag: tag, props: props, children: children };
    };
    Od.component = function (name, fn) {
        var existingVdom = existingNamedComponentInstance(name);
        if (existingVdom)
            return existingVdom;
        var component = {
            isIVdom: true,
            obs: null,
            subcomponents: null,
            dom: null
        };
        component.obs = Obs.fn(function () { return updateComponent(component, fn); });
        // Attach this component as a subcomponent of the parent context.
        addAsSubcomponentOfParent(name, component);
        return component;
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
            isIVdom: true,
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
            isIVdom: true,
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
        var node = Od.patchDom(vdom, dom, domParent);
        return node;
    };
    // Bind a vDOM node to a DOM node as new child.  For example,
    // Od.appendChild(myVdom, document.body);
    Od.appendChild = function (vdom, domParent) {
        var dom = null;
        var node = Od.patchDom(vdom, dom, domParent);
        return node;
    };
    // Dispose of a component, removing any observable dependencies
    // it may have.  This also removes the component's DOM from the
    // DOM tree.
    Od.dispose = function (component) {
        if (!component)
            return;
        var obs = component.obs;
        if (obs) {
            Obs.dispose(obs);
            component.obs = null;
        }
        var dom = component.dom;
        if (dom) {
            lifecycleHooks("removed", dom);
            // We have to remove the component reference before stripping.
            setDomComponent(dom, null);
            enqueueNodeForStripping(dom);
            component.dom = null;
        }
        var subcomponents = component.subcomponents;
        if (subcomponents) {
            disposeSubcomponents(subcomponents);
            component.subcomponents = null;
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
        if (newDom.nodeValue !== newText)
            newDom.nodeValue = newText;
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
        var vdomProps = vdom.props;
        var vdomChildren = vdom.children;
        var elt = dom;
        var newElt = (!elt || elt.tagName !== tag || domBelongsToComponent(elt)
            ? document.createElement(tag)
            : elt);
        if (newElt !== elt)
            trace("  Created", tag);
        patchProps(newElt, vdomProps);
        patchChildren(newElt, vdomChildren);
        replaceNode(newElt, dom, domParent);
        return newElt;
    };
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
                elt.style = null;
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
    var patchChildren = function (elt, vdomChildren) {
        if (!vdomChildren)
            vdomChildren = [];
        if (elt.keyed)
            reorderKeyedChildren(vdomChildren, elt);
        var eltChild = elt.firstChild;
        var numVdomChildren = vdomChildren.length;
        // Patch or add the number of required children.
        for (var i = 0; i < numVdomChildren; i++) {
            trace("Patching child", i + 1);
            var vdomChild = vdomChildren[i];
            var nextChild = Od.patchDom(vdomChild, eltChild, elt).nextSibling;
            eltChild = nextChild;
            trace("Patched child", i + 1);
        }
        // Remove any extraneous children.
        while (eltChild) {
            var nextSibling = eltChild.nextSibling;
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
    var getEltOdProps = function (elt) {
        return elt.__Od__props;
    };
    var setEltOdProps = function (elt, props) {
        elt.__Od__props = props;
    };
    var vdomPropsKey = function (props) {
        return props && props["key"];
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
    var updateComponent = function (component, fn) {
        // If the component has anonymous subcomponents, we should dispose
        // of them now -- they will be recreated by fn if needed.  Named
        // subcomponents will persist.
        disposeAnonymousSubcomponents(component);
        // Evaluate the vDOM function with this component as the parent for
        // any sub-components it generates.
        var tmp = parentComponent;
        parentComponent = component;
        var vdom = fn();
        parentComponent = tmp;
        // If a DOM node is already associated with the component, we
        // can defer the patching operation (which is nicer for the
        // web browser).
        if (!component.dom) {
            var dom = Od.patchDom(vdom, null, null);
            setDomComponent(dom, component);
            component.dom = dom;
            lifecycleHooks("created", dom);
        }
        else {
            // The updated lifecycle hooks will be invoked here.
            enqueueComponentForPatching(component, vdom);
        }
        return vdom;
    };
    // The current parent component scope, if any.
    var parentComponent = null;
    var existingNamedComponentInstance = function (name) {
        return (name != null) &&
            parentComponent &&
            parentComponent.subcomponents &&
            parentComponent.subcomponents[name];
    };
    var anonymousSubcomponentsKey = "__OdAnonymousSubcomponents__";
    var addAsSubcomponentOfParent = function (name, child) {
        if (!parentComponent)
            return;
        if (!parentComponent.subcomponents)
            parentComponent.subcomponents = {};
        var subcomponents = parentComponent.subcomponents;
        if (name != null) {
            // This is a named sub-component which will persist for the
            // lifetime of the parent component.
            subcomponents[name] = child;
        }
        else {
            // This child has no name.  Aww.  In this case we store a list
            // of these nameless children under a special name.
            var anonSubcomponents = subcomponents[anonymousSubcomponentsKey];
            if (!anonSubcomponents) {
                subcomponents[anonymousSubcomponentsKey] = [child];
            }
            else {
                anonSubcomponents.push(child);
            }
        }
    };
    var disposeAnonymousSubcomponents = function (component) {
        var anonymousSubcomponents = component.subcomponents &&
            component.subcomponents[anonymousSubcomponentsKey];
        if (!anonymousSubcomponents)
            return;
        anonymousSubcomponents.forEach(Od.dispose);
        component.subcomponents[anonymousSubcomponentsKey] = null;
    };
    var disposeSubcomponents = function (subcomponents) {
        for (var name in subcomponents) {
            var subcomponent = subcomponents[name];
            if (name === anonymousSubcomponentsKey) {
                // These are anonymous subcomponents, kept in an list.
                subcomponent.forEach(Od.dispose);
            }
            else {
                Od.dispose(subcomponent);
            }
        }
    };
    // We defer DOM updates using requestAnimationFrame.  It's better to
    // batch DOM updates where possible.
    var requestAnimationFrameSubstitute = function (callback) {
        return setTimeout(callback, processPendingOdEventsDelay); // 16 ms = 1/60 s.
    };
    var requestAnimationFrame = window.requestAnimationFrame || requestAnimationFrameSubstitute;
    var componentsAwaitingUpdate = [];
    var requestAnimationFrameID = 0;
    var enqueueComponentForPatching = function (component, vdom) {
        if (!Od.deferComponentUpdates) {
            patchUpdatedComponent(component, vdom);
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
        // Any pending Od events are also processed here.
        if (processPendingOdEventsDelay < 0)
            processPendingOdEvents();
        if (processPendingOdEventsDelay >= 0)
            setTimeout(processPendingOdEvents, 0);
    };
    var patchUpdatedComponent = function (component, vdom) {
        vdom = (vdom != null ? vdom : component.obs());
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
        lifecycleHooks("updated", newDom);
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
        var props = getEltOdProps(dom);
        for (var prop in props)
            dom[prop] = null;
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
    // Some component nodes will have life-cycle hooks to call.
    var lifecycleHooks = function (what, dom) {
        var props = dom && getEltOdProps(dom);
        var hook = props && props["onodevent"];
        if (!hook)
            return;
        pendingLifecycleCallbacks.push(function () { return hook(what, dom); });
        if (pendingOdEventsID)
            return;
        // Either there will be a requestAnimationFrame call due in
        // 16ms or this will fire in 20ms.  We would prefer the RAF
        // call to handle the pending Od events because then the
        // callbacks will see the corresponding events in their proper
        // DOM contexts.
        pendingOdEventsID = setTimeout(processPendingOdEvents, 20);
    };
    var pendingOdEventsID = 0;
    var pendingLifecycleCallbacks = [];
    // We process Od lifecycle events after the DOM has had a chance to
    // rearrange itself.
    var processPendingOdEvents = function () {
        for (var i = 0; i < pendingLifecycleCallbacks.length; i++)
            pendingLifecycleCallbacks[i]();
        pendingLifecycleCallbacks = [];
        pendingOdEventsID = 0;
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
var Test;
(function (Test) {
    Test.passedTestsID = "passed";
    Test.failedTestsID = "failed";
    Test.addPassReport = function (name) {
        addReport(Test.passedTestsID, name);
    };
    Test.addFailureReport = function (name, e) {
        var msg = ": " + (typeof (e) === "string" ? e : JSON.stringify(e));
        if (e === null || e === undefined || e === "")
            msg = "";
        addReport(Test.failedTestsID, name + msg);
    };
    var addReport = function (id, msg) {
        var div = document.getElementById(id);
        var p = document.createElement("P");
        p.textContent = msg;
        div.appendChild(p);
    };
    Test.expect = function (what, cond) {
        if (!cond)
            throw what;
    };
    Test.run = function (name, action) {
        try {
            window.console && window.console.log("---- " + name + " ----");
            action();
            Test.addPassReport(name);
        }
        catch (e) {
            var what = (typeof (e) === "string" ? e : JSON.stringify(e));
            Test.addFailureReport(name, what);
        }
    };
    Test.runDeferred = function (timeoutInMS, name, action) {
        var completed = false;
        var pass = function () {
            if (completed)
                return;
            Test.addPassReport(name);
            completed = true;
        };
        var expect = function (what, cond) {
            if (completed)
                return;
            if (cond)
                return;
            Test.addFailureReport(name, what);
            completed = true;
        };
        setTimeout(function () {
            if (completed)
                return;
            expect("timed out", false);
        }, timeoutInMS);
        try {
            action(pass, expect);
        }
        catch (e) {
            expect(e.message, false);
        }
    };
})(Test || (Test = {}));
/// <reference path="../../Od/Od.ts"/>
/// <reference path="../TestHarness/Test.ts"/>
window.onload = function () {
    Od.deferComponentUpdates = false; // Deferred updates make testing harder.
    var e = Od.element;
    var t = Od.text;
    var d = function (v) { return Od.patchDom(v, null, null); };
    var nav = function (dom, path) {
        var iTop = path.length;
        for (var i = 0; i < iTop; i++) {
            dom = dom.childNodes[path[i]];
            if (!dom)
                throw "Node does not match path " + JSON.stringify(path);
        }
        return dom;
    };
    var chk = function (dom, path, tag, numChildren, props) {
        var dom = nav(dom, path);
        var textMatches = (dom.nodeType === Node.TEXT_NODE) &&
            (tag[0] === "#") &&
            (dom.textContent === tag.substr(1));
        var tagMatches = (dom.tagName === tag);
        if (!textMatches && !tagMatches)
            throw "Node tag is not " + tag;
        if (numChildren != undefined && dom.childNodes.length != numChildren)
            throw "Node does not have " + numChildren + " children.";
        return chkProps(dom, props);
    };
    var chkProps = function (dom, props) {
        if (!props)
            return true;
        for (var key in props) {
            var value = props[key];
            if ((value && dom[key] !== value))
                throw "Node does not have expected value for " + key;
            if ((!value && dom[key]))
                throw "Node has unexpected value for " + key;
        }
        return true;
    };
    var same = function (x, y) {
        if (x === y)
            return true;
        throw ("Nodes should be identical.");
    };
    var diff = function (x, y) {
        if (x !== y)
            return true;
        throw ("Nodes should be different.");
    };
    Test.run("Patch xyz vs null", function () {
        var A = "xyz";
        var B = null;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "#xyz");
    });
    Test.run("Patch xyz vs pqr", function () {
        var A = "xyz";
        var B = d("pqr");
        var C = Od.patchDom(A, B, null);
        chk(C, [], "#xyz");
        same(B, C);
    });
    Test.run("Patch xyz vs xyz", function () {
        var A = "xyz";
        var B = d("xyz");
        var C = Od.patchDom(A, B, null);
        chk(C, [], "#xyz");
        same(B, C);
    });
    Test.run("Patch xyz vs DIV", function () {
        var A = "xyz";
        var B = d(e("DIV"));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "#xyz");
        diff(B, C);
    });
    Test.run("Patch DIV(xyz) vs null", function () {
        var A = e("DIV", null, "xyz");
        var B = null;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
    });
    Test.run("Patch DIV(xyz) vs pqr", function () {
        var A = e("DIV", null, "xyz");
        var B = d("pqr");
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        diff(B, C);
    });
    Test.run("Patch DIV(xyz) vs DIV(pqr)", function () {
        var A = e("DIV", null, "xyz");
        var B = d(e("DIV", null, "pqr"));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        same(B, C);
    });
    Test.run("Patch DIV(xyz) vs P", function () {
        var A = e("DIV", null, "xyz");
        var B = d(e("P"));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        diff(B, C);
    });
    Test.run("Patch DIV vs DIV(pqr, qrs)", function () {
        var A = e("DIV");
        var B = d(e("DIV", null, ["pqr", "qrs"]));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 0);
        same(B, C);
    });
    Test.run("Patch DIV(xyz) vs DIV(pqr, qrs)", function () {
        var A = e("DIV", null, "xyz");
        var B = d(e("DIV", null, ["pqr", "qrs"]));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        same(B, C);
    });
    Test.run("Patch DIV(xyz, wxy) vs DIV(pqr)", function () {
        var A = e("DIV", null, ["xyz", "wxy"]);
        var B = d(e("DIV", null, "pqr"));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 2);
        chk(C, [0], "#xyz");
        chk(C, [1], "#wxy");
        same(B, C);
    });
    Test.run("Patch Cmpt(DIV(xyz) -> DIV(wxy)) vs null", function () {
        var text = Obs.of("xyz");
        var cmpt = Od.component(null, function () { return e("DIV", null, text()); });
        var A = cmpt;
        var B = null;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        text("wxy");
        chk(C, [], "DIV", 1);
        chk(C, [0], "#wxy");
    });
    Test.run("Patch DIV(Cmpt(DIV), Cmpt(P)) -> DIV(Cmpt(P), Cmpt(DIV)) vs null", function () {
        var X = Od.component(null, function () { return e("DIV"); });
        var Y = Od.component(null, function () { return e("P"); });
        var A1 = e("DIV", null, [X, Y]);
        var B = null;
        var C1 = Od.patchDom(A1, B, null);
        chk(C1, [], "DIV", 2);
        var C10 = nav(C1, [0]);
        var C11 = nav(C1, [1]);
        chk(C10, [], "DIV", 0);
        chk(C11, [], "P", 0);
        var A2 = e("DIV", null, [Y, X]);
        var C2 = Od.patchDom(A2, C1, null);
        chk(C2, [], "DIV", 2);
        var C20 = nav(C2, [0]);
        var C21 = nav(C2, [1]);
        chk(C20, [], "P", 0);
        chk(C21, [], "DIV", 0);
        same(C10, C21);
        same(C11, C20);
    });
    Test.run("Patch Cmpt(DIV(P(xyz) -> pqr)) vs null", function () {
        var X = e("P", null, "xyz");
        var T = Obs.of(true);
        var A = Od.component(null, function () { return e("DIV", null, T() ? X : "pqr"); });
        var B = null;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "P", 1);
        chk(C, [0, 0], "#xyz");
        T(false);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#pqr");
    });
    Test.run("Deleting the DOM of a live component.", function () {
        var X = Obs.of("Hi!");
        var A = Od.component(null, function () { return e("DIV", null, X()); });
        var B = null;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#Hi!");
        A.dom = null;
        X("Bye.");
        var D = Od.patchDom(A, B, null);
        chk(D, [], "DIV", 1);
        chk(D, [0], "#Bye.");
    });
    Test.run("Keyed lists.", function () {
        var x = e("P", { key: "x" });
        var y = e("SPAN", { key: "y" });
        var z = e("TABLE", { key: "z" });
        var A1 = e("DIV", { keyed: true }, [x, y, z]);
        var B = null;
        var C = Od.patchDom(A1, B, null);
        chk(C, [], "DIV", 3);
        chk(C, [0], "P");
        chk(C, [1], "SPAN");
        chk(C, [2], "TABLE");
        var C0 = nav(C, [0]);
        var C1 = nav(C, [1]);
        var C2 = nav(C, [2]);
        var A2 = e("DIV", { keyed: true }, [y, z, x]);
        var D = Od.patchDom(A2, C, null);
        chk(D, [], "DIV", 3);
        chk(D, [0], "SPAN");
        chk(D, [1], "TABLE");
        chk(D, [2], "P");
        var D0 = nav(D, [0]);
        var D1 = nav(D, [1]);
        var D2 = nav(D, [2]);
        same(C0, D2);
        same(C1, D0);
        same(C2, D1);
    });
    Test.run("Dom from HTML strings.", function () {
        var X = Od.fromHtml("<H4>xyz<SPAN>pqr</SPAN></H4>");
        var A = e("DIV", null, X);
        var B = null;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "H4", 2);
        chk(C, [0, 0], "#xyz");
        chk(C, [0, 1], "SPAN", 1);
        chk(C, [0, 1, 0], "#pqr");
    });
    Test.run("Style properties.", function () {
        var A1 = e("DIV", null, "xyz");
        var B = null;
        var C = Od.patchDom(A1, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        Test.expect("Initial colour is not set.", C.style.color === "");
        var A2 = e("DIV", {
            style: { color: "red" }
        });
        Od.patchDom(A2, C, null);
        Test.expect("Colour is now red.", C.style.color === "red");
        var A3 = e("DIV", {
            style: { color: "blue" }
        });
        Od.patchDom(A3, C, null);
        Test.expect("Colour is now blue.", C.style.color === "blue");
        var A4 = e("DIV", {
            style: null
        });
        Od.patchDom(A4, C, null);
        Test.expect("Colour is not set again.", C.style.color === "");
    });
    Test.runDeferred(1000, "Anonymous components", function (pass, expect) {
        var X = Obs.of(false);
        var nCreated = 0;
        var nUpdated = 0;
        var nDeleted = 0;
        var handler = function (what, e) {
            switch (what) {
                case "created":
                    nCreated++;
                    break;
                case "updated":
                    nUpdated++;
                    break;
                case "removed":
                    nDeleted++;
                    break;
            }
        };
        var A1 = Od.component("A1", function () {
            return X() ? Od.component(null, function () { return e("DIV", { onodevent: handler }); })
                : Od.component(null, function () { return e("P", { onodevent: handler }); });
        });
        var B = null;
        var C = Od.patchDom(A1, B, null);
        X(true);
        X(false);
        setTimeout(function () {
            expect("Num removed", nDeleted === 2);
            expect("Num created", nCreated === 3);
        }, 200);
    });
    Test.run("Attrs properties", function () {
        var A1 = e("DIV", {
            attrs: { "data-bind": "foo", "ng-xyz": "bar" }
        });
        var B = null;
        var C1 = Od.patchDom(A1, B, null);
        chk(C1, [], "DIV", 0);
        Test.expect("Has data-bind", C1.getAttribute("data-bind") === "foo");
        Test.expect("Has ng-xyz", C1.getAttribute("ng-xyz") === "bar");
        var A2 = e("DIV", {
            attrs: { "ng-xyz": "baz" }
        });
        var C2 = Od.patchDom(A2, C1, null);
        chk(C1, [], "DIV", 0);
        Test.expect("Has no data-bind", C1.getAttribute("data-bind") == null);
        Test.expect("Has ng-xyz", C1.getAttribute("ng-xyz") === "baz");
    });
};
