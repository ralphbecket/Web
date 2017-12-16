/// <reference path="../Ends/Elements.ts"/>

namespace Test {

    const showingImg = Obs.of(true);

    export const view = Od.component("view", () => Od.DIV([
        Od.BUTTON({ onclick: () => { showingImg(!showingImg()); } }, "Click to toggle the IMG element."),
        Od.P("Making the image disappear should not cause error messages to be displayed on the console."),
        ( showingImg()
        ? Od.IMG({ src: "http://www.typescriptlang.org/assets/images/ideicons/atom.svg" })
        : Od.P("[no image]")
        )
    ]));

}

window.onload = () => {
    Od.appendChild(Test.view, document.getElementById("content"));
};