/// <reference path="Elements.d.ts" />
declare namespace Od {
    const selectComponent: <T>(args: {
        options: T[] | Obs.IObservable<T[]>;
        optionView?: (option: T) => string;
        selection: Obs.IObservable<T>;
        props?: IProps;
    }) => IVdom;
}
