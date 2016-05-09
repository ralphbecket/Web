/// <reference path="InputComponent.ts"/>

namespace Od {

    export interface ICheckboxComponentArgs {
        componentName?: string;
        obs: Obs.IObservable<boolean>;
        props?: IProps;
    }

    export const checkboxComponent = (args: ICheckboxComponentArgs): IVdom =>
        Od.component(args.componentName, () => checkboxComponentView(args));


    const checkboxComponentView = (args: ICheckboxComponentArgs): IVdom => {
        const obs = args.obs;
        const props = args.props;
        var checkboxProps = {
            type: "checkbox",
            checked: obs(),
            onchange: (v: Event) => {
                obs((v.target as HTMLInputElement).checked);
            }
        } as IProps;
        if (props) checkboxProps = mergeProps(props, checkboxProps);
        return Od.INPUT(checkboxProps);
    };

}

