interface IComment {
    id: string;
    parent_id?: string;
    text: string;
    comment_count: number;
    children: string[];
    child_comments?: Obs.IObservable<IComment[]>;
}

enum State {
    LoadingThreads,
    LoadingThreadsFailed,
    ShowingThreads,
    LoadingComments,
    LoadingCommentsFailed,
    ShowingComments
}

const currentState = Obs.of(State.LoadingThreads);

var threads = [] as IComment[];

type CommentDict = { [id: string]: IComment };

var commentDict = {} as CommentDict;

const addNewComment = (newComment: IComment): void => {
    const id = newComment.id;
    const parentID = newComment.parent_id;
    commentDict[id] = newComment;
    newComment.child_comments = Obs.of([]);
    const parentComment = parentID && commentDict[parentID];
    if (parentComment) {
        const parentChildComments = parentComment.child_comments();
        parentChildComments.push(newComment);
        parentComment.child_comments(parentChildComments);
    }
};

const updateCommentDict = (newComments: IComment[]): void => {
    newComments.forEach(addNewComment);
};

var currentThreadID = null as string; // Set if viewing comments for a thread.

const e = Od.element;

const view = Od.component((): Od.Vdom => {
    var vdom = null as Od.Vdom | Od.Vdom[];
    switch (currentState()) {
        case State.LoadingThreads:
            vdom = "Loading threads...";
            break;
        case State.LoadingThreadsFailed:
            return e("DIV", null, [
                "There was an error loading the top-level threads.",
                e("P", null,
                    e("A", { onclick: () => { fetchThreads(); } }, "Retry")
                )
            ]);
            break;
        case State.ShowingThreads:
            vdom = viewThreads(threads);
            break;
        case State.LoadingComments:
            vdom = "Loading thread comments...";
            break;
        case State.LoadingCommentsFailed:
            vdom = e("DIV", null, [
                "There was an error loading the thread comments.",
                e("P", null,
                    e("A",
                        { onclick: () => { fetchComments(currentThreadID); } },
                        "Retry"
                    )
                )
            ]);
            break;
        case State.ShowingComments:
            const currentThread = commentDict[currentThreadID];
            vdom = viewCommentTree(currentThread);
            break;
        default:
            vdom = "Ohhhhhhh, God, nooooooo!  I am undone.";
            break;
    }
    return e("DIV", { className: "main" }, vdom);
});

const viewThreads = (threads: IComment[]): Od.Vdom[] => {
    const vdoms = [] as Od.Vdom[];
    const iTop = threads.length;
    for (var i = 0; i < iTop; i++) {
        const thread = threads[i];
        vdoms.push(e("A", { href: "#thread/" + thread.id },
            thread.text));
        vdoms.push(e("P", { className: "comment_count" },
            plural(thread.comment_count, "comment")));
        vdoms.push(e("HR"));
    }
    // XXX Add new thread post box.
    return vdoms;
};

const viewCommentTree = (comment: IComment): Od.Vdom => {
    const vdom = e("DIV", { className: "comment" }, [
        e("P", null, comment.text),
        e("DIV", { className: "reply" },
            commentReply(comment.id)
        ),
        e("DIV", { className: "children" },
            comment.child_comments().map(viewCommentTree)
        )
    ]);
    return vdom;
};

enum ReplyState {
    NotReplying,
    EditingReply,
    SendingReply,
    ReplyFailed
}

const commentReply = (parentID: string): Od.IVdom => {
    var replyText = Obs.of("");
    var replyState = Obs.of(ReplyState.NotReplying);
    return Od.component(() => {
        switch (replyState()) {
            case ReplyState.NotReplying: return (
                e("A",
                    {
                        onclick: () => { replyState(ReplyState.EditingReply); }
                    },
                    "Reply!"
                )
            );
            case ReplyState.EditingReply: return (
                e("FORM", null, [
                    e("TEXTAREA",
                        {
                            oninput: (e: any) => { replyText(e.target.value); }
                        }
                    ),
                    e("INPUT",
                        {
                            type: "submit",
                            value: "Reply!",
                            onclick: () => {
                                submitReply(parentID, replyText, replyState);
                            }
                        }
                    ),
                    e("DIV", { className: "preview" }, replyText())
                ])
            );
            case ReplyState.SendingReply: return (
                e("DIV", null, [
                    e("A", null, "Sending reply..."),
                    e("DIV", { className: "preview" }, replyText())
                ])
            );
            case ReplyState.ReplyFailed: return (
                e("DIV", null, [
                    e("A",
                        {
                            onclick: () => {
                                submitReply(parentID, replyText, replyState);
                            }
                        },
                        "Sending reply failed...  Retry"
                    ),
                    e("DIV", { className: "preview" }, replyText())
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
    sendTestReply(parentID, replyText(),
        (newComment) => {
            replyText("");
            addNewComment(newComment);
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
    // Testing code for now.
    currentState(State.LoadingThreads);
    fetchTestThreads(
        (newThreads) => {
            threads = newThreads;
            currentState(State.ShowingThreads);
        },
        () => {
            currentState(State.LoadingThreadsFailed);
        }
    );
};

const fetchComments = (id: string): void => {
    // Testing code for now.
    currentThreadID = id;
    currentState(State.LoadingComments);
    fetchTestComments(id,
        (threadComments) => {
            commentDict = {};
            updateCommentDict(threadComments);
            currentState(State.ShowingComments);
        },
        () => {
            currentState(State.LoadingCommentsFailed);
        }
    );
};

// ---- Get the show on the road. ----

const main = (): void => {
    Od.appendChild(view, document.body);
    window.onhashchange = processLocationHash;
    processLocationHash();
};

window.onload = () => {
    main();
};

// ---- Testing code. ----

const fetchTestThreads =
(pass: (comments: IComment[]) => void, fail: (e?: any) => void): void => {
    setTimeout(() => {
        if (Math.random() < 0.1) {
            fail("Disaster!");
            return;
        }
        const threads = genTestThreads(7);
        pass(threads);
    }, 200);
};

const fetchTestComments =
(   threadID: string,
    pass: (comments: IComment[]) => void,
    fail: (e: any) => void
): void => {
    setTimeout(() => {
        if (Math.random() < 0.1) {
            fail("Calamity!");
            return;
        }
        const thread = {
            id: threadID,
            text: "Blah blah blah " + threadID,
            children: [] as string[],
            comment_count: 0
        } as IComment;
        const threadComments = genTestComments(3, 3, thread.id);
        const children =
            threadComments.filter(x => x.parent_id === threadID).map(x => x.id);
        thread.children = children;
        thread.comment_count = children.length;
        threadComments.unshift(thread);
        pass(threadComments);
    }, 200);
};

const sendTestReply =
(   parentID: string,
    replyText: string,
    pass: (comment: IComment) => void,
    fail: (e: any) => void
): void => {
    setTimeout(() => {
        if (Math.random() < 0.4) {
            fail("Ragnarok!");
            return;
        }
        const comment = {
            id: (nextTestCommentID++).toString(),
            text: replyText,
            children: [],
            comment_count: 0,
            parent_id: parentID
        } as IComment;
        pass(comment);
    }, 200);
};

var nextTestCommentID = 1;

const genTestThreads =
(maxThreads = 7): IComment[] => {
    const threads = [] as IComment[];
    const numThreads = 1 + Math.floor(maxThreads * Math.random());
    for (var i = 0; i < numThreads; i++) {
        const id = (nextTestCommentID++).toString();
        const thread = {
            id: id,
            text: "Blah blah blah " + id,
            children: [],
            comment_count: Math.floor(Math.random() * 5)
        } as IComment;
        threads.push(thread);
    }
    return threads;
};

const genTestComments =
(maxChildren = 3, maxDepth = 1, parentID = null as string): IComment[] => {

    const comments = [] as IComment[];
    const id = (nextTestCommentID++).toString();
    const subComments = [] as IComment[];
    if (1 < maxDepth) for (var i = Math.floor(maxChildren * Math.random()); i; i--) {
        const subSubComments = genTestComments(maxChildren, maxDepth - 1, id);
        for (var j = 0; j < subSubComments.length; j++)
            subComments.push(subSubComments[j]);
    }
    const children = subComments.filter(x => x.parent_id === id).map(x => x.id);
    const numChildren = children.length;
    const comment = {
        id: id,
        parent_id: parentID,
        text: "Blah blah blah " + id,
        comment_count: numChildren,
        children: children
    } as IComment;
    comments.push(comment);
    for (var j = 0; j < subComments.length; j++) comments.push(subComments[j]);

    return comments;
};

// ---- Routing. ----

// This is a *really* simple router!
const processLocationHash = (): void => {
    const hash = window.location.hash.substr(1);
    const parts = hash.split("/");
    switch (parts[0]) {
        case "thread":
            fetchComments(parts[1]);
            return;
        default:
            fetchThreads();
            return;
    }
};
