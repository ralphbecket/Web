// Jigsaw - a simple location-hash router.
var Jigsaw;
(function (Jigsaw) {
    // A route is a possibly-empty set of "parts" separated by '/' slashes.
    // Each route part is matched against the corresponding part of the
    // window location hash, stripped of its leading '#' character.
    //
    // Parts match as follows:
    //  xyx     -   Must match the exact string "xyz" (case sensitive);
    //  :foo    -   Required parameter, matches anything;
    //  ?bar    -   Optional parameter, matches anything;
    //  *baz    -   Parameter matching all remaining parts of the hash.
    //
    // A successful matching results in the corresponding route handler
    // being called with a dictionary mapping parameters to argument values.
    //
    // Parameter names are exactly as written (i.e., they include the leading
    // character indicating the parameter kind).  Argument values are all
    // simple strings (preprocessed via decodeURIComponent), except for
    // '*' parameters, whose values are arrays of such.
    //
    // Two special parameters are added to the dictionary: "#" is the
    // original location hash and "?" is any query string (which you may
    // choose to process via parseQuery).
    //
    // Routes are tested in the order in which they were added, the first
    // match taking priority.
    //
    Jigsaw.addRoute = function (route, handler) {
        var compiledRoute = {
            route: route,
            matcher: routeMatcher(route),
            handler: handler
        };
        compiledRoutes.push(compiledRoute);
    };
    Jigsaw.removeRoute = function (route) {
        compiledRoutes = compiledRoutes.filter(function (x) { return x.route === route; });
    };
    Jigsaw.clearRoutes = function () {
        compiledRoutes = [];
    };
    // If no route matches, the default route handler will be called
    // if one has been specified.
    //
    Jigsaw.defaultRouteHandler = null;
    Jigsaw.takeRoute = function (hash) {
        var queryIdx = hash.lastIndexOf("?");
        var query = "";
        if (queryIdx !== -1) {
            query = hash.substr(queryIdx + 1);
            hash = hash.substr(0, queryIdx);
        }
        var parts = (!hash ? [] : hash.split("/").map(decodeURIComponent));
        for (var i = 0; i < compiledRoutes.length; i++) {
            var compiledRoute = compiledRoutes[i];
            var args = compiledRoute.matcher(parts, 0, {});
            if (args) {
                // Success!
                args["#"] = hash;
                args["?"] = query;
                if (query != null)
                    args["?"] = query;
                compiledRoute.handler(args);
                return;
            }
        }
        // Nooooo...
        if (Jigsaw.defaultRouteHandler)
            Jigsaw.defaultRouteHandler(hash);
    };
    Jigsaw.startRouter = function () {
        window.addEventListener("hashchange", processHash);
    };
    Jigsaw.stopRouter = function () {
        window.removeEventListener("hashchange", processHash);
    };
    // A utility function to convert query strings into key/value
    // dictionaries.
    Jigsaw.parseQuery = function (query) {
        var pairs = (query || "").replace(/\+/g, " ").split(/[&;]/);
        var args = {};
        pairs.forEach(function (pair) {
            var i = pair.indexOf("=");
            if (i === -1)
                i = pair.length;
            var key = pair.substr(0, i);
            var value = decodeURIComponent(pair.substr(i + 1));
            args[key] = value;
        });
        return args;
    };
    // ---- Implementation detail. ----
    var previousHash = null;
    // Rapid changes to the location hash can cause the application
    // to receive multiple onhashchange events, but each receiving only
    // the very latest hash.  We "debounce" that behaviour here.
    var processHash = function () {
        var hash = location.hash.substr(1);
        if (hash === previousHash)
            return;
        Jigsaw.takeRoute(hash);
        previousHash = hash;
    };
    var matchEnd = function (parts, i, args) { return (parts[i] == null) && args; };
    // '.../foo/...'
    var matchExact = function (word, cont) { return function (parts, i, args) {
        return (parts[i] === word) && cont(parts, i + 1, args);
    }; };
    // '.../:bar/...'
    var matchParam = function (param, cont) { return function (parts, i, args) {
        var arg = parts[i];
        if (arg == null)
            return null;
        args[param] = arg;
        return cont(parts, i + 1, args);
    }; };
    // '.../?baz/...'
    var matchOptParam = function (param, cont) { return function (parts, i, args) {
        var arg = parts[i];
        args[param] = arg;
        return cont(parts, i + 1, args);
    }; };
    // '.../*quux'
    var matchRest = function (param, cont) { return function (parts, i, args) {
        args[param] = parts.slice(i);
        return cont(parts, parts.length, args);
    }; };
    var routeMatcher = function (route) {
        if (!route)
            return matchEnd;
        var params = route.split("/");
        var matcher = matchEnd;
        for (var i = params.length - 1; 0 <= i; i--) {
            var param = params[i];
            switch (param[0]) {
                case ":":
                    matcher = matchParam(param, matcher);
                    continue;
                case "?":
                    matcher = matchOptParam(param, matcher);
                    continue;
                case "*":
                    matcher = matchRest(param, matcher);
                    continue;
                default:
                    matcher = matchExact(param, matcher);
                    continue;
            }
        }
        return matcher;
    };
    var compiledRoutes = [];
})(Jigsaw || (Jigsaw = {}));
var Oath;
(function (Oath) {
    var nextID = 1;
    Oath.resolve = function (x) {
        return Oath.make(function (pass, fail) { return pass(x); });
    };
    Oath.reject = function (r) {
        return Oath.make(function (pass, fail) { return fail(r); });
    };
    Oath.all = function (ps) {
        return Oath.make(function (pass, fail) {
            var xs = [];
            var n = ps.length;
            ps.forEach(function (p, i) {
                p.then(function (x) { xs[i] = x; if (!--n)
                    pass(xs); });
            });
        });
    };
    Oath.race = function (ps) {
        return Oath.make(function (pass, fail) {
            ps.forEach(function (p, i) {
                p.then(function (x) { pass(x); });
            });
        });
    };
    Oath.delay = function (t, f) {
        return Oath.make(function (pass, fail) {
            setTimeout(function () {
                pass(isFunction(f) ? f() : f);
            }, t);
        });
    };
    var isFunction = function (x) {
        return typeof (x) === "function";
    };
    var isThenable = function (x) {
        return x && isFunction(x.then);
    };
    Oath.make = function (setup) {
        var p = {
            value: null,
            state: pending,
            onFulfilled: null,
            onRejected: null,
            then: null,
            id: nextID++
        };
        // console.log("Oath: created", p.id);
        var pass = function (x) { return resolveOath(p, x); };
        var fail = function (r) { return rejectOath(p, r); };
        setup(pass, fail);
        p.then =
            function (passed, failed) {
                return Oath.make(function (pass, fail) {
                    p.state(p, passed, failed, pass, fail);
                });
            };
        return p;
    };
    var resolveOath = function (p, x) {
        if (p.state !== pending)
            return;
        p.state = fulfilled;
        p.value = x;
        if (p.onFulfilled)
            setTimeout(p.onFulfilled, 0, x);
        p.onFulfilled = null;
        // console.log("Oath: resolved", p.id);
    };
    var rejectOath = function (p, r) {
        if (p.state !== pending)
            return;
        p.state = rejected;
        p.value = r;
        if (p.onRejected)
            setTimeout(p.onRejected, 0, r);
        p.onRejected = null;
        // console.log("Oath: rejected", p.id);
    };
    var pending = function (p, passed, failed, pass, fail) {
        var onF = p.onFulfilled;
        if (passed)
            p.onFulfilled = function (x) {
                if (onF)
                    onF(x);
                handleCallback(p, passed, pass, fail);
            };
        var onR = p.onRejected;
        if (failed)
            p.onRejected = function (r) {
                if (onR)
                    onR(r);
                handleCallback(p, failed, pass, fail);
            };
    };
    var fulfilled = function (p, passed, failed, pass, fail) {
        setTimeout(handleCallback, 0, p, passed, pass, fail);
    };
    var rejected = function (p, passed, failed, pass, fail) {
        setTimeout(handleCallback, 0, p, failed, pass, fail);
    };
    var handleCallback = function (p, f, pass, fail) {
        try {
            if (!isFunction(f))
                return;
            // console.log("Oath: evaluating callback on", p.id);
            var x = p.value;
            var y = f(x);
            if (y === p)
                throw new TypeError("Cyclic promise.");
            if (isThenable(y))
                y.then(pass, fail);
            else
                pass(y);
        }
        catch (r) {
            fail(r);
        }
    };
})(Oath || (Oath = {}));
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
/// <reference path="../../Ends/Jigsaw.ts"/>
/// <reference path="../../Ends/Oath.ts"/>
/// <reference path="../TestHarness/Test.ts"/>
window.onload = function () {
    var n = 0;
    var args = {};
    Jigsaw.addRoute("", function (a) { n = 0; args = a; });
    Jigsaw.addRoute("foo/bar/baz", function (a) { n = 1; args = a; });
    Jigsaw.addRoute("foo/:bar/?baz/*quux/:fub", function (a) { n = 2; args = a; });
    Jigsaw.addRoute("foo/:bar/?baz/*quux", function (a) { n = 3; args = a; });
    Jigsaw.addRoute("bar/:foo/bar", function (a) { n = 4; args = a; });
    Jigsaw.addRoute("baz/?foo/baz", function (a) { n = 5; args = a; });
    Jigsaw.addRoute("/baz", function (a) { n = 6; args = a; });
    Jigsaw.defaultRouteHandler = function (_) { n = 7; };
    Test.run("Jigsaw router", function () {
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
        Test.expect("Rest parameter 4", args["*quux"].join(",") === "ghi,jkl");
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
