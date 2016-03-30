﻿/// <reference path="../../Od/Od.ts"/>
/// <reference path="../TestHarness/Test.ts"/>

window.onload = () => {

    Od.deferComponentUpdates = false; // Deferred updates make testing harder.

    const e = Od.element;
    const t = Od.text;
    const d = (v: Od.Vdom): Node => Od.patchDom(v, null, null);

    const nav = (dom: Node, path: number[]): Node => {
        var iTop = path.length;
        for (var i = 0; i < iTop; i++) {
            dom = dom.childNodes[path[i]];
            if (!dom) throw new Error("Node does not match path " +
                JSON.stringify(path)
            );
        }
        return dom;
    };

    const chk =
    (   dom: Node,
        path: number[],
        tag: string,
        numChildren?: number,
        props?: Object
    ): boolean => {
        var dom = nav(dom, path);
        var textMatches =
            (dom.nodeType === Node.TEXT_NODE) &&
            (tag[0] === "#") &&
            (dom.textContent === tag.substr(1));
        var tagMatches =
            ((dom as HTMLElement).tagName === tag);
        if (!textMatches && !tagMatches)
            throw new Error("Node tag is not " + tag);
        if (numChildren != undefined && dom.childNodes.length != numChildren)
            throw new Error("Node does not have " + numChildren + " children.");
        return chkProps(dom, props);
    };

    const chkProps = (dom: Node, props: Object): boolean => {
        if (!props) return true;
        for (var key in props) {
            const value = props[key];
            if ((value && dom[key] !== value))
                throw new Error("Node does not have expected value for " +
                    key);
            if ((!value && dom[key]))
                throw new Error("Node has unexpected value for " +
                    key);
        }
        return true;
    };

    const same = (x: Node, y: Node): boolean => {
        if (x === y) return true;
        throw ("Nodes should be identical.");
    };

    const diff = (x: Node, y: Node): boolean => {
        if (x !== y) return true;
        throw ("Nodes should be different.");
    };

    Test.run("Patch xyz vs null", () => {
        var A = "xyz";
        var B = null as Node;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "#xyz");
    });

    Test.run("Patch xyz vs pqr", () => {
        var A = "xyz";
        var B = d("pqr");
        var C = Od.patchDom(A, B, null);
        chk(C, [], "#xyz");
        same(B, C);
    });

    Test.run("Patch xyz vs xyz", () => {
        var A = "xyz";
        var B = d("xyz");
        var C = Od.patchDom(A, B, null);
        chk(C, [], "#xyz");
        same(B, C);
    });

    Test.run("Patch xyz vs DIV", () => {
        var A = "xyz";
        var B = d(e("DIV"));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "#xyz");
        diff(B, C);
    });

    Test.run("Patch DIV(xyz) vs null", () => {
        var A = e("DIV", null, "xyz");
        var B = null;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
    });

    Test.run("Patch DIV(xyz) vs pqr", () => {
        var A = e("DIV", null, "xyz");
        var B = d("pqr");
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        diff(B, C);
    });

    Test.run("Patch DIV(xyz) vs DIV(pqr)", () => {
        var A = e("DIV", null, "xyz");
        var B = d(e("DIV", null, "pqr"));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        same(B, C);
    });

    Test.run("Patch DIV(xyz) vs P", () => {
        var A = e("DIV", null, "xyz");
        var B = d(e("P"));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        diff(B, C);
    });

    Test.run("Patch DIV vs DIV(pqr, qrs)", () => {
        var A = e("DIV");
        var B = d(e("DIV", null, ["pqr", "qrs"]));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 0);
        same(B, C);
    });

    Test.run("Patch DIV(xyz) vs DIV(pqr, qrs)", () => {
        var A = e("DIV", null, "xyz");
        var B = d(e("DIV", null, ["pqr", "qrs"]));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        same(B, C);
    });

    Test.run("Patch DIV(xyz, wxy) vs DIV(pqr)", () => {
        var A = e("DIV", null, ["xyz", "wxy"]);
        var B = d(e("DIV", null, "pqr"));
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 2);
        chk(C, [0], "#xyz");
        chk(C, [1], "#wxy");
        same(B, C);
    });

    Test.run("Patch Cmpt(DIV(xyz) -> DIV(wxy)) vs null", () => {
        const text = Obs.of("xyz");
        const cmpt = Od.component(() => e("DIV", null, text()));
        const A = cmpt;
        const B = null;
        var C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#xyz");
        text("wxy");
        chk(C, [], "DIV", 1);
        chk(C, [0], "#wxy");
    });

    Test.run("Patch DIV(Cmpt(DIV), Cmpt(P)) -> DIV(Cmpt(P), Cmpt(DIV)) vs null",
    () => {
        const X = Od.component(() => e("DIV"));
        const Y = Od.component(() => e("P"));
        const A1 = e("DIV", null, [X, Y]);
        const B = null;
        const C1 = Od.patchDom(A1, B, null);
        chk(C1, [], "DIV", 2);
        const C10 = nav(C1, [0]);
        const C11 = nav(C1, [1]);
        chk(C10, [], "DIV", 0);
        chk(C11, [], "P", 0);
        const A2 = e("DIV", null, [Y, X]);
        const C2 = Od.patchDom(A2, C1, null);
        chk(C2, [], "DIV", 2);
        const C20 = nav(C2, [0]);
        const C21 = nav(C2, [1]);
        chk(C20, [], "P", 0);
        chk(C21, [], "DIV", 0);
        same(C10, C21);
        same(C11, C20);
    });

    Test.run("Patch Cmpt(DIV(P(xyz) -> pqr)) vs null", () => {
        const X = e("P", null, "xyz");
        const T = Obs.of(true);
        const A = Od.component(() => e("DIV", null, T() ? X : "pqr"));
        const B = null;
        const C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "P", 1);
        chk(C, [0, 0], "#xyz");
        T(false);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#pqr");
    });

    Test.run("Deleting the DOM of a live component.", () => {
        const X = Obs.of("Hi!");
        const A = Od.component(() => e("DIV", null, X()));
        const B = null;
        const C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "#Hi!");
        A.dom = null;
        X("Bye.");
        const D = Od.patchDom(A, B, null);
        chk(D, [], "DIV", 1);
        chk(D, [0], "#Bye.");
    });

    Test.run("Keyed lists.", () => {
        const x = e("P", { key: "x" });
        const y = e("SPAN", { key: "y" });
        const z = e("TABLE", { key: "z" });
        const A1 = e("DIV", { keyed: true }, [x, y, z]);
        const B = null;
        const C = Od.patchDom(A1, B, null);
        chk(C, [], "DIV", 3);
        chk(C, [0], "P");
        chk(C, [1], "SPAN");
        chk(C, [2], "TABLE");
        const C0 = nav(C, [0]);
        const C1 = nav(C, [1]);
        const C2 = nav(C, [2]);
        const A2 = e("DIV", { keyed: true }, [y, z, x]);
        const D = Od.patchDom(A2, C, null);
        chk(D, [], "DIV", 3);
        chk(D, [0], "SPAN");
        chk(D, [1], "TABLE");
        chk(D, [2], "P");
        const D0 = nav(D, [0]);
        const D1 = nav(D, [1]);
        const D2 = nav(D, [2]);
        same(C0, D2);
        same(C1, D0);
        same(C2, D1);
    });

    Test.run("Dom from HTML strings.", () => {
        const X = Od.fromHtml("<H4>xyz<SPAN>pqr</SPAN></H4>");
        const A = e("DIV", null, X);
        const B = null;
        const C = Od.patchDom(A, B, null);
        chk(C, [], "DIV", 1);
        chk(C, [0], "H4", 2);
        chk(C, [0, 0], "#xyz");
        chk(C, [0, 1], "SPAN", 1);
        chk(C, [0, 1, 0], "#pqr")
    });
};