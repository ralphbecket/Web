/// <reference path="../../Ends/TabComponent.ts"/>

namespace DemoEndsTabComponent {

    export const vdom = (): Od.Vdom => {

        const e = Od.element;

        const tabs = Obs.of([
            { heading: "One", body: Od.B("First tab.") },
            { heading: "Two", body: Od.I("Second tab.") },
            {
                heading: "Three", body: Od.UL([
                    Od.LI("Third"),
                    Od.LI("tab.")
                ])
            }
        ] as Od.Tab[]);

        const selection = Obs.of(null as Od.Tab);

        const rotateTabs = (): void => {
            const xs = tabs();
            const x = xs.pop();
            xs.unshift(x);
            tabs(xs);
            Obs.updateDependents(tabs);
        };

        const jumpTab = (): void => {
            const curr = selection();
            while (selection() === curr) {
                const xs = tabs();
                const n = xs.length;
                const i = (n * Math.random()) | 0;
                const x = xs[i];
                selection(x);
            }
        };

        const vdom = e("DIV", null, [
            Od.BUTTON({ onclick: rotateTabs }, "Rotate"),
            Od.BUTTON({ onclick: jumpTab }, "Jump"),
            Od.HR(),
            Od.tabComponent({ tabs: tabs, selection: selection })
        ]);

        return vdom;

    }

}