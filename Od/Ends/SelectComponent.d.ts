/// <reference path="Elements.d.ts" />
declare namespace Od {
    const selectComponent: <T>(args: {
        name?: string | number;
        options: T[] | Obs.Observable<T[]>;
        optionView?: (option: T) => string;
        selection: Obs.Observable<T>;
        props?: Props;
    }) => number | string | VdomPatcher;
}
