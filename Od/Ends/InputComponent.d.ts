/// <reference path="Elements.d.ts" />
/// <reference path="MergeProps.d.ts" />
declare namespace Od {
    interface InputComponentArgs<T> {
        componentName?: ComponentName;
        obs: Obs.Observable<T>;
        props?: Obs.Observableish<Props>;
        type?: string;
        bindTo?: string;
        updateOn?: string;
        formatObs?: (x: T) => string;
        parseText?: (text: string) => T;
    }
    const inputComponent: <T>(args: InputComponentArgs<T>) => Vdom;
}
