/// <reference path="../../Ends/Elements.ts"/>
var n = Obs.of(0);
var view = Od.component("view", function () {
    return Od.BUTTON({
        onodevent: function (what, dom) {
            Od.appendChild(Od.P("Button " + what), document.body);
        },
        onclick: function () { n(n() + 1); }
    }, n().toString());
});
window.onload = function () {
    Od.appendChild(view, document.body);
};
//# sourceMappingURL=DemoOdLifecycle.js.map