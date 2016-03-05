window.onload = () => {
    const e = Od.element;

    const addDemo = (title: string, content: Od.Vdom): void => {
        const vdom = e("DIV", null, [
            e("H3", null, title),
            e("DIV", { className: "DemoContainer" }, content)
        ]);
        Od.patchDom(vdom, null, document.body);
    };

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

    addDemo("Simple component",
        counter(Obs.of(0))
    );

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

    addDemo("Nested components",
        swapper(counter(Obs.of(0)), counter(Obs.of(0)))
    );

};