/// <reference path="DialogueBox.d.ts" />
declare namespace Od {
    const warningSignSpan: Vdom;
    const dialogueBoxAlert: (args: {
        header?: Vdom;
        body: Vdoms;
        ondismiss?: () => void;
        dismissText?: Vdoms;
    }) => void;
}
