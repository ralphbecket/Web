/// <reference path="../Od/Od.ts" />
var Od;
(function (Od) {
    Od.withClassName = function (name, props) {
        props = props || {};
        var className = props["className"] || "";
        name = " " + name + " ";
        var nameIsAbsent = className.indexOf(name) === -1;
        if (nameIsAbsent)
            props["className"] = name + className;
        return props;
    };
})(Od || (Od = {}));
