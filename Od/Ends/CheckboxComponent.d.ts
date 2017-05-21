/// <reference path="InputComponent.d.ts" />
declare namespace Od {
    interface CheckboxComponentArgs {
        componentName?: string;
        obs: Obs.Observable<boolean>;
        props?: Props;
    }
    const checkboxComponent: (args: CheckboxComponentArgs) => Vdom;
}
