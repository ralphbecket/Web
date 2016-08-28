declare namespace Jigsaw {
    type RouteHandler = (args: RouteArgs) => void;
    interface RouteArgs {
        [key: string]: (string | string[]);
    }
    const addRoute: (route: string, handler: (args: RouteArgs) => void) => void;
    const removeRoute: (route: string) => void;
    const clearRoutes: () => void;
    var defaultRouteHandler: (route: string) => void;
    const takeRoute: (hash: string) => void;
    const startRouter: () => void;
    const stopRouter: () => void;
    const parseQuery: (query: string) => {
        [key: string]: string;
    };
}
