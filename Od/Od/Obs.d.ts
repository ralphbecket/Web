declare module Obs {
    interface ObservableAny {
        obsid: number;
    }
    interface Observable<T> extends ObservableAny {
        (x?: T): T;
    }
    type EqualityTest<T> = (oldX: T, newX: T) => boolean;
    const defaultEq: <T>(x: T, y: T) => boolean;
    const valueOfEq: <T>(x: T, y: T) => boolean;
    const alwaysUpdate: <T>(x: T, y: T) => boolean;
    const of: <T>(x: T, eq?: EqualityTest<T>) => Observable<T>;
    const fn: <T>(f: () => T, eq?: EqualityTest<T>) => Observable<T>;
    const peek: <T>(obs: Observable<T>) => T;
    const isObservable: (obs: any) => boolean;
    const isComputed: (obs: any) => boolean;
    interface Subscription extends Observable<void> {
    }
    const subscribe: (obss: ObservableAny[], action: () => void) => Subscription;
    type Observableish<T> = T | Observable<T>;
    const value: <T>(ish: Observableish<T>) => T;
    var toStringMaxValueLength: number;
    const dispose: (obs: ObservableAny) => void;
    const startUpdate: () => void;
    const endUpdate: () => void;
    const updateDependents: (obs: ObservableAny) => void;
    var exceptionReporter: (e: any) => void;
}
