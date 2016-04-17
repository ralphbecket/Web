declare namespace Oath {
    interface IThenable<T> {
        then<U>(passed: (x: T) => U, failed?: (r: any) => any): IThenable<U>;
    }
    const resolve: <T>(x: T) => IThenable<T>;
    const reject: <T>(r: any) => IThenable<T>;
    const all: <T>(ps: IThenable<T>[]) => IThenable<T[]>;
    const race: <T>(ps: IThenable<T>[]) => IThenable<T>;
    const delay: <T>(t: number, f: T | (() => T)) => IThenable<T>;
    const make: <T>(setup: (pass: (x: T) => void, fail: (r: any) => void) => void) => IThenable<T>;
}
