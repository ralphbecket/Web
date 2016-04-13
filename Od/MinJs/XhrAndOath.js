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

/// <reference path="./Oath.ts"/>
var Xhr;
(function (Xhr) {
    // send(url, opts)
    //
    // Make an XMLHttpRequest to the given URL with the provided
    // (optional) options in opts.
    //
    // If opts contains key k and value v then the generated XMLHttpRequest
    // will have property k set to v.  You can use this scheme to set the
    // timeout value, amongst others.
    //
    // If opts contains an entry "requestHeaders" then for each key k and
    // value v therein the generated XMLHttpRequest will be initialised
    // with setRequestHeader(k, v).
    //
    // The XMLHttpRequest will be opened using the "method" (default "GET"),
    // "async" (default true), "user", and "password" entries in opts.
    //
    // The data sent is taken from the "data" entry of opts.
    //
    // All these are, of course, optional.
    //
    // The result is a promise which will be fulfilled with the XMLHttpRequest
    // if the request succeeds (i.e., the status code is in 200..299) or
    // rejected with the XMLHttpRequest if the request fails (i.e., the status
    // code is anything else).
    // 
    Xhr.send = function (url, opts) {
        if (opts === void 0) { opts = {}; }
        var xhr = new XMLHttpRequest();
        var method = opts["method"] || "GET";
        var async = (opts["async"] !== false);
        var user = opts["user"];
        var password = opts["password"];
        var data = opts["data"];
        xhr.open(method, url, async, user, password);
        for (var key in opts) {
            var value = opts[key];
            xhr[key] = value;
        }
        var requestHeaders = opts["requestHeaders"];
        if (requestHeaders)
            for (var header in requestHeaders) {
                var value = requestHeaders[header];
                xhr.setRequestHeader(header, value);
            }
        var promise = Oath.make(function (pass, fail) {
            xhr.onreadystatechange = readyStateChangeHandler(xhr, pass, fail);
        });
        xhr.send(data);
        return promise;
    };
    var readyStateChangeHandler = function (xhr, pass, fail) {
        return function (v) {
            if (xhr.readyState !== 4 /* DONE */)
                return;
            (200 <= xhr.status && xhr.status < 300 ? pass : fail)(xhr);
        };
    };
})(Xhr || (Xhr = {}));