﻿/// <reference path="../../Ends/Elements.ts"/>
/// <reference path="../../Ends/SelectComponent.ts"/>

namespace DemoEndsSelectComponent {

    export const vdom = (): Od.Vdom => {

        const options = Obs.of([
            "One",
            "Two",
            "Three",
            "Four",
            "Five",
            "Six",
            "Seven",
            "Eight",
            "Nine",
            "Ten"
        ]);

        const optionView = x => x.toUpperCase();

        const selection = Obs.of(null as string);

        const changeOptions = () => {
            options().sort((a, b) => Math.random() - 0.5);
            Obs.updateDependents(options);
        };

        const changeSelection = () => {
            const opts = options();
            const n = opts.length;
            selection(opts[(n * Math.random()) | 0]);
        };

        const vdom = Od.DIV([
            Od.BUTTON({ onclick: changeOptions }, "Randomize options"),
            Od.BUTTON({ onclick: changeSelection }, "Randomize selection"),
            Od.HR(),
            Od.selectComponent({
                options: options,
                optionView: optionView,
                selection: selection,
                props: { style: "color: blue;" }
            })
        ]);

        return vdom;

    }

}