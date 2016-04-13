var Test;
(function (Test) {
    Test.passedTestsID = "passed";
    Test.failedTestsID = "failed";
    Test.addPassReport = function (name) {
        addReport(Test.passedTestsID, name);
    };
    Test.addFailureReport = function (name, e) {
        var msg = ": " + (typeof (e) === "string" ? e : JSON.stringify(e));
        if (e === null || e === undefined || e === "")
            msg = "";
        addReport(Test.failedTestsID, name + msg);
    };
    var addReport = function (id, msg) {
        var div = document.getElementById(id);
        var p = document.createElement("P");
        p.textContent = msg;
        div.appendChild(p);
    };
    Test.expect = function (what, cond) {
        if (!cond)
            throw what;
    };
    Test.run = function (name, action) {
        try {
            window.console && window.console.log("---- " + name + " ----");
            action();
            Test.addPassReport(name);
        }
        catch (e) {
            var what = (typeof (e) === "string" ? e : JSON.stringify(e));
            Test.addFailureReport(name, what);
        }
    };
    Test.runDeferred = function (timeoutInMS, name, action) {
        var completed = false;
        var pass = function () {
            if (completed)
                return;
            Test.addPassReport(name);
            completed = true;
        };
        var expect = function (what, cond) {
            if (completed)
                return;
            if (cond)
                return;
            Test.addFailureReport(name, what);
            completed = true;
        };
        setTimeout(function () {
            if (completed)
                return;
            expect("timed out", false);
        }, timeoutInMS);
        try {
            action(pass, expect);
        }
        catch (e) {
            expect(e.message, false);
        }
    };
})(Test || (Test = {}));
