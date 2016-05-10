/// <reference path="../../Ends/DialogueBoxComponent.ts"/>

const view = Od.dialogueBoxComponent(
    Od.DIV({ style: { paddingLeft: "0.5em" } }, "Header"),
    Od.DIV({ style: { width: "10em", height: "3em" } }, "Body"),
    Od.DIV({ style: { paddingLeft: "0.5em" } }, "Footer")
);

window.onload = () => {
    Od.appendChild(view, document.body);
};