/// <reference path="../Ends/Elements.ts" />
/// <reference path="../Ends/MergeProps.ts" />

namespace Od {

    export interface InputComponentArgs<T> {
        componentName?: ComponentName;
        obs: Obs.Observable<T>;
        props?: Obs.Observableish<Props>;
        type?: string; // Default is "text".
        bindTo?: string; // Default is "value".
        updateOn?: string; // Default is "onchange".
        formatObs?: (x: T) => string;
        parseText?: (text: string) => T;
    };

    export const inputComponent = <T>(args: InputComponentArgs<T>): Vdom =>
        Od.component(args.componentName, () => inputComponentVdom(args));

    const inputComponentVdom = <T>(args: InputComponentArgs<T>): Vdom => {
        const obs = args.obs;
        const props = Obs.value(args.props);
        const type = args.type || "text";
        const bindTo = args.bindTo || "value";
        const updateOn = args.updateOn || "onchange";
        const formatObs = args.formatObs;
        const parseText = args.parseText;
        const obsProps = { type: type } as Props;
        obsProps[bindTo] = (formatObs ? formatObs(obs()) : obs());
        obsProps[updateOn] = (v: Event) => {
            const value = (v.target as any)[bindTo];
            obs(parseText ? parseText(value) : value);
        };
        const allProps = mergeProps(props, obsProps);
        return Od.INPUT(allProps);
    };

}
