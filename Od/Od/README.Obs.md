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
Obs.of<T>(x: T, eq: EqualityTest<T> = null): IObservable<T>
```
Creates a new _mutable_ observable with initial value `x`.  If `eq` is omitted, `Obs.defaultEq` is used.

```
Obs.fn<T>(f: () => T, eq: EqualityTest<T> = defaultEq): IObservable<T>
```
Creates a new _computed_ observable of function `f`, which is evaluated on construction to obtain the initial computed value.

XXX WRITE MORE!
