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

const A = makeThing("A");
const B = makeThing("B");
const C = makeThing("C", [A, B]);

Od.appendChild(C, document.body);