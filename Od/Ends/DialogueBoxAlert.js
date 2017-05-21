/// <reference path="DialogueBox.ts"/>
var Od;
(function (Od) {
    Od.warningSignSpan = Od.SPAN({ className: "OdWarningSign" }, "\u26a0");
    Od.dialogueBoxAlert = function (args) {
        var elt = null;
        var dismiss = function () {
            // Just to be safe...
            if (elt && elt.parentElement)
                elt.parentElement.removeChild(elt);
            Od.dispose(vdom);
        };
        var vdom = Od.component(null, function () { return Od.dialogueBox(Od.DIV({ className: "OdDialogueBoxAlertHeader" }, args.header || Od.warningSignSpan), Od.DIV({ className: "OdDialogueBoxAlertBody" }, args.body), Od.DIV({ className: "OdDialogueBoxAlertFooter" }, Od.BUTTON({
            className: "OdDialogueBoxAlertDismissButton",
            onclick: dismiss
        }, args.dismissText || "Dismiss"))); });
        elt = Od.appendChild(vdom, document.body);
    };
})(Od || (Od = {}));
