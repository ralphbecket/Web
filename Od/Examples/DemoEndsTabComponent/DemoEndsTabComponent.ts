namespace DemoEndsTabComponent {

    export const vdom = (): Od.Vdom => {

        const e = Od.element;

        const tabs = Obs.of([
            { heading: "One", body: e("B", null, "First tab.") },
            { heading: "Two", body: e("I", null, "Second tab.") },
            {
                heading: "Three", body: e("UL", null, [
                    e("LI", null, "Third"),
                    e("LI", null, "tab.")
                ])
            }
        ] as Od.ITab[]);

        const selection = Obs.of(null as Od.ITab);

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
            e("BUTTON", { onclick: rotateTabs }, "Rotate"),
            e("BUTTON", { onclick: jumpTab }, "Jump"),
            e("HR"),
            Od.tabComponent({ tabs: tabs, selection: selection })
        ]);

        return vdom;

    }

}