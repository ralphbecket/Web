/// <reference path="../../Ends/Elements.ts"/>

window.onload = () => {

    // ---- Preamble.

    const addDemo = (title: string, content: () => Od.Vdom): void => {
        const vdom = Od.DIV([
            Od.H3(title),
            Od.DIV({ className: "DemoContainer" }, content())
        ]);
        Od.appendChild(vdom, document.body);
    };

    // ---- A simple incrementing counter component.

    const counter =
    (name: Od.ComponentName, x: Obs.Observable<number>, style?: string): Od.Vdom => {
        console.log("-- Creating counter.");
        const inc = () => {
            x(x() + 1);
        };
        const cmpt = Od.component(name, () => {
            console.log("-- Updating counter vDOM.");
            return Od.BUTTON({ style: style, onclick: inc }, x().toString())
        });
        return cmpt;
    };

    addDemo("Simple components", () =>
        counter("A", Obs.of(0))
    );

    // ---- A component that swaps sub-components around.  This demonstrates
    //      how Od does not re-generate, re-patch, or re-render sub-components.

    const swapper =
    (name: Od.ComponentName, x: Od.Vdom, y: Od.Vdom): Od.Vdom => {
        console.log("-- Creating swapper.");
        const X = Obs.of(x);
        const Y = Obs.of(y);
        const swap = () => {
            // This updates two observables, but we only want to update the
            // vDOM once, hence we do the updates in an atomic update region.
            Obs.startUpdate();
            const tmp = X();
            X(Y());
            Y(tmp);
            Obs.endUpdate();
        };
        const cmpt = Od.component(name, () => {
            console.log("-- Updating swapper vDOM.");
            return Od.DIV([
                X(),
                Od.BUTTON({ onclick: swap }, "Swap!"),
                Y()
            ]);
        });
        return cmpt;
    };

    addDemo("Nested components", () =>
        swapper("B",
            counter("BA", Obs.of(0), "color: blue;"),
            counter("BB", Obs.of(0), "color: red;")
        )
    );

    // ---- More of the same, but deeper.

    addDemo("Nested nested components", () => {
        const A = counter("CA", Obs.of(0), "color: blue;");
        const B = counter("CB", Obs.of(0), "color: red;");
        const C = counter("CC", Obs.of(0), "color: blue;");
        const D = counter("CD", Obs.of(0), "color: red;");
        const AB = Od.DIV(
            { style: "border: 1ex solid yellow; display: inline-block;" },
            swapper("CAB", A, B)
        );
        const CD = Od.DIV(
            { style: "border: 1ex solid cyan; display: inline-block;" },
            swapper("CCD", C, D)
        );
        return swapper("CABCD", AB, CD);
    });

    // ---- Simple inputs.

    const bindValueOnChange = <T>(
        x: Obs.Observable<T>,
        props: Od.Props = {}
    ): Od.Props => {
        props["value"] = x();
        props["onchange"] = (v: Event) => {
            x((v.target as any).value);
        };
        return props;
    }

    const bindValue = <T>(
        x: Obs.Observable<T>,
        props: Od.Props = {}
    ): Od.Props => {
        props["value"] = x();
        return props;
    };

    addDemo("Simple inputs", () => {
        const X = Obs.of(2);
        const Y = Obs.of(2);
        const Z = Obs.fn(() => +X() + +Y());
        const props = { style: "width: 2em; text-align: right;" } as Od.Props;
        
        return Od.DIV([
            Od.INPUT(bindValueOnChange(X, props)),
            " + ",
            Od.INPUT(bindValueOnChange(Y, props)),
            " = ",
            Od.component("D", () => Z())
        ]);
    });

    // ---- Simple lists.

    addDemo("Simple lists", () => {
        const Xs = Obs.of([1], Obs.alwaysUpdate);
        const inc = () => {
            const xs = Xs();
            xs.push(xs.length + 1);
            Xs(xs);
        };
        const dec = () => {
            const xs = Xs();
            if (xs.length <= 1) return;
            xs.pop();
            Xs(xs);
        };
        return Od.DIV([
            Od.BUTTON({ onclick: inc, style: "width: 2em;" }, "+"),
            Od.BUTTON({ onclick: dec, style: "width: 2em;" }, "-"),
            Od.component("E", () =>
                Od.DIV(Xs().map(x => Od.SPAN(" " + x + " ")))
            )
        ]);
    });

};