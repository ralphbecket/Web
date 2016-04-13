/// <reference path="./Test.ts"/>
window.onload = function () {
    Test.run("This should pass", function () {
        Test.expect("identity", 1 === 1);
    });
    Test.run("This should fail", function () {
        Test.expect("disaster", 1 === 0);
    });
    Test.runDeferred(500, "This should eventually pass", function (pass, fail) {
        setTimeout(function () {
            if ("foo" === "foo")
                pass();
        }, 100);
    });
    Test.runDeferred(500, "This should eventually fail", function (pass, expect) {
        setTimeout(function () {
            expect("consistency", true === false);
        }, 100);
    });
    Test.runDeferred(500, "This should eventually timeout", function (pass, fail) {
        setTimeout(function () {
            pass();
        }, 600);
    });
};
