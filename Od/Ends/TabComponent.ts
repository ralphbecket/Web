/// <reference path="./Elements.ts" />
/// <reference path="./MergeProps.ts" />

namespace Od {

    export interface ITab {
        heading: Obs.IObservablish<string>;
        body: Obs.IObservablish<Od.Vdoms>;
    }

    export const tabComponent = (args: {
        name?: ComponentName;
        tabs: Obs.IObservablish<ITab[]>;
        selection?: Obs.IObservable<ITab>;
        props?: Obs.IObservablish<Od.IProps>;
    }): Od.IVdom => {

        const e = Od.element;

        var selection = args.selection || Obs.of(null as ITab);

        const vdom = Od.component(args.name, () => {
            const tabs = Obs.value(args.tabs);
            const vdom =
                Od.DIV(
                    mergeProps(
                        Obs.value(args.props),
                        { className: "OdTabComponent" }
                    ),
                    [
                        Od.DIV(
                            { className: "OdTabHeadings" },
                            tabs.map(tab => tabHeading(selection, tab))
                        ),
                        Od.DIV(
                            { className: "OdTabBody" },
                            tabBody(selection())
                        )
                    ]
                );
            return vdom;
        });

        return vdom;
    };

    const tabHeading =
    (selection: Obs.IObservable<ITab>, tab: ITab): Od.IVdom => {
        const heading = Obs.value(tab.heading);
        const seln = Obs.value(selection);
        const className =
            ( seln === tab
            ? "OdTabHeading OdTabSelection"
            : "OdTabHeading"
            );
        const vdom = Od.DIV(
            {
                className: className,
                onclick: () => {
                    if (seln !== tab) selection(tab);
                }
            },
            heading
        );
        return vdom;
    };

    const tabBody = (tab: ITab): Od.Vdoms =>
        Obs.value(tab && tab.body) || "";
}
