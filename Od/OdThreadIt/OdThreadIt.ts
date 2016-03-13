interface IComment {
    id: string;
    parent_id?: string;
    text: string;
    comment_count: number;
    children: string[];
}

enum State {
    LoadingThreads,
    LoadingThreadsFailed,
    ShowingThreads,
    LoadingComments,
    LoadingCommentsFailed,
    ShowingComments,
    SavingComment,
    SavingCommentFailed
}

const currentState = Obs.of(State.LoadingThreads);

const loadedComments = Obs.of([] as IComment[]);

type CommentDict = { [id: string]: IComment };

const idToComment = Obs.fn<CommentDict>(() => {
    const comments = loadedComments();
    const dict = {} as { [id: string]: IComment };
    const iTop = comments.length;
    for (var i = 0; i < iTop; i++) {
        const comment = comments[i];
        dict[comment.id] = comment;
    }
    return dict;
});

var currentThreadID = ""; // Set if viewing comments for a thread.

var commentBeingSaved = null as IComment; // Set if saving a new comment.

const e = Od.element;

const view = Od.component((): Od.Vdom => {
    const idToC = idToComment();
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
            vdom = viewThreads(loadedComments());
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
            vdom = viewComment(idToC, currentThreadID);
            break;
        case State.SavingComment:
            vdom = "Saving comment..."; // XXX This should be more graceful!
            break;
        case State.SavingCommentFailed:
            vdom = e("DIV", null, [
                "There was an error saving the new comment.",
                e("P", null, [
                    e("A",
                        { onclick: () => { saveComment(commentBeingSaved); } },
                        "Retry"
                    ),
                    " | ",
                    e("A",
                        { onclick: () => { currentState(State.ShowingComments); } },
                        "Forget it"
                    )
                ])
            ]);
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

const viewComment = (idToC: CommentDict, id: string): Od.Vdom => {
    const comment = idToC[id];
    const vdom = e("DIV", { className: "comment" }, [
        e("P", null, comment.text),
        e("DIV", { className: "reply" },
            e("A", null, "Reply!")
        ),
        e("DIV", { className: "children" },
            comment.children.map(x => viewComment(idToC, x))
        )
    ]);
    return vdom;
};

const plural = (n: number, singular: string, plural?: string): string =>
    n.toString() + " " +
    ( n === 1
    ? singular
    : plural
    ? plural
    : singular + "s"
    );

var currentXhrID = 0;

var nextXhrID = 1;

const saveComment = (newComment: IComment): void => {
    // XXX HERE!

};

const fetchThreads = (): void => {
    // Testing code for now.
    currentState(State.LoadingThreads);
    fetchTestThreads(
        (threads) => {
            loadedComments(threads);
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
            loadedComments(threadComments);
            currentState(State.ShowingComments);
        },
        () => {
            currentState(State.LoadingCommentsFailed);
        }
    );
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
(threadID: string, pass: (comments: IComment[]) => void, fail: (e: any) => void): void => {
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
    for (var j = 0; j < subComments.length; j++)
        comments.push(subComments[j]);

    return comments;
};

// ---- Routing. ----

// This is *really* simple!
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

// ---- Get the show on the road. ----

const main = (): void => {
    Od.appendChild(view, document.body);
    window.onhashchange = processLocationHash;
    processLocationHash();
};

window.onload = () => {
    main();
};