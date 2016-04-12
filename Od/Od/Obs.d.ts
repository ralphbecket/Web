declare module Obs {
    interface IObservableAny {
        obsid: number;
    }
    interface IObservable<T> extends IObservableAny {
        (x?: T): T;
    }
    const defaultEq: <T>(x: T, y: T) => boolean;
    const valueOfEq: <T>(x: T, y: T) => boolean;
    const alwaysUpdate: <T>(x: T, y: T) => boolean;
    const of: <T>(x: T, eq?: (oldX: T, newX: T) => boolean) => IObservable<T>;
    const fn: <T>(f: () => T, eq?: (oldX: T, newX: T) => boolean) => IObservable<T>;
    const peek: <T>(obs: IObservable<T>) => T;
    const isObservable: (obs: any) => boolean;
    const isComputed: (obs: any) => boolean;
    interface ISubscription extends IObservable<void> {
    }
    const subscribe: (obss: IObservableAny[], action: () => void) => ISubscription;
    type IObservablish<T> = T | IObservable<T>;
    const value: <T>(ish: T | IObservable<T>) => T;
    var toStringMaxValueLength: number;
    const dispose: (obs: IObservableAny) => void;
    const startUpdate: () => void;
    const endUpdate: () => void;
    const updateDependents: (obs: IObservableAny) => void;
    var exceptionReporter: (e: any) => void;
}
