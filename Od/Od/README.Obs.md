# Obs API

## Interactive tutorial

https://jsfiddle.net/ralphbecket/wo5pb7m4/

## Types

```
interface IObservableAny {
  // Every observable has a unique identity.
  obsid: number;
}

interface IObservable<T> extends IObservableAny {
  (x?: T): T; // Attempting to update a computed observable is an error.
}

type EqualityTest<T> = (oldX: T, newX: T) => boolean;

type IObservablish<T> = T | IObservable<T>;

interface ISubscription extends IObservable<void> { };
```
Observables are typed and each has a unique identity.  `IObservableAny` is primarily useful for TypeScript development where inhomogeneous collections of observables are involved.

Each observable that is created carries an equality test to decide whether an updated value constitutes a change or not.  The default test simply compares the old and new values with `===`.  This means that, by default, changes to the contents of an array or object field will not be visible to any observable containing that array or object.

## Reading and writing observables

The current value of an observable `x` may be obtained via `x()`.

A _mutable observable_ (i.e., not a _computed_ observable) may be updated via `x(value)`.  Updating an observable will cause all dependent computed observables and subscriptions to be automatically re-evaluated, unless the observable's equality test fails to detect a change.

Attempting to update a computed observable is a runtime error.

## Constructors

```
Obs.of<T>(x: T, eq: EqualityTest<T> = defaultEq): IObservable<T>
```
Creates a new _mutable_ observable with initial value `x`.  If `eq` is not supplied, `Obs.defaultEq` is used.

```
Obs.fn<T>(f: () => T, eq: EqualityTest<T> = defaultEq): IObservable<T>
```
Creates a new _computed_ observable of function `f`, which is evaluated on construction to obtain the initial computed value.  If `eq` is not supplied, `Obs.defaultEq` is used.

A mutable observable is dependent on any observables (mutable or computed) that are directly evaluated by its function.  Whenever any of those dependencies changes, the mutable observable is updated by re-evaluating its function (which may change its set of dependencies).

## Equality tests

```
Obs.defaultEq = <T>(x: T, y: T) => x === y;
```
The default equality test for all observables, unless otherwise specified in the observable constructor call.

```
Obs.valueOfEq = <T>(x: T, y: T) =>
    (x && y && x.valueOf() === y.valueOf()) ||
    (!x && !y);
```
Similar to the default equality constructor, but it uses `valueOf` to obtain the underlying values.  This is particularly useful for observables with `Date` values.

```
alwaysUpdate = <T>(x: T, y: T) => false;
```
Always registers a change on any update to an observable.  Be careful with this one, it is possible to end up in infinite loops...

## Peeking at an observable's value

```
Obs.peek<T>(obs: IObservable<T>): T
```
Returns the current value of `obs` _without_ establishing a dependency on `obs`.  This is occasionally useful for computed observables.

## "Observablish" values

It is sometimes convenient to freely mix observable and unobservable (ordinary) values.

```
Obs.value<T>(x: IObservablish<T>): T
```
Returns `x` if `x` is not an observable, `x()` otherwise.

```
Obs.isObservable(x: any): boolean
```
Returns `true` iff `x` is an observable.

```
Obs.isComputed(x: any): boolean
```
Returns `true` iff `x` is a computed observable.

## Subscriptions

```
Obs.subscribe(obss: IObservableAny[], action: () => void): ISubscription
```
Returns a subscription on the observables in `obss`.  If any observable in `obss` changes, `action` will be re-evaluated.  

Subscriptions are useful when you need to associate a side effect with a change in one or more observables.  Be careful that `action` does not update other observables in such a way as to create an infinite loop.  It is a good idea to use subscriptions sparingly.

Note that a subscription is essentially just a special kind of computed observable.

## Disposal

```
Obs.dispose(obs: IObservableAny): void
```
Disposes of `obs` by breaking any dependencies it has on other observables and setting its value to `null`.  This is occasionally needed to avoid garbage retention -- whenever a dependency relationship exists between two observables, neither can be garbage collected while the other is still live.

## Order of evaluation

An observable may have any number of dependents, hence a change to an observable can trigger an update in several other observables.  These, in turn, may trigger updates of further observables.

When multiple observables are to be updated, they are always updated in increasing order of dependency count.  That is, an observable with fewer dependencies will always be re-evaluated before an observable with more dependencies.  This ensures that, in the absence of circular dependencies (do not create such things!), each observable will be re-evaluated at most once after a single update to a "root" observable.

There is one exception to this rule: subscriptions are always re-evaluated after all non-subscription observables have been re-evaluated.

## Atomic group-update regions

```
Obs.startUpdate(): void
Obs.endUpdate(): void
```
Any dependent observable updates after a call to `Obs.startUpdate()` are deferred until the corresponding call to `Obs.endUpdate()`.  In this way you can udpate several mutable observables in one go, but only trigger one round of updates to their dependents.

Atomic update regions (i.e., between calls to `Obs.startUpdate()` and `Obs.endUpdate()`) may be nested; any pending dependent updates will be deferred until the outermost atomic update region is finished.
