/// <reference path="InputComponent.ts"/>

namespace Od {

    export const textInputComponent =
    (args: IInputComponentArgs<string>): IVdom =>
        inputComponent(args);

}