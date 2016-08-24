/// <reference path="DialogueBox.ts"/>

namespace Od {

    export const warningSignSpan =
        Od.SPAN({ className: "OdWarningSign" }, "\u26a0");

    export const dialogueBoxAlert = (args: {
        header?: Vdom;
        body: Vdoms;
        ondismiss?: () => void;
        dismissText?: Vdoms; // Default "Dismiss".
    }): void => {

        var elt = null as HTMLElement;

        const dismiss = () => {
            // Just to be safe...
            if (elt && elt.parentElement) elt.parentElement.removeChild(elt);
            dispose(vdom);
        };

        const vdom = Od.component(null, () => Od.dialogueBox(
            Od.DIV({ className: "OdDialogueBoxAlertHeader" },
                args.header || warningSignSpan
            ),
            Od.DIV({ className: "OdDialogueBoxAlertBody" },
                args.body
            ),
            Od.DIV({ className: "OdDialogueBoxAlertFooter" },
                Od.BUTTON({
                    className: "OdDialogueBoxAlertDismissButton",
                    onclick: dismiss
                }, args.dismissText || "Dismiss")
            )
        ));

        elt = Od.appendChild(vdom, document.body) as HTMLElement;
    };

}