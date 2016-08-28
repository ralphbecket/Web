/// <reference path="InputComponent.ts"/>

namespace Od {

    export const numberInputComponent =
    (args: InputComponentArgs<number>): Vdom => {
        if (!args.parseText) args.parseText = (text: string) =>
            (text && isFinite(+text) ? +text : args.obs());
        args.type = "number";
        return inputComponent(args);
    }

}