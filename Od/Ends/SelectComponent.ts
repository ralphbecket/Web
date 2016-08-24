/// <reference path="../Ends/Elements.ts" />

namespace Od {

    export const selectComponent = <T>(args: {
        name?: ComponentName;
        options: Obs.Observableish<T[]>;
        optionView?: (option: T) => string;
        selection: Obs.Observable<T>;
        props?: Od.Props;
    }): Vdom => {
        const props = args.props || {} as Props;
        props["onchange"] = (v: any) => {
            updateSelection(
                Obs.value(args.options),
                args.selection,
                v.target.selectedIndex);
        };
        const optionView = args.optionView || defaultOptionView;
        const e = Od.element;
        const vdom = Od.component(args.name, () => {
            const props = Obs.value(args.props) || {} as Props;
            const options = Obs.value(args.options);
            const selection = args.selection();
            const iTop = options.length;
            for (var i = 0; i < iTop; i++) if (options[i] === selection) break;
            if (i === iTop) {
                if (selection !== null) args.selection(null);
                i = -1;
            }
            props["selectedIndex"] = i;
            const vdom = Od.SELECT(props,
                options.map(x => Od.OPTION(optionView(x)))
            );
            return vdom;
        });
        return vdom;
    };

    const updateSelection =
    <T>(options: T[], selection: Obs.Observable<T>, i: number): void => {
        if (i == null) return;
        selection(options[i]);
    };

    const defaultOptionView = <T>(x: T): string =>
        (x == null) ? "null" : x.toString();

}