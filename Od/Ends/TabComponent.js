/// <reference path="./WithClassName.ts" />
var Od;
(function (Od) {
    Od.tabComponent = function (args) {
        var e = Od.element;
        var selection = args.selection || Obs.of(null);
        var vdom = Od.component(function () {
            var tabs = Obs.value(args.tabs);
            var vdom = e("DIV", Od.withClassName("OdTabComponent", Obs.value(args.props)), [
                e("DIV", { className: "OdTabHeadings" }, tabs.map(function (tab) { return tabHeading(selection, tab); })),
                e("DIV", { className: "OdTabBody" }, tabBody(selection()))
            ]);
            return vdom;
        });
        return vdom;
    };
    var tabHeading = function (selection, tab) {
        var e = Od.element;
        var heading = Obs.value(tab.heading);
        var seln = Obs.value(selection);
        var className = (seln === tab
            ? "OdTabHeading OdTabSelection"
            : "OdTabHeading");
        var vdom = e("DIV", {
            className: className,
            onclick: function () {
                if (seln !== tab)
                    selection(tab);
            }
        }, heading);
        return vdom;
    };
    var tabBody = function (selection) {
        return selection ? selection.body : "";
    };
})(Od || (Od = {}));
