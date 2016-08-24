/// <reference path="Elements.ts"/>
/// <reference path="Dragging.ts"/>
/// <reference path="MergeProps.ts"/>

namespace Od {

    const OdDialogueBoxCssClass = "OdDialogueBox";
    const OdDialogueBoxHeaderCssClass = "OdDialogueBoxHeader";
    const OdDialogueBoxBodyCssClass = "OdDialogueBoxBody";
    const OdDialogueBoxFooterCssClass = "OdDialogueBoxFooter";

    const startDraggingDialogueBox = (v: MouseEvent | TouchEvent): void => {
        const touches = (v as TouchEvent).touches;
        if (touches) {
            if (touches.length !== 1) return;
            v = touches[0] as any as MouseEvent;
        }
        var elt = v.target as HTMLElement;
        while (elt && !elt.classList.contains(OdDialogueBoxCssClass))
            elt = elt.parentElement;
        if (!elt) return;
        startDragging({ elt: elt }, v as MouseEvent);
    };

    export const dialogueBox = (
        header: Vdom,
        body: Vdom,
        footer: Vdom,
        props = null as Props
    ): Vdom => {

        const vdom = Od.DIV(
            mergeProps(props, {
                className: OdDialogueBoxCssClass,
                style: { position: "absolute" }
            }),
            [
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
            ]
        );

        return vdom;

    };

}