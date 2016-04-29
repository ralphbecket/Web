/// <reference path="../../Ends/InputComponent.ts"/>

window.onload = () => {
    const x = Obs.of("" as any as number);
    const vdom = Od.DIV([
        Od.inputComponent({
            obs: x,
            formatObs: (n: number) => n.toString(),
            parseText: (s: string) => isFinite(s as any) ? +s : s as any,
            updateOn: "oninput",
            props: { style: { width: "4em" } }
        }),
        "'", Od.component(null, () => x().toString()), "'",
        Od.BUTTON({
            onclick: () => { x(-x()); }
        }, "Negate!"
        )
    ]);
    Od.appendChild(vdom, document.body);
};