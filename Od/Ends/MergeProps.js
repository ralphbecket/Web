/// <reference path="../Od/Od.ts"/>
var Od;
(function (Od) {
    // Merge a list of property sets, giving priority to property sets
    // later in the list.  "className" and "style" properties are merged
    // in the way you'd expect, as a biased union.  Null property sets
    // are ignored.
    Od.mergeProps = function () {
        var propsList = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            propsList[_i] = arguments[_i];
        }
        var resultProps = {};
        for (var i = 0; i < propsList.length; i++) {
            var inputProps = propsList[i];
            if (!inputProps)
                continue;
            for (var prop in inputProps) {
                var value = inputProps[prop];
                switch (prop) {
                    case "class":
                    case "className":
                        mergeClassName(value, resultProps);
                        break;
                    case "style":
                        mergeStyle(value, resultProps);
                        break;
                    default:
                        resultProps[prop] = value;
                }
            }
        }
        return resultProps;
    };
    var mergeClassName = function (newClassNames, props) {
        var currClassNames = props["className"];
        if (!currClassNames) {
            props["className"] = newClassNames;
            return;
        }
        var currClasses = currClassNames.split(" ");
        var newClasses = newClassNames.split(" ");
        for (var i = newClasses.length - 1; 0 <= i; i--) {
            var newClass = newClasses[i];
            for (var j = currClasses.length - 1; 0 <= j; j--) {
                if (newClass === currClasses[j])
                    break;
            }
            if (j === -1)
                currClasses.push(newClass);
        }
        props["className"] = currClasses.join(" ");
    };
    var mergeStyle = function (newStyle, props) {
        var currStyle = props["style"];
        if (!currStyle) {
            props["style"] = newStyle;
            return;
        }
        for (var style in newStyle)
            currStyle[style] = newStyle[style];
    };
})(Od || (Od = {}));
