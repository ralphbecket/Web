// <reference path="Elements.ts"/>

namespace Od {

    namespace Drag {

        export var startX = 0;
        export var startY = 0;
        export var onDragCallback = null as OnDragCallback;
        export var onDragEndCallback = null as () => void;
        export const draggingSurface = document.createElement("DIV");

        const stopDragging = (): void => {
            const callback = onDragEndCallback;
            onDragCallback = null;
            onDragEndCallback = null;
            if (draggingSurface.parentNode) {
                draggingSurface.parentNode.removeChild(draggingSurface);
            }
            if (callback) callback();
        };

        const drag = (v: MouseEvent): void => {
            if (!onDragCallback) return;
            const pageX = v.pageX;
            const pageY = v.pageY;
            const deltaX = pageX - startX;
            const deltaY = pageY - startY;
            onDragCallback(pageX, pageY, deltaX, deltaY);
        };

        draggingSurface.style.position = "fixed";
        draggingSurface.style.left = "0px";
        draggingSurface.style.top = "0px";
        draggingSurface.style.width = "100%";
        draggingSurface.style.height = "100%";
        draggingSurface.style.opacity = "0";
        draggingSurface.onmousemove = drag;
        draggingSurface.onmouseup = stopDragging;
        draggingSurface.onmouseleave = stopDragging;
        draggingSurface.ontouchend = stopDragging;

    }

    export type OnDragCallback = (
        pageX: number,
        pageY: number,
        deltaX?: number, // Delta from the start of dragging.
        deltaY?: number  // Ditto.
    ) => void;

    export interface DragArgs {
        elt?: HTMLElement; // This overrides onDrag.
        onDrag?: OnDragCallback;
        onDragEnd?: () => void;
    };

    export const startDragging = (args: DragArgs, v: MouseEvent): void => {
        const elt = args.elt;
        var onDrag = args.onDrag;
        if (elt) {
            const rect = elt.getBoundingClientRect();
            const startLeft = rect.left;
            const startTop = rect.top;
            onDrag = (x, y, dx, dy) => {
                const left = startLeft + dx;
                const top = startTop + dy;
                elt.style.left = left.toString() + "px";
                elt.style.top = top.toString() + "px";
                if (args.onDrag) args.onDrag(x, y, dx, dy);
            };
        }
        Drag.onDragCallback = onDrag;
        Drag.onDragEndCallback = args.onDragEnd;
        Drag.startX = v.pageX;
        Drag.startY = v.pageY;
        document.body.appendChild(Drag.draggingSurface);
    };

}