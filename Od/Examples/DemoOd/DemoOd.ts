/// <reference path="../../Od/Od.ts"/>

window.onload = () => {

    // ---- Preamble.

    const e = Od.element;

    const addDemo = (title: string, content: () => Od.Vdom): void => {
        const vdom = e("DIV", null, [
            e("H3", null, title),
            e("DIV", { className: "DemoContainer" }, content())
        ]);
        Od.appendChild(vdom, document.body);
    };

    // ---- A simple incrementing counter component.

    const counter = (x: Obs.IObservable<number>, style?: string): Od.Vdom => {
        console.log("-- Creating counter.");
        const inc = () => {
            x(x() + 1);
        };
        const cmpt = Od.component(() => {
            console.log("-- Updating counter vDOM.");
            return e("BUTTON", { style: style, onclick: inc }, x().toString())
        });
        return cmpt;
    };

    addDemo("Simple components", () =>
        counter(Obs.of(0))
    );

    // ---- A component that swaps sub-components around.  This demonstrates
    //      how Od does not re-generate, re-patch, or re-render sub-components.

    const swapper = (x: Od.Vdom, y: Od.Vdom): Od.Vdom => {
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
        const cmpt = Od.component(() => {
            console.log("-- Updating swapper vDOM.");
            return e("DIV", null, [
                X(),
                e("BUTTON", { onclick: swap }, "Swap!"),
                Y()
            ]);
        });
        return cmpt;
    };

    addDemo("Nested components", () =>
        swapper(
            counter(Obs.of(0), "color: blue;"),
            counter(Obs.of(0), "color: red;")
        )
    );

    // ---- More of the same, but deeper.

    addDemo("Nested nested components", () => {
        const A = counter(Obs.of(0), "color: blue;");
        const B = counter(Obs.of(0), "color: red;");
        const C = counter(Obs.of(0), "color: blue;");
        const D = counter(Obs.of(0), "color: red;");
        const AB = e("DIV",
            { style: "border: 1ex solid yellow; display: inline-block;" },
            swapper(A, B)
        );
        const CD = e("DIV",
            { style: "border: 1ex solid cyan; display: inline-block;" },
            swapper(C, D)
        );
        return swapper(AB, CD);
    });

    // ---- Simple inputs.

    const bindValueOnChange = <T>(
        x: Obs.IObservable<T>,
        props: Od.IProps = {}
    ): Od.IProps => {
        props["value"] = x();
        props["onchange"] = (e: Event) => {
            x((e.target as any).value);
        };
        return props;
    }

    const bindValue = <T>(
        x: Obs.IObservable<T>,
        props: Od.IProps = {}
    ): Od.IProps => {
        props["value"] = x();
        return props;
    };

    addDemo("Simple inputs", () => {
        const X = Obs.of(2);
        const Y = Obs.of(2);
        const Z = Obs.fn(() => +X() + +Y());
        const props = { style: "width: 2em; text-align: right;" } as Od.IProps;
        
        return e("DIV", null, [
            e("INPUT", bindValueOnChange(X, props)),
            " + ",
            e("INPUT", bindValueOnChange(Y, props)),
            " = ",
            Od.component(() => Z().toString())
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
        return e("DIV", null, [
            e("BUTTON", { onclick: inc, style: "width: 2em;" }, "+"),
            e("BUTTON", { onclick: dec, style: "width: 2em;" }, "-"),
            Od.component(() =>
                e("DIV", null,
                    Xs().map(x => e("SPAN", null, " " + x + " "))
                )
            )
        ]);
    });

};