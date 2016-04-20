/// <reference path="Obs.d.ts" />
declare namespace Od {
    interface IVdom {
    }
    type Vdom = string | IVdom;
    type Vdoms = Vdom | Vdom[];
    interface IProps {
        [prop: string]: any;
    }
    const text: (text: string) => IVdom;
    const element: (tag: string, props?: IProps, childOrChildren?: string | IVdom | (string | IVdom)[]) => IVdom;
    type ComponentName = string | number;
    const component: <T>(name: string | number, fn: () => string | IVdom) => IVdom;
    const fromHtml: (html: string) => IVdom;
    const fromDom: (dom: Node) => IVdom;
    const bind: (vdom: string | IVdom, dom: Node) => Node;
    const appendChild: (vdom: string | IVdom, domParent: Node) => Node;
    const dispose: (component: IVdom) => void;
    var deferComponentUpdates: boolean;
    interface ISubComponents {
        [name: string]: (IVdom | IVdom[]);
    }
    interface IVdom {
        isIVdom: boolean;
        text?: string;
        tag?: string;
        props?: IProps;
        children?: Vdom[];
        obs?: Obs.IObservable<Vdom>;
        subscription?: Obs.ISubscription;
        subcomponents?: ISubComponents;
        dom?: Node;
    }
    const patchDom: (vdomOrString: string | IVdom, dom: Node, domParent?: Node) => Node;
    type PropAssocList = any[];
}
