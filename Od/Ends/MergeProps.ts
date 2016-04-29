/// <reference path="../Od/Od.ts"/>

namespace Od {

    // Merge a list of property sets, giving priority to property sets
    // later in the list.  "className" and "style" properties are merged
    // in the way you'd expect, as a biased union.  Null property sets
    // are ignored.
    export const mergeProps = (...propsList: IProps[]): IProps => {
        const resultProps = {} as IProps;
        for (var i = 0; i < propsList.length; i++) {
            const inputProps = propsList[i];
            if (!inputProps) continue;
            for (var prop in inputProps) {
                const value = inputProps[prop];
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

    const mergeClassName = (newClassNames: string, props: IProps): void => {
        const currClassNames = props["className"];
        if (!currClassNames) {
            props["className"] = newClassNames;
            return;
        }
        const currClasses = currClassNames.split(" ");
        const newClasses = newClassNames.split(" ");
        for (var i = newClasses.length - 1; 0 <= i; i--) {
            const newClass = newClasses[i];
            for (var j = currClasses.length - 1; 0 <= j; j--) {
                if (newClass === currClasses[j]) break;
            }
            if (j === -1) currClasses.push(newClass);
        }
        props["className"] = currClasses.join(" ");
    };

    const mergeStyle = (newStyle: IProps, props: IProps): void => {
        const currStyle = props["style"];
        if (!currStyle) {
            props["style"] = newStyle;
            return;
        }
        for (var style in newStyle) currStyle[style] = newStyle[style];
    };

}
