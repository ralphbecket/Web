/// <reference path="./Elements.ts" />
/// <reference path="./MergeProps.ts" />
var Od;
(function (Od) {
    Od.tabComponent = function (args) {
        var e = Od.element;
        var selection = args.selection || Obs.of(null);
        var vdom = Od.component(args.name, function () {
            var tabs = Obs.value(args.tabs);
            var vdom = Od.DIV(Od.mergeProps(Obs.value(args.props), { className: "OdTabComponent" }), [
                Od.DIV({ className: "OdTabHeadings" }, tabs.map(function (tab) { return tabHeading(selection, tab); })),
                Od.DIV({ className: "OdTabBody" }, tabBody(selection()))
            ]);
            return vdom;
        });
        return vdom;
    };
    var tabHeading = function (selection, tab) {
        var heading = Obs.value(tab.heading);
        var seln = Obs.value(selection);
        var className = (seln === tab
            ? "OdTabHeading OdTabSelection"
            : "OdTabHeading");
        var vdom = Od.DIV({
            className: className,
            onclick: function () {
                if (seln !== tab)
                    selection(tab);
            }
        }, heading);
        return vdom;
    };
    var tabBody = function (tab) {
        return Obs.value(tab && tab.body) || "";
    };
})(Od || (Od = {}));
