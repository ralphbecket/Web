/// <reference path="../../Ends/Jigsaw.ts"/>
/// <reference path="../../Ends/Oath.ts"/>
/// <reference path="../TestHarness/Test.ts"/>

window.onload = () => {

    var n = 0;
    var args = {} as Jigsaw.IRouteArgs;

    Jigsaw.addRoute("foo/bar/baz", (a) => {
        n = 1; args = a;
    });

    Jigsaw.addRoute("foo/:bar/?baz/*quux/:fub", (a) => {
        n = 2; args = a;
    });

    Jigsaw.addRoute("foo/:bar/?baz/*quux", (a) => {
        n = 3; args = a;
    });

    Jigsaw.addRoute("bar/:foo/bar", (a) => {
        n = 4; args = a;
    });

    Jigsaw.addRoute("/baz", (a) => {
        n = 5; args = a;
    });

    Jigsaw.defaultRouteHandler = (_) => {
        n = 6;
    };

    Test.run("Jigsaw router", () => {

        Jigsaw.takeRoute("foo/bar/baz");
        Test.expect("All fixed route", n === 1);

        Jigsaw.takeRoute("foo/abc");
        Test.expect("Mandatory parameter", n === 3);

        Jigsaw.takeRoute("foo/abc/def");
        Test.expect("Optional parameter", n === 3);

        Jigsaw.takeRoute("foo/abc/def/ghi/jkl");
        Test.expect("Rest parameter", n === 3);

        Jigsaw.takeRoute("bar/abc/bar");
        Test.expect("Mixed fixed and parameters", n === 4);

        Jigsaw.takeRoute("/baz");
        Test.expect("Leading '/'", n === 5);

        Jigsaw.takeRoute("something/else");
        Test.expect("Default route handler", n === 6);

    });

};