/// <reference path="InputComponent.ts"/>
var Od;
(function (Od) {
    Od.numberInputComponent = function (args) {
        if (!args.parseText)
            args.parseText = function (text) {
                return (text && isFinite(+text) ? +text : args.obs());
            };
        args.type = "number";
        return Od.inputComponent(args);
    };
})(Od || (Od = {}));
