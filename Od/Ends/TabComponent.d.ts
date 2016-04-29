/// <reference path="Elements.d.ts" />
/// <reference path="MergeProps.d.ts" />
declare namespace Od {
    interface ITab {
        heading: Obs.IObservablish<string>;
        body: Obs.IObservablish<Od.Vdoms>;
    }
    const tabComponent: (args: {
        name?: string | number;
        tabs: ITab[] | Obs.IObservable<ITab[]>;
        selection?: Obs.IObservable<ITab>;
        props?: IProps | Obs.IObservable<IProps>;
    }) => IVdom;
}
