/// <reference path="Dragging.ts"/>
/// <reference path="MergeProps.ts"/>

namespace Od {

    const OdDialogueBoxCssClass = "OdDialogueBox";
    const OdDialogueBoxHeaderCssClass = "OdDialogueBoxHeader";
    const OdDialogueBoxBodyCssClass = "OdDialogueBoxBody";
    const OdDialogueBoxFooterCssClass = "OdDialogueBoxFooter";

    const startDraggingDialogueBox = (v: MouseEvent): void => {
        var elt = v.target as HTMLElement;
        while (elt && !elt.classList.contains(OdDialogueBoxCssClass))
            elt = elt.parentElement;
        if (!elt) return;
        startDragging({ elt: elt }, v);
    };

    export const dialogueBoxComponent = (
        header: Vdom,
        body: Vdom,
        footer: Vdom,
        props = null as IProps
    ): IVdom => {

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
                    onmousedown: startDraggingDialogueBox
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