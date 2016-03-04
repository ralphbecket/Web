module Test {

    export var passedTestsID = "passed";

    export var failedTestsID = "failed";

    export var addPassReport = (name: string): void => {
        addReport(passedTestsID, name);
    };

    export var addFailureReport = (name: string, e?: any): void => {
        var msg = ": " + (typeof (e) === "string" ? e : JSON.stringify(e));
        if (e === null || e === undefined || e === "") msg = "";
        addReport(failedTestsID, name + msg);
    };

    const addReport = (id: string, msg: string): void => {
        const div = document.getElementById(id);
        const p = document.createElement("P");
        p.textContent = msg;
        div.appendChild(p);
    };

    export const expect = (what: string, cond: boolean): void => {
        if (!cond) throw what;
    };

    export const run = (name: string, action: () => void): void => {
        try {
            window.console && window.console.log("---- " + name + " ----");
            action();
            addPassReport(name);
        } catch (e) {
            addFailureReport(name, e);
        }
    };

    export const runDeferred = (
        timeoutInMS: number,
        name: string,
        action: (pass: () => void, fail: (e: any) => void) => void
    ): void => {
        var completed = false;
        const pass = () => {
            if (completed) return;
            addPassReport(name);
            completed = true;
        };
        const fail = (e: any) => {
            if (completed) return;
            addFailureReport(name, e);
            completed = true;
        };
        setTimeout(() => {
            if (completed) return;
            fail("timed out");
            completed = true;
        }, timeoutInMS);
        try {
            action(pass, fail);
        } catch (e) {
            fail(e);
        }
    };
}