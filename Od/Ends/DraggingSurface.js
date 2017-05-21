/// <reference path="Elements.ts"/>
var Od;
(function (Od) {
    var Drag;
    (function (Drag) {
        Drag.startX = 0;
        Drag.startY = 0;
        Drag.onDragCallback = null;
        Drag.onDragEndCallback = null;
        var draggingSurface = document.createElement("DIV");
        var stopDragging = function () {
            var callback = Drag.onDragEndCallback;
            Drag.onDragCallback = null;
            Drag.onDragEndCallback = null;
            var docBody = document.body;
            if (draggingSurface.parentNode === docBody) {
                docBody.removeChild(draggingSurface);
            }
            if (callback)
                callback();
        };
        var drag = function (v) {
            if (!Drag.onDragCallback)
                return;
            var pageX = v.pageX;
            var pageY = v.pageY;
            var deltaX = pageX - Drag.startX;
            var deltaY = pageY - Drag.startY;
            Drag.onDragCallback(pageX, pageY, deltaX, deltaY);
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
    })(Drag || (Drag = {}));
    ;
    Od.startDragging = function (args, v) {
        var elt = args.elt;
        var onDrag = args.onDrag;
        if (elt) {
            var rect = elt.getBoundingClientRect();
            var startLeft_1 = rect.left;
            var startTop_1 = rect.top;
            onDrag = function (x, y, dx, dy) {
                var left = startLeft_1 + dx;
                var top = startTop_1 + dy;
                elt.style.left = left.toString() + "px";
                elt.style.top = top.toString() + "px";
                if (args.onDrag)
                    args.onDrag(x, y, dx, dy);
            };
        }
        Drag.onDragCallback = onDrag;
        Drag.onDragEndCallback = args.onDragEnd;
        Drag.startX = v.pageX;
        Drag.startY = v.pageY;
    };
})(Od || (Od = {}));
