/// <reference path="../../Ends/Elements.ts"/>

const logOdEvent = (name: string) => (what: string, dom: Node) => {
    console.log(name, what);
    Od.appendChild(Od.DIV(name + " " + what), document.body);
};

const makeThing = (name: string, children?: Od.Vdoms) =>
Od.component(name, () => Od.DIV(
    { onodevent: logOdEvent(name) },
    [name, (children || []) as any]
));

const x = Obs.of("");

const A = makeThing("A",
    Od.component(null, () => Od.DIV(null, [
        Od.INPUT({ oninput: (e: any) => { x(e.target.value); } }),
        x()
    ]))
);

const B = makeThing("B", Od.component(null, () => x()));
const C = makeThing("C", [A, B]);

Od.appendChild(C, document.body);