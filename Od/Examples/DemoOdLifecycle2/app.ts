/// <reference path="../../Ends/Elements.ts"/>

var logMsgs = Obs.of([]);

var logWhat = (colour, desc) => what => {
    var msgs = Obs.peek(logMsgs); // Don't establish a dependency on this!
    console.log(desc + ": " + what);
    msgs.push({ colour: colour, text: desc + ": " + what });
    msgs = msgs.slice(-7); // Keep this manageable.
    logMsgs(msgs);
};

var logView = Od.component("logView", () =>
    Od.DIV({ class: "LogMessages" }, logMsgs().map(x =>
        Od.DIV({ style: { color: x.colour } }, x.text)
    ))
);

var inc = x => { x(x() + 1); };

var aOuter = Obs.of(0);
var aInner = Obs.of(0);

var aComponent = Od.component("a", () =>
    Od.DIV({ onodevent: logWhat("blue", "A outer") }, [
        "A outer x ", aOuter().toString(),
        Od.component("nestedNamed", () =>
            Od.DIV({ onodevent: logWhat("blue", "- A inner") }, [
                "A inner x ", aInner().toString()
            ])
        )
    ])
);

var aDemo = Od.DIV([
    Od.H3("A: a nested named sub-component"),
    Od.P("A named sub-component persists across " +
        "updates of its parent component.  " +
        "Observe that with named sub-components, parent " +
        "updates and child updates are completely decoupled.  " +
        "You almost always want to use named sub-components."),
    aComponent,
    Od.BUTTON({ onclick: () => inc(aOuter) }, "A outer"),
    Od.BUTTON({ onclick: () => inc(aInner) }, "A inner")
]);

var bOuter = Obs.of(0);
var bInner = Obs.of(0);

var bComponent = Od.component("b", () =>
    Od.DIV({ onodevent: logWhat("orange", "B outer") }, [
        "B outer x ", bOuter(),
        Od.component(null, () =>
            Od.DIV({ onodevent: logWhat("orange", "- B inner") }, [
                "B inner x ", bInner()
            ])
        )
    ])
);

var bDemo = Od.DIV([
    Od.H3("B: a nested unnamed (ephemeral) sub-component"),
    Od.P("An unnamed sub-component is ephemeral: it is " +
        "destroyed and re-created whenever its parent component " +
        "is updated."),
    bComponent,
    Od.BUTTON({ onclick: () => inc(bOuter) }, "B outer"),
    Od.BUTTON({ onclick: () => inc(bInner) }, "B inner")
]);

var view = Od.DIV([
    Od.H3("Event log"),
    logView,
    Od.HR(),
    aDemo,
    Od.HR(),
    bDemo
]);

Od.deferComponentUpdates = false;

Od.appendChild(view, document.body);