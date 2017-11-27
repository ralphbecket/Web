/// <reference path="../../Ends/Elements.ts"/>
/// <reference path="../../Ends/Jigsaw.ts"/>

namespace Test {

    const cmptName = (name: string): string => (true ? name : null); // Test named vs anonymous behaviour.

    // Application state.
    const currPageName = Obs.of("Page A");

    // A quick on-screen logging facility.
    const maxLogSize = 12;
    const logMsgs = Obs.of([]);
    var logNo = 1;
    const log = (msg?: string): void => {
        const msgs = logMsgs();
        msg = msg && (logNo++) + " - " + msg;
        msgs.push(msg);
        if (maxLogSize < msgs.length) msgs.shift();
        logMsgs(msgs);
        Obs.updateDependents(logMsgs); // Stupid imperative language...
    };
    const logView = Od.component("log", () =>
        Od.DIV(
            logMsgs().map(msg => msg ? Od.P(msg) : Od.HR())
        )
    );

    // Add some navigation.
    const navView = (names: string[]): Od.Vdom =>
        Od.DIV([
            names.map(name =>
                Od.P({
                    onclick: () => { log(); currPageName(name); }
                }, "Go to " + name)
            ),
            Od.HR()
        ]);

    // A nested set of views.
    const loggingDiv = (name: string, children?: Od.Vdoms) => Od.component(name, () =>
        Od.DIV(
            { onodevent: (what: string, dom: Node) => { log(name + ": " + what); } },
            [name, children || []]
        )
    );
    const mainView = Od.component("main", () => {
        var currPage = currPageName();
        var view = Od.DIV([
            ( currPage === "Page A"
            ? loggingDiv("Page A", [loggingDiv("Page A 1"), loggingDiv("Page A 2")])
            : currPage === "Page B"
            ? loggingDiv("Page B", [loggingDiv("Page B 1")])
            : loggingDiv("Eh?")
            )
        ]);
        return view;
    });

    export const start = () => {

        const mainElt = document.getElementById("main");
        const logElt = document.getElementById("log");
        Od.appendChild(logView, logElt);
        Od.appendChild(navView(["Page A", "Page B"]), mainElt);
        Od.appendChild(mainView, mainElt);

    };

}

window.onload = () => {
    Test.start();
};
