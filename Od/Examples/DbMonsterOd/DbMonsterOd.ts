/// <reference path="../../Ends/Elements.ts"/>

namespace DbMonsterOd {

    const rows = Obs.of([] as any[]);

    const tr = (row: any): Od.Vdom =>
        Od.TR([
            Od.TD({ className: "dbname" }, row.dbname),
            Od.TD({ className: "query-count" },
                Od.SPAN({ className: row.lastSample.countClassName },
                    row.lastSample.nbQueries.toString()
                )
            )
        ].concat(row.lastSample.topFiveQueries.map(col =>
            Od.TD({ className: col.elapsedClassName }, [
                Od.SPAN(col.formatElapsed),
                Od.DIV({ className: "popover left" }, [
                    Od.DIV({ className: "popover-content" }, col.query),
                    Od.DIV({ className: "arrow" })
                ])
            ])
        )));

    const trs = (): Od.Vdom[] => {
        return rows().map(tr);
    };

    // We might shave off an FPS or two by not using the Ends/Elements
    // shorthand (Od.TABLE etc.), but who would do that in practice?
    export const vdom = Od.component("DbMonster", () => 
        Od.TABLE({ className: "table table-striped latest-data" },
            //Od.TBODY(trs())
            Od.TBODY(rows().map(row => 
                Od.TR([
                    Od.TD({ className: "dbname" }, row.dbname),
                    Od.TD({ className: "query-count" },
                        Od.SPAN({ className: row.lastSample.countClassName },
                            row.lastSample.nbQueries
                        )
                    ),
                    row.lastSample.topFiveQueries.map(col =>
                        Od.TD({ className: col.elapsedClassName }, [
                            Od.SPAN(col.formatElapsed),
                            Od.DIV({ className: "popover left" }, [
                                Od.DIV({ className: "popover-content" }, col.query),
                                Od.DIV({ className: "arrow" })
                            ])
                        ])
                    )
                ])
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
