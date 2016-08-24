/// <reference path="InputComponent.ts"/>

namespace Od {

    export interface ICheckboxComponentArgs {
        componentName?: string;
        obs: Obs.Observable<boolean>;
        props?: Props;
    }

    export const checkboxComponent = (args: ICheckboxComponentArgs): Vdom =>
        Od.component(args.componentName, () => checkboxComponentView(args));


    const checkboxComponentView = (args: ICheckboxComponentArgs): Vdom => {
        const obs = args.obs;
        const props = args.props;
        var checkboxProps = {
            type: "checkbox",
            checked: obs(),
            onchange: (v: Event) => {
                obs((v.target as HTMLInputElement).checked);
            }
        } as Props;
        if (props) checkboxProps = mergeProps(props, checkboxProps);
        return Od.INPUT(checkboxProps);
    };

}

