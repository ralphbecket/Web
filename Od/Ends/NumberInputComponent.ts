/// <reference path="InputComponent.ts"/>

namespace Od {

    export const numberInputComponent =
    (args: IInputComponentArgs<number>): IVdom => {
        if (!args.parseText) args.parseText = (text: string) =>
            (text && isFinite(+text) ? +text : args.obs());
        args.type = "number";
        return inputComponent(args);
    }

}