/// <reference path="../../Ends/Elements.ts"/>
/// <reference path="../../Ends/Jigsaw.ts"/>

namespace Test {

    const cmptName = (name: string): string => (true ? name : null); // Test named vs anonymous behaviour.

    // A quick on-screen logging facility.
    const maxLogSize = 20;
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
            logMsgs().map(msg => msg ? Od.DIV(msg) : Od.HR())
        )
    );

    // Application state.
    const currPage = Obs.of(Od.component("Empty", () => "Empty page."));

    const goToPageA = (): void => {
        Od.dispose(currPage());
        currPage(loggingDiv("Page A", [() => loggingDiv("Page A 1"), () => loggingDiv("Page A 2")]));
    };

    const goToPageB = (): void => {
        Od.dispose(currPage());
        currPage(loggingDiv("Page B", [() => loggingDiv("Page B 1")]));
    };

    // Add some navigation.
    const navView =
        Od.DIV([
            Od.P({ onclick: () => { log(); goToPageA(); }}, "Go to Page A"),
            Od.P({ onclick: () => { log(); goToPageB(); }}, "Go to Page B"),
            Od.HR()
        ]);

    // A nested set of views.
    const loggingDiv = (name: string, children?: (() => Od.Vdoms)[]) => Od.component(name, () =>
        Od.DIV(
            { onodevent: (what: string, dom: Node) => { log(name + ": " + what); } },
            [name, (children || []).map(f => f())]
        )
    );
    const mainView = Od.component("main", () => Od.DIV(currPage()));
    //const mainView = Od.component("Main", currPage);

    export const start = () => {

        const mainElt = document.getElementById("main");
        const logElt = document.getElementById("log");
        Od.appendChild(logView, logElt);
        Od.appendChild(navView, mainElt);
        Od.appendChild(mainView, mainElt);

    };

}

window.onload = () => {
    Test.start();
};
