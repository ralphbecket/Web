/// <reference path="Elements.d.ts" />
/// <reference path="MergeProps.d.ts" />
declare namespace Od {
    interface Tab {
        heading: Obs.Observableish<string>;
        body: Obs.Observableish<Vdoms>;
    }
    const tabComponent: (args: {
        name?: string | number;
        tabs: Tab[] | Obs.Observable<Tab[]>;
        selection?: Obs.Observable<Tab>;
        props?: Props | Obs.Observable<Props>;
    }) => number | string | VdomPatcher;
}
