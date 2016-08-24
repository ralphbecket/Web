/// <reference path="../../Ends/DialogueBoxAlert.ts"/>

window.onload = () => {
    Od.dialogueBoxAlert({
        header: Od.DIV([Od.warningSignSpan, " Emergency"]),
        body: "Plague!  Locusts!",
        ondismiss: () => { },
        dismissText: "Flee"
    });
};