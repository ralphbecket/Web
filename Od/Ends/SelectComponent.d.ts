/// <reference path="Elements.d.ts" />
declare namespace Od {
    const selectComponent: <T>(args: {
        name?: string | number;
        options: T[] | Obs.IObservable<T[]>;
        optionView?: (option: T) => string;
        selection: Obs.IObservable<T>;
        props?: IProps;
    }) => IVdom;
}
