# Od API

## Virtual DOM constructors

Virtual DOM (vDOM) structures are used to efficiently update the live DOM.

* `Vdom`: either a string (denoting a text node) or an _IVdom_
* `IVdom`: a virtual DOM node corresponding to a DOM subtree (can be a text node, an element, or a _component_).

### Text nodes
```TypeScript
Od.text(x: string): IVdom
```
Builds a vDOM text node.

Example: `Od.text("Hello, World!")`

### Element nodes
```TypeScript
Od.element(tag: string, props?: IProps, childOrChildren?: Vdoms): IVdom
```
Builds a vDOM element node.
* `tag` i the tag name, automatically converted to upper case.
* `props` is an optional set of properties for the element (these correspond directly to HTML element node properties).
* `childOrChildren` is an optional single `Vdom` or array of `Vdom` nodes: the children of the vDOM element node.

Example: `Od.element("P", { className: "foo", style: { color: "blue" } }, ["Hello, ", Od.element("SPAN", null, "World!")])`

Note: the [Ends/Elements](../Od/Ends/Elements.ts) extension defines useful shorthand functions for the HTML5 elements.  For example, the above could also be written as `Od.P({ ... }, ["Hello, ", Od.SPAN("World!")])`.

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

#### Named vs ephemeral components.

When constructing nested component structures, normally one does not want the sub-components to be rebuilt every time the parent component is updated.  To this end, one should use _named components_.  Consider the following:
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
Here, `foo` uses an ephemeral sub-component (i.e., one with no name), whereas `bar` uses a named sub-component.

Whenever `level` changes, the nested components update as one would expect.

When `isOn` changes, however, `foo` and `bar` behave slightly differently.  Since `foo`'s nested component has no name, it is ephemeral: the nested component will be rebuilt (i.e., the old one disposed of and a new one created) every time `foo` updates.  In `bar`, though, the nested component is _named_: "level".  What happens here is that when `bar` updates, instead of rebuilding the "level" component, it preserves the previous instance of the sub-component and, hence, any state it may have.

Component names are meaningful only within the scope of the parent component's vDOM function.  It is quite safe to reuse names across different scopes.

For most situations, the correct course of action is to use named sub-components.

XXX WRITE MORE.  MOOOOORE!
