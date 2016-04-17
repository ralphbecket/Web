/// <reference path="../../Ends/Elements.ts"/>

const n = Obs.of(0);
const view = Od.component("view", () =>
    Od.BUTTON(
        {
            onodevent: (what: string, dom: Node) => {
                Od.appendChild(Od.P("Button " + what), document.body);
            },
            onclick: () => { n(n() + 1); }
        },
        n().toString()
    )
);

window.onload = () => {
    Od.appendChild(view, document.body);
};