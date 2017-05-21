/// <reference path="InputComponent.ts"/>
var Od;
(function (Od) {
    Od.checkboxComponent = function (args) {
        return Od.component(args.componentName, function () { return checkboxComponentView(args); });
    };
    var checkboxComponentView = function (args) {
        var obs = args.obs;
        var props = args.props;
        var checkboxProps = {
            type: "checkbox",
            checked: obs(),
            onchange: function (v) {
                obs(v.target.checked);
            }
        };
        if (props)
            checkboxProps = Od.mergeProps(props, checkboxProps);
        return Od.INPUT(checkboxProps);
    };
})(Od || (Od = {}));
