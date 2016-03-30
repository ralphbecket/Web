/// <reference path="../../Od/Obs.ts"/>
/// <reference path="../TestHarness/Test.ts"/>

window.onload = () => {
// const go = () => {

    Test.run("Mutable observables", () => {
        const x = Obs.of(123);
        Test.expect("construction and reading", x() === 123);
        x(456);
        Test.expect("update", x() === 456);
    });

    Test.run("Computed observables", () => {
        const x = Obs.of(123);
        const y = Obs.of(456);
        const z = Obs.of(789);
        const u = Obs.fn(() => x() + y());
        Test.expect("construction and reading 1", u() === 579);
        const v = Obs.fn(() => z() - u());
        Test.expect("construction and reading 2", v() === 210);
        x(0);
        Test.expect("update 1", u() === 456);
        Test.expect("update 2", v() === 333);
        z(999);
        Test.expect("update 3", u() === 456);
        Test.expect("update 4", v() === 543);
    });

    Test.run("Start/end update", () => {
        var k = 0;
        const x = Obs.of(123);
        const y = Obs.of(234);
        const f = () => {
            k++;
            return x();
        };
        const u = Obs.fn(() => f() + y());
        Obs.startUpdate();
        x(111);
        y(222);
        Obs.endUpdate();
        Test.expect("dependent computed runs once", k === 2);
        Test.expect("dependent computed is correct", u() === 333);
    });

    Test.run("Disposal", () => {
        const x = Obs.of(123);
        var nu = 0;
        const u = Obs.fn(() => { nu++; return 2 * x(); });
        var nv = 0;
        const v = Obs.fn(() => { nv++; return -u(); });
        Test.expect("setup", x() === 123 && u() === 246 && v() === -246);
        x(1);
        Test.expect("propagation 1", x() === 1 && u() === 2 && v() === -2);
        Obs.dispose(v);
        x(2);
        Test.expect("disposing v", x() === 2 && u() === 4 && v() == null);
        Obs.dispose(u);
        x(3);
        Test.expect("disposing u", x() === 3 && u() == null && v() == null);
    });

    Test.run("Subscriptions", () => {
        var k = 0;
        const x = Obs.of(123);
        const y = Obs.of(456);
        const w = Obs.subscribe([x, y], () => {
            k++;
        });
        x(234);
        Test.expect("propagation 1", k === 1);
        y(567);
        Test.expect("propagation 2", k === 2);
        Obs.startUpdate();
        x(345);
        y(678);
        Obs.endUpdate();
        Test.expect("propagation 3", k === 3);
        Obs.dispose(x);
        x(456); // Connection with w should be broken.
        y(789);
        Test.expect("propagation 4", k === 4);
        // XXX What about ordering of dependents?
    });

    Test.run("Peeking", () => {
        const x = Obs.of(123);
        const y = Obs.of(456);
        const u = Obs.fn(() => x() + Obs.peek(y));
        Test.expect("setup", u() === 579);
        y(111);
        Test.expect("peek", u() === 579);
        x(111);
        Test.expect("peek", u() === 222);
    });

};