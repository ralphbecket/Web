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
            var done = false;
            ps.forEach(function (p, i) {
                p.then(function (x) { if (!done)
                    pass(x); done = true; });
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
        return x instanceof Function;
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
        p.onFulfilled = function (x) {
            if (onF)
                onF(x);
            if (passed)
                handleCallback(p, passed, pass, fail);
            else
                pass(x);
        };
        var onR = p.onRejected;
        p.onRejected = function (r) {
            if (onR)
                onR(r);
            if (failed)
                handleCallback(p, failed, pass, fail);
            else
                fail(r);
        };
    };
    var fulfilled = function (p, passed, failed, pass, fail) {
        if (passed)
            setTimeout(handleCallback, 0, p, passed, pass, fail);
    };
    var rejected = function (p, passed, failed, pass, fail) {
        if (failed)
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