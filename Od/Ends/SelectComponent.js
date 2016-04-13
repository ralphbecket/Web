/// <reference path="./Elements.ts" />
var Od;
(function (Od) {
    Od.selectComponent = function (args) {
        var props = args.props || {};
        props["onchange"] = function (v) {
            updateSelection(Obs.value(args.options), args.selection, v.target.selectedIndex);
        };
        var optionView = args.optionView || defaultOptionView;
        var e = Od.element;
        var vdom = Od.component(function () {
            var props = args.props || {};
            var options = Obs.value(args.options);
            var selection = args.selection();
            var iTop = options.length;
            for (var i = 0; i < iTop; i++)
                if (options[i] === selection)
                    break;
            if (i === iTop) {
                if (selection !== null)
                    args.selection(null);
                i = -1;
            }
            props["selectedIndex"] = i;
            var vdom = Od.SELECT(props, options.map(function (x) { return Od.OPTION(optionView(x)); }));
            return vdom;
        });
        return vdom;
    };
    var updateSelection = function (options, selection, i) {
        if (i == null)
            return;
        selection(options[i]);
    };
    var defaultOptionView = function (x) {
        return (x == null) ? "null" : x.toString();
    };
})(Od || (Od = {}));
