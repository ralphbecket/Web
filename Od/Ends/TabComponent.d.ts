/// <reference path="Elements.d.ts" />
/// <reference path="MergeProps.d.ts" />
declare namespace Od {
    interface Tab {
        heading: Obs.Observableish<string>;
        body: Obs.Observableish<Vdoms>;
    }
    const tabComponent: (args: {
        name?: ComponentName;
        tabs: Obs.Observableish<Tab[]>;
        selection?: Obs.Observable<Tab>;
        props?: Obs.Observableish<Props>;
    }) => Vdom;
}
