/// <reference path="../../Od/Od.ts"/>

namespace DbMonsterOd {

    const rows = Obs.of([] as any[]);

    const e = Od.element;

    export const vdom = Od.component(() => 
        e("TABLE", { className: "table table-striped latest-data" },
            e("TBODY", null, rows().map(row => 
                e("TR", null, [
                    e("TD", { className: "dbname" }, row.dbname),
                    e("TD", { className: "query-count" },
                        e("SPAN", { className: row.lastSample.countClassName },
                            row.lastSample.nbQueries.toString()
                        )
                    )
                ].concat(row.lastSample.topFiveQueries.map(col =>
                    e("TD", { className: col.elapsedClassName }, [
                        e("SPAN", null, col.formatElapsed),
                        e("DIV", { className: "popover left" }, [
                            e("DIV", { className: "popover-content" },
                                col.query
                            ),
                            e("DIV", { className: "arrow" })
                        ])
                    ])
                )))
            ))
        )
    );

    const update = (): void => {
        rows(ENV.generateData().toArray());
    };

    export const run = (): void => {
        update();
        Monitoring.renderRate.ping();
        setTimeout(run, ENV.timeout);
    };
}
