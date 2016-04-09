/// <reference path="../../Ends/Oath.ts"/>
/// <reference path="../../Od/Od.ts"/>
/// <reference path="../TestHarness/Test.ts"/>

namespace TestEndsPromise {

    export const run = () => {

        const deferred = () => {
            var d = {
                promise: null as Oath.IThenable<number>,
                resolve: null as (x: number) => void,
                reject: null as (x: any) => void
            };
            d.promise = Oath.make((pass, fail) => {
                d.resolve = pass;
                d.reject = fail;
            });
            return d;
        };
        const alreadyFulfilled = () => Oath.resolve(1);
        const immediatelyFulfilled = () => {
            const d = deferred();
            d.resolve(1);
            return d;
        };
        const eventuallyFulfilled = () => {
            const d = deferred();
            setTimeout(d.resolve, 50, 1);
            return d;
        };
        const alreadyRejected = () => Oath.reject(1);
        const immediatelyRejected = () => {
            const d = deferred();
            d.reject(1);
            return d;
        };
        const eventuallyRejected = () => {
            const d = deferred();
            setTimeout(d.reject, 50, 1);
            return d;
        };

        Test.runDeferred(200, "A promise must not transition to any other state",
        (pass, fail) => {

            setTimeout(pass, 100);

            var d = deferred();
            d.resolve(1);
            d.resolve(2);
            d.promise.then(
                x => Test.expect("can't re-resolve", x === 1),
                r => Test.expect("stayed resolved", false)
            );

            d = deferred();
            d.resolve(1);
            d.reject(2);
            d.promise.then(
                x => Test.expect("can't resolve then reject", x === 1),
                r => Test.expect("stayed resolved", false)
            );

            var d = deferred();
            d.reject(1);
            d.resolve(2);
            d.promise.then(
                r => Test.expect("can't reject then resolve", false),
                x => Test.expect("stayed rejected", x === 1)
            );

            d = deferred();
            d.reject(1);
            d.reject(2);
            d.promise.then(
                r => Test.expect("stayed rejected", false),
                x => Test.expect("can't re-reject", x === 1)
            );

        });

        Test.runDeferred(200, "Trying to fulfill, but interfere at some point",
        (pass, fail) => {
            setTimeout(pass, 100);

            var d = eventuallyFulfilled();
            d.resolve(2);
            d.promise.then(
                x => Test.expect("resolved immediately", x === 2),
                r => Test.expect("immediate resolve failed", false)
            );

            var d = eventuallyFulfilled();
            setTimeout(d.resolve, 25, 2);
            d.promise.then(
                x => Test.expect("resolved early", x === 2),
                r => Test.expect("early resolve failed", false)
            );

            var d = eventuallyFulfilled();
            setTimeout(d.resolve, 75, 2);
            d.promise.then(
                x => Test.expect("resolved too late", x === 1),
                r => Test.expect("late resolve failed", false)
            );

            var d = eventuallyFulfilled();
            d.reject(2);
            d.promise.then(
                x => Test.expect("rejected immediately failed", false),
                r => Test.expect("immediate reject", r == 2)
            );

            var d = eventuallyFulfilled();
            setTimeout(d.reject, 25, 2);
            d.promise.then(
                x => Test.expect("rejected early failed", false),
                r => Test.expect("early reject", r == 2)
            );

            var d = eventuallyFulfilled();
            setTimeout(d.reject, 75, 2);
            d.promise.then(
                x => Test.expect("rejected too late", x == 1),
                r => Test.expect("late reject failed", false)
            );

        });

        Test.runDeferred(200, "Trying to reject, but interfere at some point",
        (pass, fail) => {
            setTimeout(pass, 100);

            var d = eventuallyRejected();
            d.resolve(2);
            d.promise.then(
                x => Test.expect("resolved immediately", x === 2),
                r => Test.expect("immediate resolve failed", false)
            );

            var d = eventuallyRejected();
            setTimeout(d.resolve, 25, 2);
            d.promise.then(
                x => Test.expect("resolved early", x === 2),
                r => Test.expect("early resolve failed", false)
            );

            var d = eventuallyRejected();
            setTimeout(d.resolve, 75, 2);
            d.promise.then(
                x => Test.expect("resolved too late failed", false),
                r => Test.expect("late resolve", r == 1)
            );

            var d = eventuallyRejected();
            d.reject(2);
            d.promise.then(
                x => Test.expect("rejected immediately failed", false),
                r => Test.expect("immediate reject", r == 2)
            );

            var d = eventuallyRejected();
            setTimeout(d.reject, 25, 2);
            d.promise.then(
                x => Test.expect("rejected early failed", false),
                r => Test.expect("early reject", r == 2)
            );

            var d = eventuallyRejected();
            setTimeout(d.reject, 75, 2);
            d.promise.then(
                x => Test.expect("rejected too late failed", false),
                r => Test.expect("late reject", r == 1)
            );

        });

        Test.run("'then' arguments are both optional functions", () => {

            const trials = [
                undefined as any,
                null as any,
                false as any,
                true as any,
                "xyz" as any,
                123 as any,
                {} as any
            ]
            trials.forEach(x => {
                try {
                    alreadyFulfilled().then(x, r => { });
                }
                catch (e) {
                    Test.expect("pass " + JSON.stringify(x), false);
                }
            });
            trials.forEach(x => {
                try {
                    alreadyRejected().then(_ => { }, x);
                }
                catch (e) {
                    Test.expect("fail " + JSON.stringify(x), false);
                }
            });

        });

        Test.runDeferred(200, "'then' callbacks are executed after the promise resolves",
        (pass, fail) => {
            setTimeout(pass, 100);

            var d = eventuallyFulfilled();
            var a = 0;
            d.promise.then(x => {
                Test.expect("'pass' ran after resolution", a == 1);
                Test.expect("'pass' received correct value", x == 1);
            });
            a = 1;

            var d = eventuallyRejected();
            var b = 0;
            d.promise.then(null, r => {
                Test.expect("'fail' ran after resolution", b == 1);
                Test.expect("'fail' received correct value", r == 1);
            });
            b = 1;

        });

        Test.runDeferred(200, "'then' callbacks are executed asynchronously",
        (pass, fail) => {
            setTimeout(pass, 100);

            var d = immediatelyFulfilled();
            var a = 0;
            d.promise.then(x => {
                Test.expect("'pass' ran after resolution", a == 1);
                Test.expect("'pass' received correct value", x == 1);
            });
            a = 1;

            var d = immediatelyRejected();
            var b = 0;
            d.promise.then(null, r => {
                Test.expect("'fail' ran after resolution", b == 1);
                Test.expect("'fail' received correct value", r == 1);
            });
            b = 1;

        });

    };

}
