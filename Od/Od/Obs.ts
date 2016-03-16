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

module Obs {

    // The public interface.

    const debug = false;

    export interface IObservableAny {
        // Every observable has a unique identity.
        id: number;
    }

    export interface IObservable<T> extends IObservableAny {
        (x?: T): T; // Attempting to update a computed observable is an error.
    }

    type EqualityTest<T> = (oldX: T, newX: T) => boolean;

    // The default equality test for observables.
    export const defaultEq = <T>(x: T, y: T) => x === y;

    // This is useful for Dates.
    export const valueOfEq = <T>(x: T, y: T) =>
        (x && y && x.valueOf() === y.valueOf()) ||
        (!x && !y);

    // The "equality test" for observables that always indicates a change.
    export const alwaysUpdate = <T>(x: T, y: T) => false;

    // Create a mutable observable.  The default equality test for 
    // numbers, strings, and booleans is ===, otherwise any update is
    // assumed to provide a different value, hence triggering any
    // dependents.
    export const of =
    <T>(x: T, eq: EqualityTest<T> = null): IObservable<T> => {

        eq = (eq ? eq : hasSimpleType(x) ? defaultEq : alwaysUpdate);
        var obs = undefined as Obs<T>;
        // We need 'function' so we can use 'arguments'.  Sorry.
        obs = (function (newX?: T): T {
            return readOrWriteObs(obs, eq, newX, arguments.length);
        }) as Obs<T>;
        obs.id = nextID++;
        obs.value = x;
        obs.toString = obsToString;

        return obs;
    };

    const hasSimpleType = (x: any): boolean => {
        var typeofX = typeof (x);
        return typeofX === "number" ||
            typeofX === "string" ||
            typeofX === "boolean";
    };

    // Create a computed observable.
    export const fn =
    <T>(f: () => T, eq: EqualityTest<T> = defaultEq): IObservable<T> => {

        var obs = undefined as Obs<T>;
        // We need 'function' so we can use 'arguments'.  Sorry.
        obs = (function (newX?: T): T {
            return readOrWriteObs(obs, eq, newX, arguments.length);
        }) as Obs<T>;
        obs.id = nextID++;
        obs.fn = () => updateComputedObs(obs, f, eq);
        obs.dependencies = {} as ObsSet;
        obs.toString = obsToString;
        reevaluateComputedObs(obs);

        return obs;
    };

    // Peek at the value of an observable without establishing a dependency.
    export const peek = <T>(obs: IObservable<T>): T => (obs as Obs<T>).value;

    // Decide if an object is observable or not.
    // This just tests whether the object has an 'id' property.
    export const isObservable = (obs: any): boolean =>
        !!(obs as ObsAny).id;

    // Decide if an observable is computed or not.
    // This just tests whether the object has a 'fn' property.
    export const isComputed = (obs: any): boolean =>
        !!(obs as ObsAny).fn;

    export interface ISubscription extends IObservable<void> { }

    // Create a subscription on a set of observables.  The action can read
    // any observables without establishing a dependency.  Subscriptions
    // run after all other affected computed observables have run.
    export const subscribe =
    (obss: IObservableAny[], action: () => void): ISubscription => {

        const subsAction = () => {
            var tmp = currentDependencies;
            currentDependencies = undefined; // Suspend dependency tracking.
            action();
            currentDependencies = tmp;
        };
        const obs = subsAction as any as Obs<void>;
        const id = nextID++;
        const subsDependencies = obss as ObsAny[];
        for (var i = 0; i < subsDependencies.length; i++) {
            const obsAnyI = subsDependencies[i];
            if (!obsAnyI.dependents) obsAnyI.dependents = {};
            obsAnyI.dependents[id] = obs;
        };
        obs.id = id;
        obs.fn = subsAction as any;
        obs.value = "{subscription}" as any as void; // For obsToString;
        obs.toString = obsToString;
        obs.subsDependencies = subsDependencies;
        establishDependencies(obs);
        obs.level = 999999999; // Ensure subscriptions run last.

        return obs;
    };

    // Implementation detail.

    export var toStringMaxValueLength = 32;

    // We need 'function' rather than '=>' so we can use 'this'.  Sorry.
    const obsToString = function (): string {
        var valueStr = JSON.stringify(this.value);
        if (valueStr && toStringMaxValueLength < valueStr.length) {
            valueStr = valueStr.substr(0, toStringMaxValueLength) + "...";
        }
        return "{obs " + this.id + " = " + valueStr + "}";
    };

    // Break the connection between an observable and its dependencies.
    export const dispose = (obs: IObservableAny): void => {
        const obsAny = obs as Obs<void>;
        obsAny.value = undefined;
        breakDependencies(obsAny);
        obsAny.dependents = undefined;
        // Break any dependencies if this is a subscription.
        const id = obsAny.id;
        const subsDependencies = obsAny.subsDependencies;
        if (!subsDependencies) return;
        for (var i = 0; i < subsDependencies.length; i++) {
            const obsDepcy = subsDependencies[i];
            const dependentsDepcy = obsDepcy.dependents;
            if (!dependentsDepcy) continue;
            dependentsDepcy[id] = undefined;
        }
        obsAny.subsDependencies = undefined;
    };

    const readOrWriteObs =
    <T>(obs: Obs<T>, eq: EqualityTest<T>, newX: T, argc: number): T => {
        if (argc) {
            if (obs.fn) throw new Error(
                "Computed observables cannot be assigned to."
            );
            trace("Updating obs", obs.id);
            const oldX = obs.value;
            obs.value = newX;
            if (!eq(oldX, newX)) updateDependents(obs);
        }
        if (currentDependencies) currentDependencies[obs.id] = obs;
        return obs.value;
    };

    const updateComputedObs =
    <T>(obs: Obs<T>, f: () => T, eq: EqualityTest<T>): boolean => {
        const oldX = obs.value;
        const newX = f();
        obs.value = newX;
        return !eq(oldX, newX); // True iff the new result is different.
    };

    interface ObsAny extends IObservableAny {

        // A level 0 observable has no dependencies.
        // The level of an observable with dependencies is one greater than
        // the greatest level of any of those dependencies.
        // Computing updates in ascending order of levels prevents redundant 
        // recomputation.
        level: number;

        // The set of observables on which this depends.
        // This applies only to computed observables.
        dependencies?: ObsSet;

        // The set of observables depending on this observable.
        dependents?: ObsSet;

        // Indicates whether this observable has been scheduled for update.
        isInUpdateQueue?: boolean;

        // The list of dependencies if this is a subscription.
        subsDependencies?: ObsAny[];

        // If this is a computed observable, this function recomputes its value.
        // The result should be true iff the new value differs from the old.
        fn?: () => boolean;

    }

    interface Obs<T> extends ObsAny, IObservable<T> {

        // Referring directly to this will not establish dependency, unlike ().
        value: T;

    }

    // Name supply of identifiers.

    var nextID = 1;

    // Used to efficiently track sets of observables.

    type ObsSet = { [id: number]: ObsAny };

    // A basic binary heap priority queue used to efficiently order
    // evaluation of observables in ascending level order.

    const updateQ = [] as ObsAny[];

    const enqueueUpdate = (obs: ObsAny): void => {
        if (obs.isInUpdateQueue) return;
        trace("  Enqueueing obs", obs.id);
        // This is usually called "DownHeap" in the literature.
        var i = updateQ.length;
        updateQ.push(obs);
        obs.isInUpdateQueue = true;
        var j = i >> 1; // This is how we cast to int in JS.
        const levelI = obs.level;
        while (i) {
            const obsJ = updateQ[j];
            const levelJ = obsJ.level;
            if (levelJ <= levelI) break;
            updateQ[i] = obsJ;
            i = j;
            j = i >> 1;
        }
        updateQ[i] = obs;
        trace("    UpdateQ =", JSON.stringify(updateQ.map(x => x.id)));
    };

    const dequeueUpdate = (): ObsAny => {
        if (!updateQ.length) return undefined;

        const obs = updateQ[0];
        obs.isInUpdateQueue = false;
        trace("  Dequeueing obs", obs.id);

        // This is usually called "UpHeap" in the literature.
        const obsI = updateQ.pop();
        const levelI = obsI.level;
        const n = updateQ.length;
        if (!n) return obs;
        var i = 0;
        var j = 1;
        while (j < n) {
            const k = Math.min(j + 1, n - 1);
            const objJ = updateQ[j];
            const objK = updateQ[k];
            const levelJ = objJ.level;
            const levelK = objK.level;
            if (levelJ <= levelK) {
                if (levelI <= levelJ) break;
                updateQ[i] = objJ;
                i = j;
            } else {
                if (levelI <= levelK) break;
                updateQ[i] = objK;
                i = k;
            }
            j = i << 1;
        }
        updateQ[i] = obsI;

        return obs;
    }

    // If this is non-zero the update propagation is being batched.
    var updateDepth = 0; 

    // Call this to batch update propagation (this is useful when updating
    // several assignable observables with mutual dependents).
    export const startUpdate = (): void => {
        updateDepth++;
    };

    // Call this once a batch update has completed.
    export const endUpdate = (): void => {
        if (updateDepth) updateDepth--;
        if (updateDepth === 0) processUpdateQueue();
    };

    const processUpdateQueue = (): void => {
        while (true) {
            const obs = dequeueUpdate();
            if (!obs) return;
            reevaluateComputedObs(obs);
        }
    };

    // The dependencies identified while performing an update.
    // If this is undefined then no dependencies will be recorded.
    var currentDependencies = undefined as ObsSet;

    const reevaluateComputedObs = (obs: ObsAny): void => {
        trace("Reevaluating obs", obs.id, "...");
        const oldCurrentDependencies = currentDependencies;
        currentDependencies = obs.dependencies;
        breakDependencies(obs);
        var hasChanged = tryReevaluateObsFn(obs);
        establishDependencies(obs);
        currentDependencies = oldCurrentDependencies;
        if (hasChanged) updateDependents(obs);
        trace("Reevaluating obs", obs.id, "done.");
    };

    // Break the connection between a computed observable and its dependencies
    // prior to reevaluating its value (reevaluation may change the set of
    // dependencies).
    const breakDependencies = (obs: ObsAny): void => {
        const obsID = obs.id;
        const dependencies = obs.dependencies;
        if (!dependencies) return;
        for (var id in dependencies) {
            const obsDepcy = dependencies[id];
            if (!obsDepcy) continue;
            dependencies[id] = undefined;
            obsDepcy.dependents[obsID] = undefined;
        }
    };

    // Establish a connection with observables used while reevaluating a
    // computed observable.
    const establishDependencies = (obs: ObsAny): void => {
        const obsID = obs.id;
        const dependencies = obs.dependencies;
        var obsLevel = 0;
        for (var id in dependencies) {
            const obsDepcy = dependencies[id];
            if (!obsDepcy) continue;
            if (!obsDepcy.dependents) obsDepcy.dependents = {};
            obsDepcy.dependents[obsID] = obs;
            trace("  Obs", obsID, "depends on obs", obsDepcy.id);
            const obsDepcyLevel = obsDepcy.level | 0;
            if (obsLevel <= obsDepcyLevel) obsLevel = 1 + obsDepcyLevel;
        }
        obs.level = obsLevel;
    };

    // After an observable has been updated, we need to also update its
    // dependents in level order.
    export const updateDependents = (obs: ObsAny): void => {
        const dependents = obs.dependents;
        if (!dependents) return;
        startUpdate();
        for (var id in dependents) {
            const depdtObs = dependents[id];
            if (!depdtObs) continue;
            enqueueUpdate(depdtObs);
        }
        endUpdate();
    };

    // Attempt to handle exceptions gracefully.
    export var exceptionReporter = (e: any): void =>
        (window.console && window.console.log
            ? window.console.log(e)
            : alert("Exception reevaluating computed observable:\n" +
                JSON.stringify(e))
        );

    // This is separated out because try/catch prevents optimization by
    // most contemporary JavaScript engines.
    const tryReevaluateObsFn = (obs: ObsAny): boolean => {
        try {
            return obs.fn();
        } catch (e) {
            exceptionReporter(e);
            return false;
        }
    }

    // Debugging.

    const trace: any = function() {
        if (!debug) return;
        if (!window.console || !window.console.log) return;
        console.log.apply(console, arguments);
    }
}
