module DbMonsterOd {

    // Arguably, this is not the way you'd do this in practice.  However,
    // this whole exercise is artificial, in that we're showing pages of
    // data updating at high speed.  There's a good argument that if you
    // really do have to do that, then manipulate the DOM directly.  Still,
    // here is how you'd get top speed going via Od.  DO NOT take this as
    // representative of "idiomatic" Od!
    //
    var vdom = null as Od.Vdom;

    var obss = null as Obs.IObservable<string>[];

    const update = (): void => {
        const keepIdentity = true;
        var rows = ENV.generateData(keepIdentity).toArray();
        if (vdom) {
            // We've already initialised the vDOM, we just need to update
            // the underlying observables which will trigger any required
            // DOM patching.
            //Obs.startUpdate(); // Batch all updates together.
            var i = 0;
            rows.forEach(row => {
                const lastSample = row.lastSample;
                obss[i++](lastSample.nbQueries.toString());
                obss[i++](lastSample.countClassName);
                const cols = lastSample.topFiveQueries;
                cols.forEach(col => {
                    obss[i++](col.query);
                    obss[i++](col.formatElapsed);
                    obss[i++](col.elapsedClassName);
                });
            });
            //Obs.endUpdate();
        } else {
            // We're just getting started.  We need to set up the vDOM and
            // the observables on which it depends.  Since this is an high
            // speed application, we arrange for the minimal amount of
            // patching work to be redone with respect to each kind of update.
            // In practice, we'd be unlikely to go to such lengths.
            //
            // The approach used here is to make each thing which can update
            // independently into a separate component.  It is only when the
            // observables change on which a component depends that the
            // component (and its corresponding DOM subtree) will be updated.
            // Assigning the same value to an observable does not trigger an
            // update, an update will only trigger when an observable is
            // assigned a new value distinct from its previous one.
            //
            const e = Od.element;
            obss = [];
            var tableRows = [] as Od.Vdom[];
            var i = 0;
            rows.forEach(row => {
                const lastSample = row.lastSample;
                const tableCols = [] as Od.Vdom[];

                tableCols.push(e("TD", { className: "dbname" }, row.dbname));

                var nbQueries =
                    (obss[i++] = Obs.of(lastSample.nbQueries.toString()));
                var countClassName =
                    (obss[i++] = Obs.of(lastSample.countClassName));

                tableCols.push(
                    Od.component(() =>
                        e("TD", { className: "query-count" },
                            e("SPAN", { className: countClassName() },
                                nbQueries()
                            )
                        )
                    )
                );

                const cols = lastSample.topFiveQueries;
                cols.forEach(col => {
                    var query = (obss[i++] = Obs.of(col.query));
                    var formatElapsed = (obss[i++] = Obs.of(col.formatElapsed));
                    var elapsedClassName = (obss[i++] = Obs.of(col.elapsedClassName));
                    var elapsedTextCmpt = Od.component(formatElapsed);
                    var popoverTextCmpt = Od.component(query);
                    var popoverCmpt = Od.component(() =>
                        e("DIV", { className: "popover left" }, [
                            e("DIV", { className: "popover-content" },
                                popoverTextCmpt
                            ),
                            e("DIV", { className: "arrow" })
                        ])
                    );
                    const elapsedCmpt = Od.component(() =>
                        e("TD", { className: elapsedClassName() }, [
                            e("SPAN", null, elapsedTextCmpt),
                            popoverCmpt
                        ])
                    );
                    tableCols.push(elapsedCmpt);
                });

                tableRows.push(e("TR", null, tableCols));
            });
            vdom =
                e("TABLE", { className: "table table-striped latest-data" }, [
                    e("TBODY", null,
                        tableRows
                    )
                ]);
            Od.appendChild(vdom, document.getElementById("app"));
        }
    };

    export const run = (): void => {
        update();
        Monitoring.renderRate.ping();
        setTimeout(run, ENV.timeout);
    };
}
