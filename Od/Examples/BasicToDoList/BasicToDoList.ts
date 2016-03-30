/// <reference path="../../Od/Od.ts"/>

namespace BasicToDoList {
    var e = Od.element;
    var todos = Obs.of([]);
    var total = Obs.fn(() => todos().length);
    var finished = Obs.fn(() => todos().filter(x => x.done()).length);
    var addTodo = what => {
        var todo = { done: Obs.of(false), what: what, cmpt: null };
        todo.cmpt = Od.component(() =>
            e("DIV", null, [
                e("INPUT", {
                    type: "checkbox",
                    checked: todo.done(),
                    onchange: v => {
                        todo.done(v.target.checked);
                    }
                }),
                what
            ])
        );
        todos().push(todo);
        todos(todos());
    };
    export var vdom = e("DIV", null, [
        e("H3", null, "To-do List"),
        Od.component(() => finished().toString()),
        " of ",
        Od.component(() => total().toString()),
        " completed.",
        Od.component(() => e("DIV", null, todos().map(x => x.cmpt))),
        "What next? ",
        e("INPUT", {
            onchange: v => {
                addTodo(v.target.value);
                v.target.value = "";
            }
        })
    ]);
}
window.onload = () => {
    Od.appendChild(BasicToDoList.vdom, document.body);
};