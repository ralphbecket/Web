/// <reference path="../../Ends/Jigsaw.ts"/>
/// <reference path="../../Ends/Oath.ts"/>
/// <reference path="../TestHarness/Test.ts"/>

window.onload = () => {

    var n = 0;
    var args = {} as Jigsaw.IRouteArgs;

    Jigsaw.addRoute("", (a) => { n = 0; args = a; });

    Jigsaw.addRoute("foo/bar/baz", (a) => { n = 1; args = a; });

    Jigsaw.addRoute("foo/:bar/?baz/*quux/:fub", (a) => { n = 2; args = a; });

    Jigsaw.addRoute("foo/:bar/?baz/*quux", (a) => { n = 3; args = a; });

    Jigsaw.addRoute("bar/:foo/bar", (a) => { n = 4; args = a; });

    Jigsaw.addRoute("baz/?foo/baz", (a) => { n = 5; args = a; });

    Jigsaw.addRoute("/baz", (a) => { n = 6; args = a; });

    Jigsaw.defaultRouteHandler = (_) => { n = 7; };

    Test.run("Jigsaw router", () => {

        Jigsaw.takeRoute("");
        Test.expect("Empty route", n === 0);

        Jigsaw.takeRoute("foo/bar/baz");
        Test.expect("All fixed route", n === 1);

        Jigsaw.takeRoute("foo/abc");
        Test.expect("Mandatory parameter 1", n === 3);
        Test.expect("Mandatory parameter 2", args[":bar"] === "abc");

        Jigsaw.takeRoute("foo/abc/def");
        Test.expect("Optional parameter 1", n === 3);
        Test.expect("Optional parameter 2", args[":bar"] === "abc");
        Test.expect("Optional parameter 3", args["?baz"] === "def");

        Jigsaw.takeRoute("foo/abc/def/ghi/jkl");
        Test.expect("Rest parameter 1", n === 3);
        Test.expect("Rest parameter 2", args[":bar"] === "abc");
        Test.expect("Rest parameter 3", args["?baz"] === "def");
        Test.expect("Rest parameter 4", (args["*quux"] as string[]).join(",") === "ghi,jkl");

        Jigsaw.takeRoute("bar/abc/bar");
        Test.expect("Mixed fixed and mandatory parameters 1", n === 4);
        Test.expect("Mixed fixed and mandatory parameters 2", args[":foo"] === "abc");

        Jigsaw.takeRoute("baz/abc/baz");
        Test.expect("Mixed fixed and optional parameters 1", n === 5);
        Test.expect("Mixed fixed and optional parameters 2", args["?foo"] === "abc");

        Jigsaw.takeRoute("/baz");
        Test.expect("Leading '/'", n === 6);

        Jigsaw.takeRoute("something/else");
        Test.expect("Default route handler 1", n === 7);

        Jigsaw.takeRoute("foo");
        Test.expect("Default route handler 2", n === 7);

        Jigsaw.takeRoute("bar/bar");
        Test.expect("Default route handler 3", n === 7);

    });

};