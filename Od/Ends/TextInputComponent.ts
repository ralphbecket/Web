/// <reference path="InputComponent.ts"/>

namespace Od {

    export const textInputComponent =
    (args: InputComponentArgs<string>): Vdom =>
        inputComponent(args);

}