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
Returns a subscription on the observables in `obss`.  If any observable in `obss` changes, `action` will be re-evaluated.  Note that a subscription is essentially a special kind of computed observable.

## Disposal

```
Obs.dispose(obs: IObservableAny): void
```
Disposes of `obs` by breaking any dependencies it has on other observables and setting its value to `null`.  This is occasionally needed to avoid garbage retention -- whenever a dependency relationship exists between two observables, neither can be garbage collected while the other is still live.

## Order of evaluation



XXX WRITE MOOOOORE!
