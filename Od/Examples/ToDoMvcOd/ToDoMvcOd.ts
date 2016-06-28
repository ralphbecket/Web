/// <reference path="../../Ends/Elements.ts"/>

interface IToDo {
    id: number;
    what: string;
    done: Obs.IObservable<boolean>;
}

interface IRawToDo {
    id: number;
    what: string;
    done: boolean;
}

var nextToDoId = 1; // A name supply.

const loadToDos = (): IToDo[] =>
    JSON.parse(localStorage.getItem("todos") || "[]").map((x: IRawToDo) => ({
        id: x.id, what: x.what, done: Obs.of(x.done)
    }) as IToDo);

const toDos = Obs.of(loadToDos());

const saveToDos = () => {
    localStorage.setItem("todos", JSON.stringify(toDos().map(x => ({
        id: x.id, what: x.what, done: x.done()
    }) as IRawToDo)));
}

const numTotal = Obs.fn(() => toDos().length);

const numNotDone = Obs.fn(() => toDos().filter(x => !x.done()).length);

const haveSomeToDos = Obs.fn(() => numTotal() !== 0);

const haveSomeCompletedToDos = Obs.fn(() => toDos().some(x => x.done()));

const allDone = Obs.fn(() => numNotDone() === 0);

const toDoBeingEdited = Obs.of(null as IToDo);

var uneditedToDoWhat = "";

const newToDo = Obs.of("");

const hiddenDoneValue = Obs.of( // All the routing one needs!
    location.hash === "#active" ? true :
    location.hash === "#completed" ? false :
    null as boolean
);

const numToDosShowing = Obs.fn(() =>
    toDos().filter(x => x.done() !== hiddenDoneValue()).length
);

const keyHandler = (keys: { [key: string]: () => void }) =>
    (v: KeyboardEvent): void => {
        const key = v.key;
        const handler = keys && keys[key];
        if (handler) handler();
    };

const newToDoKeyHandler = keyHandler({
    "Enter": () => {
        const what = newToDo().trim();
        if (!what) return;
        toDos().push({ id: nextToDoId++, what: what, done: Obs.of(false) });
        saveToDos();
        newToDo("");
        Obs.updateDependents(toDos);
    },
    "Escape": () => {
        newToDo("");
    }
});

const editToDoKeyHandler = keyHandler({
    "Enter": () => {
        toDoBeingEdited(null);
    },
    "Escape": () => {
        toDoBeingEdited().what = uneditedToDoWhat;
        toDoBeingEdited(null);
    }
});

const hideUnless = (x: boolean) => ({ display: x ? "" : "none" }) as any;

const toDoComponent = (toDo: IToDo): Od.Vdom => Od.component(toDo.id, () =>
    Od.LI({
        className:
            (toDoBeingEdited() === toDo ? "editing " : "") +
            (toDo.done() ? "completed " : ""),
        style: hideUnless(toDo.done() !== hiddenDoneValue())
    }, [
        Od.DIV({ className: "view" }, [
            Od.INPUT({
                className: "toggle",
                type: "checkbox",
                checked: toDo.done(),
                onclick: (v: Event): void => {
                    toDo.done((v.target as HTMLInputElement).checked);
                    saveToDos();
                }
            }),
            Od.LABEL({
                ondblclick: (v: Event): void => {
                    uneditedToDoWhat = toDo.what;
                    toDoBeingEdited(toDo);
                    const focusEditInput = () => {
                        (v.target as any).parentElement.nextElementSibling.focus();
                    };
                    setTimeout(focusEditInput, 20);
                }
            }, toDo.what),
            Od.BUTTON({
                className: "destroy",
                onclick: (v: Event): void => {
                    toDos(toDos().filter(x => x !== toDo));
                    saveToDos();
                }
            })
        ]),
        Od.INPUT({
            className: "edit",
            value: toDo.what,
            onkeyup: editToDoKeyHandler,
            oninput: (v: Event): void => {
                toDo.what = ((v.target as HTMLInputElement).value);
            },
            onblur: (v: Event): void => {
                toDoBeingEdited(null);
                saveToDos();
            }
        })
    ])
);

const view = Od.component("ToDoMvcOd", () => Od.DIV({ id: "todoapp" }, [
    Od.HEADER({ id: "header" }, [
        Od.H1("todos"),
        Od.INPUT({
            id: "new-todo",
            placeholder: "What needs to be done?",
            autofocus: true,
            value: newToDo(),
            oninput: (v: Event) => {
                newToDo((v.target as HTMLInputElement).value);
            },
            onkeyup: newToDoKeyHandler
        }),
        Od.SECTION({ id: "main", style: hideUnless(haveSomeToDos()) }, [
            Od.INPUT({
                id: "toggle-all",
                type: "checkbox",
                checked: allDone(),
                onchange: (v: Event) => {
                    const state = !allDone();
                    const todos = toDos();
                    for (var i = 0; i < todos.length; i++) todos[i].done(state);
                }
            }),
            Od.UL({ id: "todo-list" }, toDos().map(toDoComponent))
        ])
    ]),
    Od.FOOTER({ id: "footer", style: hideUnless(haveSomeToDos()) }, [
        Od.SPAN({ id: "todo-count" }, [
            Od.STRONG(numNotDone().toString()),
            " item",
            (numNotDone() === 1 ? "" : "s"),
            " left"
        ]),
        Od.UL({ id: "filters" }, [
            Od.LI(Od.A({
                href: "#",
                className: hiddenDoneValue() === null ? "selected" : "",
                onclick: () => { hiddenDoneValue(null); }
            }, "All")),
            Od.LI(Od.A({
                href: "#active",
                className: hiddenDoneValue() === true ? "selected" : "",
                onclick: () => { hiddenDoneValue(true); }
            }, "Active")),
            Od.LI(Od.A({
                href: "#completed",
                className: hiddenDoneValue() === false ? "selected" : "",
                onclick: () => { hiddenDoneValue(false); }
            }, "Completed"))
        ]),
        Od.BUTTON({
            id: "clear-completed",
            style: hideUnless(haveSomeCompletedToDos()),
            onclick: () => {
                toDos(toDos().filter(x => !x.done()));
            }
        }, "Clear completed")
    ])
]));

window.onload = () => {
    Od.appendChild(view, document.body);
};