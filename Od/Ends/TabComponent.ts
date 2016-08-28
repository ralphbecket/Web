/// <reference path="./Elements.ts" />
/// <reference path="./MergeProps.ts" />

namespace Od {

    export interface Tab {
        heading: Obs.Observableish<string>;
        body: Obs.Observableish<Vdoms>;
    }

    export const tabComponent = (args: {
        name?: ComponentName;
        tabs: Obs.Observableish<Tab[]>;
        selection?: Obs.Observable<Tab>;
        props?: Obs.Observableish<Props>;
    }): Vdom => {

        var selection = args.selection || Obs.of(null as Tab);

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
    (selection: Obs.Observable<Tab>, tab: Tab): Vdom => {
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

    const tabBody = (tab: Tab): Vdoms =>
        Obs.value<Vdoms>(tab && tab.body) || "";
}
