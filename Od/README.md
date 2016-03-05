# Od.ts
(C) Ralph Becket, 2015

## Observables-based vDOM.

Virtual-DOM schemes are all the rage.  Essentially, manually updating the
HTML DOM is hard to do efficiently and correctly.  vDOM schemes instead
(typically) take the approach of
- whenever something "interesting" happens (the user clicks something, an
  AJAX request returns, that sort of thing) then an application-provided
  function is called which
- constructs a new vDOM structure (a cheaper, abstract) representing
  what the DOM should look like and
- the vDOM library then works out the minimal set of DOM updates required
  to bring the DOM proper into line with the new vDOM representation.

This has turned out to be simpler and more efficient, at scale, than other
approaches.

There are typically two flies in the ointment of the schemes I have studied:
1. the application re-generates the entire vDOM at each event, which is
   then compared against the entire DOM; and
2. people want to include "components" in their vDOM, namely reusable
   abstractions (e.g., for auto-complete inputs, grids, etc.).  These
   things have always felt a little clunky to me in execution.

My approach kills both these birds with one stone: observables.  The idea
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

### Observables

XXX FILL THIS IN.

#### TO DO...

- Defer and batch DOM updates using some `requestAnimationFrame` scheme.
- Add a background task to clean up discarded DOM subtrees (mainly just
  removing event handlers to prevent garbage retention).
- Add sensible support for style properties (at the moment only the
  style: "color: red; width: 10em; ..." approach is implemented).
- Performance testing.  I expect this thing to rock.
