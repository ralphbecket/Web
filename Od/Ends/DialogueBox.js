/// <reference path="Elements.ts"/>
/// <reference path="Dragging.ts"/>
/// <reference path="MergeProps.ts"/>
var Od;
(function (Od) {
    var OdDialogueBoxCssClass = "OdDialogueBox";
    var OdDialogueBoxHeaderCssClass = "OdDialogueBoxHeader";
    var OdDialogueBoxBodyCssClass = "OdDialogueBoxBody";
    var OdDialogueBoxFooterCssClass = "OdDialogueBoxFooter";
    var startDraggingDialogueBox = function (v) {
        var touches = v.touches;
        if (touches) {
            if (touches.length !== 1)
                return;
            v = touches[0];
        }
        var elt = v.target;
        while (elt && !elt.classList.contains(OdDialogueBoxCssClass))
            elt = elt.parentElement;
        if (!elt)
            return;
        Od.startDragging({ elt: elt }, v);
    };
    Od.dialogueBox = function (header, body, footer, props) {
        if (props === void 0) { props = null; }
        var vdom = Od.DIV(Od.mergeProps(props, {
            className: OdDialogueBoxCssClass,
            style: { position: "absolute" }
        }), [
            Od.DIV({
                className: OdDialogueBoxHeaderCssClass,
                style: {
                    position: "absolute",
                    bottom: "100%",
                    width: "100%",
                    cursor: "move"
                },
                onmousedown: startDraggingDialogueBox,
                ontouchstart: startDraggingDialogueBox
            }, header || ""),
            Od.DIV({
                className: OdDialogueBoxBodyCssClass
            }, body),
            Od.DIV({
                className: OdDialogueBoxFooterCssClass,
                style: {
                    position: "absolute",
                    top: "100%",
                    width: "100%"
                }
            }, footer || "")
        ]);
        return vdom;
    };
})(Od || (Od = {}));
