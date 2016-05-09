// Od version of ThreadIt.
//
// Od's view components update independently without requiring a complete
// rebuild of the entire vDOM or patching the entire DOM.

/// <reference path="../../Ends/Elements.ts"/>
/// <reference path="../../Ends/Jigsaw.ts"/>
/// <reference path="../../Ends/Xhr.ts"/>

declare var T: any; // This is the ThreadIt API.  Should give it a type...

interface IComment {
    id: string;
    parent_id?: string;
    text: string;
    comment_count: number;
    children: string[];
    child_comments?: Obs.IObservable<IComment[]>;
}

var threads = [] as IComment[];

var commentDict = {} as { [id: string]: IComment };

var currentThreadID = null as string; // Set if viewing comments for a thread.

const addNewComment = (newComment: IComment): void => {
    const id = newComment.id;
    const parentID = newComment.parent_id;
    commentDict[id] = newComment;
    newComment.child_comments = Obs.of([]);
    const parentComment = parentID && commentDict[parentID];
    if (parentComment) {
        parentComment.child_comments().push(newComment);
        Obs.updateDependents(parentComment.child_comments);
    }
};

const updateCommentDict = (newComments: IComment[]): void => {
    newComments.forEach(addNewComment);
};

enum State {
    LoadingThreads,
    LoadingThreadsFailed,
    ShowingThreads,
    LoadingComments,
    LoadingCommentsFailed,
    ShowingComments
}

const currentState = Obs.of(State.LoadingThreads);

const view = Od.component("main", (): Od.Vdom => {
    var vdom = null as Od.Vdom | Od.Vdom[];
    switch (currentState()) {
        case State.LoadingThreads:
            vdom = "Loading threads...";
            break;
        case State.LoadingThreadsFailed:
            vdom = [
                "There was an error loading the top-level threads.",
                Od.P(Od.A({ onclick: () => { fetchThreads(); } }, "Retry"))
            ];
            break;
        case State.ShowingThreads:
            vdom = viewThreads(threads);
            break;
        case State.LoadingComments:
            vdom = "Loading thread comments...";
            break;
        case State.LoadingCommentsFailed:
            vdom = [
                "There was an error loading the thread comments.",
                Od.P(
                    Od.A(
                        { onclick: () => { fetchComments(currentThreadID); } },
                        "Retry"
                    )
                )
            ];
            break;
        case State.ShowingComments:
            vdom = viewCommentTree(commentDict[currentThreadID]);
            break;
    }
    return Od.DIV({ className: "main" }, vdom);
});

const viewThreads = (threads: IComment[]): Od.Vdom[] => {
    const vdoms = [] as Od.Vdom[];
    const iTop = threads.length;
    for (var i = 0; i < iTop; i++) {
        const thread = threads[i];
        vdoms.push(Od.A({ href: "#thread/" + thread.id },
            T.trimTitle(thread.text)));
        vdoms.push(Od.P({ className: "comment_count" },
            plural(thread.comment_count, "comment")));
        vdoms.push(Od.HR());
    }
    // XXX Add new thread post box.
    vdoms.push(commentReply("post", true, ""));
    return vdoms;
};

const viewCommentTree = (comment: IComment): Od.Vdom =>
    Od.DIV({ className: "comment" }, [
        Od.fromHtml(comment.text),
        Od.DIV({ className: "reply" }, commentReply("reply", false, comment.id) ),
        Od.DIV({ className: "children" },
            comment.child_comments().map(viewCommentTree)
        )
    ]);

enum ReplyState {
    NotReplying,
    EditingReply,
    SendingReply,
    ReplyFailed
}

const commentReply =
(   what: string,
    editing: boolean,
    parentID: string
): Od.IVdom => {
    const replyText = Obs.of("");
    const replyState = Obs.of(
        editing ? ReplyState.EditingReply : ReplyState.NotReplying
    );
    const What = what[0].toUpperCase() + what.slice(1) + "!";
    // Named components persist across re-evaluations of their parent
    // components, saving quite a lot of work.  Anonymous components
    // would be recreated each time their parent components were
    // re-evaluated.
    return Od.component(parentID, () => {
        switch (replyState()) {
            case ReplyState.NotReplying: return (
                Od.A(
                    {
                        onclick: () => { replyState(ReplyState.EditingReply); }
                    },
                    What
                )
            );
            case ReplyState.EditingReply: return (
                Od.FORM([
                    Od.TEXTAREA({
                        oninput: (e: any) => { replyText(e.target.value); }
                    }),
                    Od.INPUT({
                        type: "submit",
                        value: What,
                        onclick: () => {
                            submitReply(parentID, replyText, replyState);
                        }
                    }),
                    Od.DIV({ className: "preview" },
                        Od.fromHtml(T.previewComment(replyText()))
                    )
                ])
            );
            case ReplyState.SendingReply: return (
                Od.DIV([
                    Od.A("Sending " + what + "..."),
                    Od.DIV({ className: "preview" }, replyText())
                ])
            );
            case ReplyState.ReplyFailed: return (
                Od.DIV([
                    Od.A({
                            onclick: () => {
                                submitReply(parentID, replyText, replyState);
                            }
                        },
                        "Sending " + what + " failed...  Retry"
                    ),
                    Od.DIV({ className: "preview" }, replyText())
                ])
            );
        }
    });
};

const submitReply =
(   parentID: string,
    replyText: Obs.IObservable<string>,
    replyState: Obs.IObservable<ReplyState>
): void => {
    replyState(ReplyState.SendingReply);
    var body = "text=" + encodeURIComponent(replyText());
    if (parentID) body += "&parent=" + encodeURIComponent(parentID);
    Xhr.send("http://api.threaditjs.com/comments/create", {
        method: "POST",
        requestHeaders: { "Content-type": "application/x-www-form-urlencoded" },
        data: body
    }).then(
        xhr => {
            replyText("");
            addNewComment(parseResponseText(xhr));
            replyState(ReplyState.NotReplying);
        },
        (e: any) => {
            replyState(ReplyState.ReplyFailed);
        }
    );
};

const plural = (n: number, singular: string, plural?: string): string =>
    n.toString() + " " +
    ( n === 1 ? singular : (plural || singular + "s") );

const fetchThreads = (): void => {
    currentState(State.LoadingThreads);
    Xhr.send("http://api.threaditjs.com/threads").then(
        xhr => {
            threads = parseResponseText(xhr);
            currentState(State.ShowingThreads);
        },
        err => {
            currentState(State.LoadingThreadsFailed);
        }
    );
};

const fetchComments = (id: string): void => {
    currentThreadID = id;
    currentState(State.LoadingComments);
    Xhr.send("http://api.threaditjs.com/comments/" + id).then(
        xhr => {
            commentDict = {};
            updateCommentDict(parseResponseText(xhr));
            currentState(State.ShowingComments);
        },
        err => {
            currentState(State.LoadingCommentsFailed);
        }
    );
};

const parseResponseText = (xhr: XMLHttpRequest): any => {
    var package = JSON.parse(xhr.responseText);
    if (!("data" in package)) throw (xhr.responseText);
    return package.data;
};

// ---- Routing and other initialisation. ----

const main = (): void => {
    Jigsaw.addRoute("thread/:id", args => {
        fetchComments(args[":id"] as string);
    });
    Jigsaw.defaultRouteHandler = () => {
        fetchThreads();
    };
    Jigsaw.startRouter();
    Jigsaw.takeRoute(window.location.hash.substr(1));
    Od.appendChild(view, document.body);
};

// ---- Get the show on the road. ----

window.onload = () => {
    main();
};

