/// <reference path="InputComponent.ts"/>

namespace Od {

    export const textInputComponent =
    (args: IInputComponentArgs<string>): Vdom =>
        inputComponent(args);

}