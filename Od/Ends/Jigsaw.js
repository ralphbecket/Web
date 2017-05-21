// Jigsaw - a simple location-hash router.
var Jigsaw;
(function (Jigsaw) {
    // ---- Public interface. ----
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
