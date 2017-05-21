declare namespace Test {
    var passedTestsID: string;
    var failedTestsID: string;
    var addPassReport: (name: string) => void;
    var addFailureReport: (name: string, e?: any) => void;
    const expect: (what: string, cond: boolean) => void;
    const run: (name: string, action: () => void) => void;
    const runDeferred: (timeoutInMS: number, name: string, action: (pass: () => void, expect: (what: string, cond: boolean) => void) => void) => void;
}
