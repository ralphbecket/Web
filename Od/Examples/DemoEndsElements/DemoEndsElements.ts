/// <reference path="../../Ends/Elements.ts"/>

window.onload = () => {
    var vdom = Od.TABLE({ border: 1 }, 
        Od.TBODY([
            Od.TR({ style: "color: red;" }, [
                Od.TD("One"),
                Od.TD(Od.SPAN("thing")),
                Od.TD(["or ", Od.SPAN("another.")])
            ]),
            Od.TR({ style: "color: blue;" }, [
                Od.TD("This"),
                Od.TD(Od.SPAN("that")),
                Od.TD(["and ", Od.SPAN("the other.")])
            ])
        ])
    );
    Od.appendChild(vdom, document.body);
};