/// <reference path="../../Ends/Elements.ts"/>

namespace Test {

    export const view = Od.component(null, () => Od.DIV([
        Od.BUTTON({
            onclick: () => { console.log("A clicked"); Od.dispose(view); },
            onodevent: (what: any, dom: any) => { console.log("A", what); }
        }, "Die!"),
        Od.component(null, () => 
            Od.BUTTON({
                onclick: () => {  console.log("B clicked"); },
                onodevent: (what: any, dom: any) => { console.log("B", what); }
            }, "Do nothing.")
        )
    ]));

}

window.onload = () => {
    Od.appendChild(Test.view, document.getElementById("content"));
};
