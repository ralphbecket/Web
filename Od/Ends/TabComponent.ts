/// <reference path="./WithClassName.ts" />

namespace Od {

    export interface ITab {
        heading: Obs.IObservablish<string>;
        body: Obs.IObservablish<Od.Vdoms>;
    }

    export const tabComponent = (args: {
        tabs: Obs.IObservablish<ITab[]>;
        selection?: Obs.IObservable<ITab>;
        props?: Obs.IObservablish<Od.IProps>;
    }): Od.IVdom => {

        const e = Od.element;

        var selection = args.selection || Obs.of(null as ITab);

        const vdom = Od.component(() => {
            const tabs = Obs.value(args.tabs);
            const vdom =
                e("DIV",
                    withClassName("OdTabComponent", Obs.value(args.props)),
                    [
                        e("DIV",
                            { className: "OdTabHeadings" },
                            tabs.map(tab => tabHeading(selection, tab))
                        ),
                        e("DIV",
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
        const e = Od.element;
        const heading = Obs.value(tab.heading);
        const seln = Obs.value(selection);
        const className =
            ( seln === tab
            ? "OdTabHeading OdTabSelection"
            : "OdTabHeading"
            );
        const vdom = e("DIV",
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

    const tabBody = (selection: ITab): Od.Vdom =>
        selection ? selection.body : "";
}
