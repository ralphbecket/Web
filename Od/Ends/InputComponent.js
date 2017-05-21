/// <reference path="../Ends/Elements.ts" />
/// <reference path="../Ends/MergeProps.ts" />
var Od;
(function (Od) {
    ;
    Od.inputComponent = function (args) {
        return Od.component(args.componentName, function () { return inputComponentVdom(args); });
    };
    var inputComponentVdom = function (args) {
        var obs = args.obs;
        var props = Obs.value(args.props);
        var type = args.type || "text";
        var bindTo = args.bindTo || "value";
        var updateOn = args.updateOn || "onchange";
        var formatObs = args.formatObs;
        var parseText = args.parseText;
        var obsProps = { type: type };
        obsProps[bindTo] = (formatObs ? formatObs(obs()) : obs());
        obsProps[updateOn] = function (v) {
            var value = v.target[bindTo];
            obs(parseText ? parseText(value) : value);
        };
        var allProps = Od.mergeProps(props, obsProps);
        return Od.INPUT(allProps);
    };
})(Od || (Od = {}));
