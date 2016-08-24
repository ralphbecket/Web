/// <reference path="Obs.d.ts" />
declare namespace Od {
    var processPendingOdEventsDelay: number;
    type Vdom = number | string | VdomPatcher;
    interface VdomPatcher {
        (dom: Node, parent: Node): Node;
        key?: string | number;
        dispose?: () => void;
    }
    type LifecycleFn = (what: string, dom: Node) => void;
    type Vdoms = Vdom | Vdom[];
    const flattenVdoms: (xs: number | string | VdomPatcher | (number | string | VdomPatcher)[]) => (number | string | VdomPatcher)[];
    interface Props {
        [prop: string]: any;
    }
    const element: (tag: string, props?: Props, children?: number | string | VdomPatcher | (number | string | VdomPatcher)[]) => number | string | VdomPatcher;
    type ComponentName = string | number;
    var deferComponentUpdates: boolean;
    const component: (name: string | number, fn: () => number | string | VdomPatcher) => number | string | VdomPatcher;
    const dispose: (vdom: number | string | VdomPatcher) => void;
    const fromHtml: (html: string) => number | string | VdomPatcher;
    const fromDom: (srcDom: Node) => number | string | VdomPatcher;
    const bind: (vdom: number | string | VdomPatcher, dom: Node) => Node;
    const appendChild: (vdom: number | string | VdomPatcher, parent: Node) => Node;
}
