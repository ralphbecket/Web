# Minified Od Packages

The _Od_ project is modular in the sense that you can largely pick and choose which parts you include.  That said, the whole collection (_OdAndEnds_) is less than 5.5 KBytes minified and gzipped.  The alternative options here are strictly for minimalists.

- _OdAndEnds_ includes all packages: _Obs_, _Od_, _Elements_, _Jigsaw_, _Oath_, and _Xhr_.

## Core libraries
- _Obs_ is the observables library.
- _Od_ is the virtual-DOM library (depends on _Od_).

## Optional extension libraries.

- _Elements_ extends _Od_ with shorthand for the standard HTML5 elements (i.e., with Elements you can write `Od.DIV(Od.UL([Od.LI(...), ...]))` rather than the more verbose `e("DIV", null, e("UL", null, [e("LI", null, ...), ...]))` which assumes you have defined `e` as a synonym for `Od.element`).

## Optional utility libraries.

- _Jigsaw_ is the optional router.
- _Oath_ is the optional Promises/A+ library.
- _Xhr_ is the optional `XMLHttpRequest` wrapper library for making web requests (depends on _Oath_).

## Combinations

- _OdAndEnds_ (the whole set)
- _ObsAndOd_
- _ObsAndOdAndElements_
- _XhrAndOath_
