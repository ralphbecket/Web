/// <reference path="Elements.d.ts" />
declare namespace Od {
    type OnDragCallback = (pageX: number, pageY: number, deltaX?: number, deltaY?: number) => void;
    interface DragArgs {
        elt?: HTMLElement;
        onDrag?: OnDragCallback;
        onDragEnd?: () => void;
    }
    const startDragging: (args: DragArgs, v: MouseEvent) => void;
}
