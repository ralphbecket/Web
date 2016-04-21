# Od API

## Virtual DOM constructors

Virtual DOM (vDOM) structures are used to efficiently update the live DOM.

* `Vdom`: either a string (denoting a text node) or an _IVdom_
* `IVdom`: a virtual DOM node corresponding to a DOM subtree (can be a text node, an element, or a _component_).

### Text nodes
```TypeScript
Od.text(x: string): IVdom
```
Builds a vDOM text node.  This is typically unneccessary, since ordinary text strings are accepted as vDOM nodes.

Example: `Od.text("Hello, World!")`

### Element nodes
```TypeScript
Od.element(tag: string, props?: IProps, childOrChildren?: Vdoms): IVdom
```
Builds a vDOM element node.
* `tag` is the tag name, automatically converted to upper case.
* `props` is an optional set of properties for the element (these correspond directly to HTML element node properties).
* `childOrChildren` is an optional single `Vdom` or array of `Vdom` nodes: the children of the vDOM element node.

Example: `Od.element("P", { className: "foo", style: { color: "blue" } }, ["Hello, ", Od.element("EM", null, "World!")])`

Note: the [Ends/Elements](../Ends/Elements.ts) extension defines useful shorthand functions for the HTML5 elements.  For example, the above could also be written as `Od.P({ ... }, ["Hello, ", Od.EM("World!")])`.

### Components
```TypeScript
Od.component(name: number | string, fn: Obs.IObservable<Vdom> | (() => Vdom)): IVdom
```
Builds a vDOM component node.  Components are dynamic vDOM subtrees which update automatically in response to changes in any observables (see [Obs](Obs.ts)) used in `fn`.
* `name` is an optional name which should be unique within the scope of the parent component (if any) -- see the description of named vs ephemeral components below.
* `fn` is a function which returns a vDOM subtree.  This may be either a vDOM-valued observable or an ordinary function, from which an observable function will be created.

Example:
```TypeScript
const colour = Obs.of("blue");
const cmpt = Od.component("alert status", () => Od.SPAN({ color: colour() }, "Alert!"));
```
Whenever the observable `colour` changes (e.g., via `colour("red")`), `cmpt` will automatically update by re-evaluating its vDOM function (and, of course, the DOM node to which `cmpt` is bound will likewise be automatically updated).

Note that the `Obs` observable library transparently identifies and manages the dependency of the vDOM function on the observable `colour`.  The user does not need to do anything to inform `cmpt` when `colour` changes.

#### Named vs ephemeral vs external components.

When constructing nested component structures, normally one does not want the sub-components to be rebuilt every time the parent component is updated.  To this end, one should use _named sub-components_.  Consider the following:
```TypeScript
const isOn = Obs.of(true);
const level = Obs.of(7);
const foo = Od.component("foo", () => Od.DIV(
  isOn() ? ["Level ", Od.component(null, () => level().toString())]
         : ["Off"]
));
const bar = Od.component("foo", () => Od.DIV(
  isOn() ? ["Level ", Od.component("level", () => level().toString())]
         : ["Off"]
));
```
Here, `foo` uses an _ephemeral sub-component_ (i.e., one with no name), whereas `bar` uses a _named sub-component_ ("level").

Whenever `level` changes, the sub-components update as one would expect.

When `isOn` changes, however, `foo` and `bar` behave slightly differently.  
* Since `foo`'s nested component has no name, it is ephemeral: the nested component will be rebuilt (i.e., the old one disposed of and a new one created) every time `foo` updates.  
* In `bar`, though, the nested component is _named_: "level".  When `bar` updates, instead of rebuilding the "level" component, it preserves the previous instance of the sub-component and, hence, any state it may have.

Component names are meaningful only within the scope of the parent component's vDOM function.  It is quite safe to reuse names across different scopes.

In most situations, the correct course of action is to use named sub-components.

Note: a component can be constructed in an external scope and used as a subcomponent elsewhere.  Such things are referred to as _external components_.  It is up to the programmer to manage the disposal of external components.

Example:
```TypeScript
const A = Od.component(null, () => Od.P(...));
const B = Od.component(null, () => Od.DIV([..., A, ...]));
```
In this example `A` is an external component used as a sub-component of `B`.  When `B` updates or is disposed of, `A` will not be affected.

#### Component lifetimes

A named sub-component persists until either it is explicitly disposed of via `Od.dispose` or its parent component is disposed (hence component disposal is recursive).  

Ephemeral sub-components are disposed of immediately their parent component updates.

External components are unaffected by the disposal of their parent component.

#### Component lifecycle events

A component whose top-level element includes an `onodevent` event handler property will receive lifecycle events via that callback.

Example:
```TypeScript
const myEventHandler = (what, dom) => {
  console.log(what, dom);
};
const A = Od.component(null, () => 
  Od.DIV({onodevent: myEventHandler, ...}, ...)
);
```
The `dom` argument is the up-to-date DOM subtree corresponding to the component.
The `what` argument will be
* `"created"` if the component's vDOM function has just been run for the first time;
* `"udpated"` if the component's vDOM function has just been re-run;
* `"removed"` if the component has just been disposed of.
These lifecycle hooks provide an opportunity to post-process the Od-generated DOM subtree, for example if you are using a third-party library such as jQuery.

### Explicit component disposal
```TypeScript
Od.dispose(component: IVdom): void
```

Recursively disposes of the component and any named or ephemeral sub-components it may have.  In a well designed application, explicit disposal should only be necessary for top-level components and any external components.

Disposal also strips any properties, event handlers, and so forth that have been added by Od from the component DOM tree.  This process takes place in the background to avoid slowing the DOM update process.

Disposal is recommended to avoid memory leaks.  Since a component `C` establishes a dependency on any observable `X` it uses, `C` will persist as long as `X` is live.  Disposing of `C` breaks this connection, allowing `C` to be garbage collected once it becomes unreachable.

## Virtual DOM binding




XXX WRITE MORE.  MOOOOORE!
