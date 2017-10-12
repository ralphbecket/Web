/// <reference path="Elements.d.ts" />
declare namespace Od {
    const selectComponent: <T>(args: {
        name?: string | number;
        options: Obs.Observableish<T[]>;
        optionView?: (option: T) => string;
        selection: Obs.Observable<T>;
        props?: Props;
    }) => Vdom;
}
