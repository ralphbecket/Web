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
            Test.addFailureReport(name, JSON.stringify(e));
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
        var fail = function (e) {
            if (completed)
                return;
            Test.addFailureReport(name, e);
            completed = true;
        };
        setTimeout(function () {
            if (completed)
                return;
            fail("timed out");
            completed = true;
        }, timeoutInMS);
        try {
            action(pass, fail);
        }
        catch (e) {
            fail(e);
        }
    };
})(Test || (Test = {}));
//# sourceMappingURL=Test.js.map