declare namespace Oath {
    interface Promise<T> {
        then<U>(passed: (x: T) => U, failed?: (r: any) => any): Promise<U>;
    }
    const resolve: <T>(x: T) => Promise<T>;
    const reject: <T>(r: any) => Promise<T>;
    const all: <T>(ps: Promise<T>[]) => Promise<T[]>;
    const race: <T>(ps: Promise<T>[]) => Promise<T>;
    const delay: <T>(t: number, f: T | (() => T)) => Promise<T>;
    const make: <T>(setup: (pass: (x: T) => void, fail: (r: any) => void) => void) => Promise<T>;
}
