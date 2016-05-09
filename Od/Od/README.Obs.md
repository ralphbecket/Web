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
```
Observables are typed and each has a unique identity.  `IObservableAny` is primarily useful for TypeScript development where inhomogeneous collections of observables are involved.

Each observable that is created carries an equality test to decide whether an updated value constitutes a change or not.  The default test simply compares the old and new values with `===`.  This means that, by default, changes to the contents of an array or object field will not be visible to any observable containing that array or object.

## Reading and writing observables.

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

XXX WRITE MOOOOORE!
