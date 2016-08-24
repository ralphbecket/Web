/// <reference path="./Elements.ts" />
/// <reference path="./MergeProps.ts" />

namespace Od {

    export interface ITab {
        heading: Obs.Observableish<string>;
        body: Obs.Observableish<Vdoms>;
    }

    export const tabComponent = (args: {
        name?: ComponentName;
        tabs: Obs.Observableish<ITab[]>;
        selection?: Obs.Observable<ITab>;
        props?: Obs.Observableish<Props>;
    }): Vdom => {

        var selection = args.selection || Obs.of(null as ITab);

        const vdom = component(args.name, () => {
            const tabs = Obs.value(args.tabs);
            const vdom =
                DIV(
                    mergeProps(
                        Obs.value(args.props),
                        { className: "OdTabComponent" }
                    ),
                    [
                        DIV(
                            { className: "OdTabHeadings" },
                            tabs.map(tab => tabHeading(selection, tab))
                        ),
                        DIV(
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
    (selection: Obs.Observable<ITab>, tab: ITab): Vdom => {
        const heading = Obs.value(tab.heading);
        const seln = Obs.value(selection);
        const className =
            ( seln === tab
            ? "OdTabHeading OdTabSelection"
            : "OdTabHeading"
            );
        const vdom = DIV(
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

    const tabBody = (tab: ITab): Vdoms =>
        Obs.value<Vdoms>(tab && tab.body) || "";
}
