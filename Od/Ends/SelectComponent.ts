namespace Od {

    export const selectComponent = <T>(args: {
        options: Obs.IObservablish<T[]>;
        optionView?: (option: T) => string;
        selection: Obs.IObservable<T>;
        props?: Obs.IObservablish<Od.IProps>;
    }): IVdom => {
        const props = args.props || {} as IProps;
        props["onchange"] = (v: any) => {
            updateSelection(
                Obs.value(args.options),
                args.selection,
                v.target.selectedIndex);
        };
        const optionView = args.optionView || defaultOptionView;
        const e = Od.element;
        const vdom = Od.component(() => {
            const props = args.props || {} as IProps;
            const options = Obs.value(args.options);
            const selection = args.selection();
            const iTop = options.length;
            for (var i = 0; i < iTop; i++) if (options[i] === selection) break;
            if (i === iTop) {
                if (selection !== null) args.selection(null);
                i = -1;
            }
            props["selectedIndex"] = i;
            const vdom = e("SELECT", props,
                options.map(x => e("OPTION", null, optionView(x)))
            );
            return vdom;
        });
        return vdom;
    };

    const updateSelection =
    <T>(options: T[], selection: Obs.IObservable<T>, i: number): void => {
        if (i == null) return;
        selection(options[i]);
    };

    const defaultOptionView = <T>(x: T): string =>
        (x == null) ? "null" : x.toString();

}