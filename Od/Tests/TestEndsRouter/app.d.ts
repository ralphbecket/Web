declare namespace Jigsaw {
    type RouteHandler = (args: IRouteArgs) => void;
    interface IRouteArgs {
        [key: string]: (string | string[]);
    }
    const addRoute: (route: string, handler: (args: IRouteArgs) => void) => void;
    const removeRoute: (route: string) => void;
    const clearRoutes: () => void;
    var defaultRouteHandler: (route: string) => void;
    const takeRoute: (hash: string) => void;
    const startRouter: () => void;
    const stopRouter: () => void;
    const parseQuery: (query: string) => {
        [key: string]: string;
    };
}
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
declare namespace Test {
    var passedTestsID: string;
    var failedTestsID: string;
    var addPassReport: (name: string) => void;
    var addFailureReport: (name: string, e?: any) => void;
    const expect: (what: string, cond: boolean) => void;
    const run: (name: string, action: () => void) => void;
    const runDeferred: (timeoutInMS: number, name: string, action: (pass: () => void, expect: (what: string, cond: boolean) => void) => void) => void;
}
