# Od
(C) Ralph Becket, 2016

A smart virtual-DOM library.
* Other vDOM schemes: "redraw _everything_, _every time_... _really fast_!".
* Od: "quickly redraw just what you need, when you need it -- and Keep It Simple!".

## Why try Od?
* It's small (the full set including promises, routing, named element constructors, etc., is 5.3 KBytes minified and gzipped).
* It has a tiny API (three main functions, a handful of auxiliary functions).
* It's fast: twice as fast as Mithril without any attempt at optimisation.
* It's consistent: there are no funny corner cases (e.g., nothing goes wrong when you move UI components around).
* It's predictable: components render independently; an update in one place has no cost for other places.
* It's simple: updates happen automatically.
* It's unopinionated: design your application as you will.
* It includes optional, but useful, elements such as a router ([Ends/Jigsaw](https://github.com/ralphbecket/Web/blob/master/Od/Ends/Jigsaw.ts)), promises ([Ends/Oath](https://github.com/ralphbecket/Web/blob/master/Od/Ends/Oath.ts)), and a convenient AJAX library ([Ends/Xhr](https://github.com/ralphbecket/Web/blob/master/Od/Ends/Xhr.ts)).

## Demonstrations to whet the appetite

* [Od - Demo - Hello](https://jsfiddle.net/ralphbecket/t2xcbjqo/)
* [Od - Demo - Calculator](https://jsfiddle.net/ralphbecket/df8bfnhe/)
* [Od - Demo - Basic To-do List](https://jsfiddle.net/ralphbecket/bbvtwyuq/)
* [Od - Demo - Tabs](https://jsfiddle.net/ralphbecket/beLjfmsj/)
* [Od - Demo - Jigsaw router](https://jsfiddle.net/ralphbecket/3mj53jpm/)
* [Od - Demo - Velocity](https://jsfiddle.net/ralphbecket/5k6z3cym/) (lifecycle hooks and 3rd party integration).
* [Od - Demo - Component lifecycle](https://jsfiddle.net/ralphbecket/e7Lw649k/)

## Interactive tutorials

* [Od - Hello, World!](https://jsfiddle.net/ralphbecket/2Laqcewa/)  - the very, very basics.
* [Obs - Observables](https://jsfiddle.net/ralphbecket/wo5pb7m4/)   - the underlying magic.
* [Od - Components](https://jsfiddle.net/ralphbecket/kyvfcj7h/)     - dynamic, interactive HTML components.

## What makes Od different?

In most virtual-DOM schemes, the application has to regenerate the entire 
virtual-DOM structure on every event that can update the UI.  This is then
patched against the entire DOM.

In Od, only the virtual-DOM pertaining to individual updated components
is regenerated and patched.  Consider the following example:

![OdComponents example](http://ralphbecket.github.io/Images/Od/OdComponents.svg)

With Od, when component B updates, only the virtual-DOM and DOM nodes
corresponding to B are updated and patched.  Neither the parent 
component A nor the sub-component C would be regenerated or patched.
This makes Od udpates compellingly efficient.

## Observables-based vDOM.

Virtual-DOM schemes are all the rage.  Because manually updating the
HTML DOM is hard to do efficiently and correctly, vDOM schemes instead
take the following approach:
- whenever something "interesting" happens (the user clicks something, an
  AJAX request returns, that sort of thing) then an application-provided
  function is called which
- constructs a new vDOM structure (a cheaper, abstract) representing
  what the entire DOM should look like and
- the vDOM library then works out the minimal set of DOM updates required
  to bring the DOM proper into line with the new vDOM representation.

This has turned out to be simpler and more efficient, at scale, than other
approaches.

There are typically two flies in the ointment of the schemes I have studied:
1. the application re-generates the entire vDOM at each event, which is
   then compared against the entire DOM; and
2. people want to include "components" in their vDOM, namely reusable
   abstractions (e.g., for auto-complete inputs, grids, etc.).  These
   things have always felt a little clunky to me in execution.  They are
   often the place where the vDOM abstraction of choice starts to leak.

My approach kills these two birds with one stone: observables.  The idea
behind observables is that one can attach functions to them (subscriptions)
to be executed whenever the value of the observable changes.

Every "active" DOM subtree (i.e., something that can change as the
application runs) is managed via an observable whose value is a vDOM
subtree.  When the observable changes, the patching algorithm is only
applied to the affected DOM subtree.

This mechanism is general: "components" are just observables, like any
other managed part of the DOM/vDOM relationship.

### Due credit

Credit where it's due: the following efforts have been inspirational and,
particularly in the first case, of enormous practical benefit: Knockout, 
Mithril, Inferno, and React.  I'd also like to mention the reactive school, 
but in the end I find the observables-based approach more natural.  
For today, at least.

### Patching algorithm

Patching is the process of changing a DOM subtree to match a vDOM tree.  
* An _update_ changes the existing DOM node.
* A _replacement_ substitutes a new DOM node for the old.

| Old\New   | Text       | Element    | Component  |
| :-------- | :--------: | :--------: | :--------: |
| Text      | Update     | Replace    | Replace    |
| Element   | Replace    | Depends on tags | Replace |
| Component | Replace    | Replace    | Depends on components |

* Element/element patching: _update_ if tags match, otherwise _replace_.
* Component/component patching: do nothing if components are the same, 
  otherwise _replace_ with the new component's DOM.

### Finer details

An Od application constructs one or more _vDOM_ structures which it binds to
DOM nodes in the application HTML.

A _vDOM_ structure is either a text node, a representation of some HTML
(DIV, P, LI, etc. with optional properties), or a _component_.

A _component_ is constructed from an _observable vDOM variable_ (see below)
and is bound to a single DOM node.  When the observable changes, the
component's _vDOM_ is recalculated, and the DOM node is patched accordingly
(see below, also).

Components can be nested and freely rearranged within the DOM.  When a
component is updates, it does so without affecting unrelated components
(including nested components) or unrelated parts of the DOM.  Rearranging
components is, from the DOM's point of view, equivalent to moving entire
DOM subtrees.

The patching algorithm is mainly standard: a DOM node is preserved in the
patch if it has the same tag as the corresponding vDOM node, otherwise it
is replaced and a new DOM node created to match the vDOM node.  Properties
on updated (i.e., not replaced) DOM nodes are updated efficiently.  Patching
procedes recursively into child nodes.

As usual, "keyed" lists have special support: if a parent node has
property "keyed: true" and each of its children have a string or
numeric "key" property, then those children will be reordered in the
DOM to match the corresponding order in the vDOM before patching. This
saves a lot of unneccesary reconstruction when a list is reordered or
nodes are inserted or deleted.

The one special aspect of the patching algorithm is that patching never
procedes into a DOM node managed by a component: that component's udpate
logic is solely responsible for that DOM node.  If a parent component
replaces a child component with some other vDOM structure, then a whole
new DOM subtree is substituted instead (i.e., the child component's DOM
node will not be affected).

Component updates are batched by default via requestAnimationFrame (or some
similar fallback).  This is a standard approach to reducing redrawing 
pressure on the web browser.  Component updates can be made immediate by 
setting a global flag.

Discarded DOM nodes are "stripped" of any properties via a background
task.  This serves two purposes: memory leaks due to retained event
handler subscriptions are avoided; and stripping doesn't occupy time
spent rendering and patching before handing control back to the browser
for a repaint.

### Observables

Observables provide a pleasingly declarative solution to many problems.

A _mutable observable_ is a quantity which can be read and updated.

A _computed observable_ is a function which is re-evaluated on any update
to any _observable_ (mutable or computed) that was read in the previous 
evaluation of the function.  Computed observables can be read, but not
updated.

A _subscription_ is a function which is evaluated for its side effect
whenever one of a given set of observables is updates.

The *Obs* library here is independent of *Od*.  It provides an API
broadly similar to the observables component of _Knockout_, albeit with
a couple of key differences:
- updates can be grouped into atomic "update regions", which can prevent
the redundant re-evaluation of computed observables etc. when updating
multiple observables.  For example, say `u` is the computed observable of the
sum of `x` and `y`; updating `x` then `y` will normally lead to separate
re-evaluations of `u` on each of those updates.  Updating `x` and `y` in an
update region has the effect of only updating `u` once, when the end of the
update region is reached.
- the recomputation order of computed observables is in dependency order.
That is if computed observable `u` depends on mutable observable `x` and
computed observable `v` depends on both `x` and `u`, then `v` will be
re-evaluated only after `u` when `x` is updated (without this, we may find
`v` being re-evaluated twice: once for `x`; a second time for `u`).

#### Bragging

The combined Obs and Od libraries currently come in at 3.4 KBytes
minified and gzipped.

Thanks partly due to careful attention to invariants during design and
partly due to using TypeScript for development, virtually everything here
worked first time, if you can believe such a thing.

Preliminary benchmarking with [dbmonster](http://mathieuancelin.github.io/js-repaint-perfs) 
on my machine gives the following results (as of 2016-03-31):

| Library  | dbmonster @ 1% | dbmonster @ 100% |
| :------- | -------------: | ---------------: |
| Od       |        95 fps  |          27 fps  |
| Mithril  |        25 fps  |          15 fps  |
| Inferno  |       160 fps  |          33 fps  |
| DomVM    |        88 fps  |          28 fps  |
| Angular  |       120 fps  |           9 fps  |

Take these numbers with a pinch of salt: some of the libraries will
have moved on somewhat; I'm also somewhat suspicious of Angular's
120 fps score in the low-frequency update rate column.

Note also that this is just a test of raw speed in a
particular, unlikely, situation.  Od's real strength is in how easy
it is to use without having to know about the underlying
implementation details.  Od's abstraction does not leak all over the
place when you get into the corner cases.

#### TO DO...

- Add lifecycle hooks for components.
