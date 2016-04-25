// Jigsaw - a simple location-hash router.

namespace Jigsaw {

    // ---- Public interface. ----

    export type RouteHandler = (args: IRouteArgs) => void;

    export interface IRouteArgs {
        [key: string]: (string | string[]);
    }

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
    export const addRoute = (route: string, handler: RouteHandler): void => {
        const compiledRoute = {
            route: route,
            matcher: routeMatcher(route),
            handler: handler
        };
        compiledRoutes.push(compiledRoute);
    };

    export const removeRoute = (route: string): void => {
        compiledRoutes = compiledRoutes.filter(x => x.route === route);
    };

    export const clearRoutes = (): void => {
        compiledRoutes = [];
    };

    // If no route matches, the default route handler will be called
    // if one has been specified.
    //
    export var defaultRouteHandler = null as (route: string) => void;

    export const takeRoute = (hash: string): void => {
        const queryIdx = hash.lastIndexOf("?");
        var query = "";
        if (queryIdx !== -1) {
            query = hash.substr(queryIdx + 1);
            hash = hash.substr(0, queryIdx);
        }
        const parts = (!hash ? [] : hash.split("/").map(decodeURIComponent));
        for (var i = 0; i < compiledRoutes.length; i++) {
            const compiledRoute = compiledRoutes[i];
            const args = compiledRoute.matcher(parts, 0, {});
            if (args) {
                // Success!
                args["#"] = hash;
                args["?"] = query;
                if (query != null) args["?"] = query;
                compiledRoute.handler(args)
                return;
            }
        }
        // Nooooo...
        if (defaultRouteHandler) defaultRouteHandler(hash);
    };

    export const startRouter = (): void => {
        window.addEventListener("hashchange", processHash);
    };

    export const stopRouter = (): void => {
        window.removeEventListener("hashchange", processHash);
    };

    // A utility function to convert query strings into key/value
    // dictionaries.
    export const parseQuery = (query: string): { [key: string]: string } => {
        const pairs = (query || "").replace(/\+/g, " ").split(/[&;]/);
        const args = {} as { [key: string]: string };
        pairs.forEach(pair => {
            var i = pair.indexOf("=");
            if (i === -1) i = pair.length;
            const key = pair.substr(0, i);
            const value = decodeURIComponent(pair.substr(i + 1));
            args[key] = value;
        });
        return args;
    };

    // ---- Implementation detail. ----

    var previousHash = null as string;

    // Rapid changes to the location hash can cause the application
    // to receive multiple onhashchange events, but each receiving only
    // the very latest hash.  We "debounce" that behaviour here.
    const processHash = (): void => {
        const hash = location.hash.substr(1);
        if (hash === previousHash) return;
        takeRoute(hash);
        previousHash = hash;
    };

    type Matcher = (parts: string[], i: number, args: IRouteArgs) => IRouteArgs;

    interface ICompiledRoute {
        route: string;
        matcher: Matcher;
        handler: (args: IRouteArgs) => void;
    }

    const matchEnd: Matcher = (parts, i, args) => (parts[i] == null) && args;

    // '.../foo/...'
    const matchExact: (word: string, cont: Matcher) => Matcher =
        (word, cont) => (parts, i, args) =>
            (parts[i] === word) && cont(parts, i + 1, args);

    // '.../:bar/...'
    const matchParam: (param: string, cont: Matcher) => Matcher =
        (param, cont) => (parts, i, args) => {
            const arg = parts[i];
            if (arg == null) return null;
            args[param] = arg;
            return cont(parts, i + 1, args);
        };

    // '.../?baz/...'
    const matchOptParam: (param: string, cont: Matcher) => Matcher =
        (param, cont) => (parts, i, args) => {
            const arg = parts[i];
            args[param] = arg;
            return cont(parts, i + 1, args);
        };

    // '.../*quux'
    const matchRest: (param: string, cont: Matcher) => Matcher =
        (param, cont) => (parts, i, args) => {
            args[param] = parts.slice(i);
            return cont(parts, parts.length, args);
        };

    const routeMatcher = (route: string): Matcher => {
        if (!route) return matchEnd;
        const params = route.split("/");
        var matcher = matchEnd;
        for (var i = params.length - 1; 0 <= i; i--) {
            var param = params[i];
            switch (param[0]) {
                case ":": matcher = matchParam(param, matcher); continue;
                case "?": matcher = matchOptParam(param, matcher); continue;
                case "*": matcher = matchRest(param, matcher); continue;
                default: matcher = matchExact(param, matcher); continue;
            }
        }
        return matcher;
    };

    var compiledRoutes = [] as ICompiledRoute[];
}