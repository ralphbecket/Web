/// <reference path="./Test.ts"/>

window.onload = () => {
    Test.run("This should pass", () => {
        Test.expect("identity", 1 === 1 - 0); // Typescript getting weird...
    });
    Test.run("This should fail", () => {
        Test.expect("disaster", 1 === 1 - 1);
    });
    Test.runDeferred(500, "This should eventually pass", (pass, fail) => {
        setTimeout(() => {
            if ("foo" === "foo") pass();
        }, 100);
    });
    Test.runDeferred(500, "This should eventually fail", (pass, expect) => {
        setTimeout(() => {
            expect("consistency", true === !true);
        }, 100);
    });
    Test.runDeferred(500, "This should eventually timeout", (pass, fail) => {
        setTimeout(() => {
            pass();
        }, 600);
    });
};