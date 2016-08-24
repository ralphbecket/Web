/// <reference path="Elements.d.ts" />
/// <reference path="MergeProps.d.ts" />
declare namespace Od {
    interface ITab {
        heading: Obs.Observableish<string>;
        body: Obs.Observableish<Vdoms>;
    }
    const tabComponent: (args: {
        name?: string | number;
        tabs: ITab[] | Obs.Observable<ITab[]>;
        selection?: Obs.Observable<ITab>;
        props?: Props | Obs.Observable<Props>;
    }) => number | string | VdomPatcher;
}
