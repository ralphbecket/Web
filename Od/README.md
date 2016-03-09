# Od
(C) Ralph Becket, 2016

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

The combined Obs and Od libraries currently come in at 2.9 KBytes
minified and gzipped.

Thanks partly due to careful attention to invariants during design and
partly due to using TypeScript for development, virtually everything here
worked first time, if you can believe such a thing.

#### TO DO...

- Add sensible support for style properties (at the moment only the
  `style: "color: red; width: 10em; ..."` approach is implemented).
- The idea of "keyed lists" is a common optimization for efficient list
  reordering; I need to extend the _patch children_ code to support this.
- Add lifecycle hooks for components.
- Performance testing.  I expect this thing to rock.
