/// <reference path="../../Ends/Elements.ts"/>

const N = 10; // Number of top-level DIVs.
const M = 100; // Number of second-level DIVs.
const K = Obs.of(0);
const R = 20; // Milliseconds per iteration.
var iterations = 0;
var go = true;

const view = Od.component(null, () => {
    const rows = [] as Od.Vdom[];
    const k = K();
    for (var i = 0; i < N; i++) {
        const cols = [] as Od.Vdom[];
        if (i === k) for (var j = 0; j < M; j++) cols.push(Od.DIV());
        rows.push(Od.DIV(cols));
    }
    return Od.DIV(rows);
});

setInterval(() => {
    if (!go) return;
    iterations++;
    K(iterations % N);
    if (iterations % 1000 === 0) console.log(iterations, "iterations");
}, R);

window.onload = () => {

};