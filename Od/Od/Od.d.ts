/// <reference path="Obs.d.ts" />
declare namespace Od {
    type Vdom = number | string | VdomPatcher;
    interface VdomArray extends Array<Vdom> {
    }
    type Vdoms = Vdom | VdomArray;
    interface VdomPatcher {
        (dom: Node, parent: Node): Node;
        key?: string | number;
        dispose?: () => void;
    }
    type LifecycleFn = (what: string, dom: Node) => void;
    const flattenVdoms: (xs: Vdoms) => Vdom[];
    interface Props {
        [prop: string]: any;
    }
    const element: (tag: string, props?: Props, children?: Vdoms) => Vdom;
    type ComponentName = string | number;
    var deferComponentUpdates: boolean;
    const component: (name: string | number, fn: () => Vdom, ondispose?: () => void) => Vdom;
    const dispose: (vdom: Vdom) => void;
    const fromHtml: (html: string) => Vdom;
    const fromDom: (srcDom: Node) => Vdom;
    const bind: (vdom: Vdom, dom: Node) => Node;
    const appendChild: (vdom: Vdom, parent: Node) => Node;
}
