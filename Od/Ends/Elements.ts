// Elements.ts
//
// This library provides some handy syntactic sugar.  Rather than writing
// any of
//
//  Od.element("HR")
//  Od.element("DIV", null, [children...])
//  Od.element("A", { href: "..." }, [children...])
//  Od.element("INPUT", { type: "text" })
//
// you can write the somewhat more perspicuous
//
//  Od.HR()
//  Od.DIV([children...])
//  Od.A({ href: "..." }, [children...])
//  Od.INPUT({ type: "text" })
// 
/// <reference path="../Od/Od.ts"/>

namespace Od {

    const isVdoms = (x: any): boolean =>
        (x != null) && (
            (x.isIVdom) ||
            (x instanceof Array) ||
            (typeof (x) === "string")
        );

    const elt = (tag: string, fst: IProps | Vdoms, snd?: Vdoms): IVdom => {
        const fstIsVdoms = isVdoms(fst);
        if (fstIsVdoms && snd != null) throw new Error(
            "Od." + tag + ": given two args, but first arg is not props."
        );
        return ( fstIsVdoms
               ? Od.element(tag, null, fst as Vdoms)
               : Od.element(tag, fst as IProps, snd)
               );
    };

    // This approach is short, but sweet.
    [   "A",
        "ABBR",
        "ACRONYM",
        "ADDRESS",
        "APPLET",
        "AREA",
        "ARTICLE",
        "ASIDE",
        "AUDIO",
        "B",
        "BASE",
        "BASEFONT",
        "BDI",
        "BDO",
        "BGSOUND",
        "BIG",
        "BLINK",
        "BLOCKQUOTE",
        "BODY",
        "BR",
        "BUTTON",
        "CANVAS",
        "CAPTION",
        "CENTER",
        "CITE",
        "CODE",
        "COL",
        "COLGROUP",
        "COMMAND",
        "CONTENT",
        "DATA",
        "DATALIST",
        "DD",
        "DEL",
        "DETAILS",
        "DFN",
        "DIALOG",
        "DIR",
        "DIV",
        "DL",
        "DT",
        "ELEMENT",
        "EM",
        "EMBED",
        "FIELDSET",
        "FIGCAPTION",
        "FIGURE",
        "FONT",
        "FOOTER",
        "FORM",
        "FRAME",
        "FRAMESET",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "HEAD",
        "HEADER",
        "HGROUP",
        "HR",
        "HTML",
        "I",
        "IFRAME",
        "IMAGE",
        "IMG",
        "INPUT",
        "INS",
        "ISINDEX",
        "KBD",
        "KEYGEN",
        "LABEL",
        "LEGEND",
        "LI",
        "LINK",
        "LISTING",
        "MAIN",
        "MAP",
        "MARK",
        "MARQUEE",
        "MENU",
        "MENUITEM",
        "META",
        "METER",
        "MULTICOL",
        "NAV",
        "NOBR",
        "NOEMBED",
        "NOFRAMES",
        "NOSCRIPT",
        "OBJECT",
        "OL",
        "OPTGROUP",
        "OPTION",
        "OUTPUT",
        "P",
        "PARAM",
        "PICTURE",
        "PLAINTEXT",
        "PRE",
        "PROGRESS",
        "Q",
        "RP",
        "RT",
        "RTC",
        "RUBY",
        "S",
        "SAMP",
        "SCRIPT",
        "SECTION",
        "SELECT",
        "SHADOW",
        "SMALL",
        "SOURCE",
        "SPACER",
        "SPAN",
        "STRIKE",
        "STRONG",
        "STYLE",
        "SUB",
        "SUMMARY",
        "SUP",
        "TABLE",
        "TBODY",
        "TD",
        "TEMPLATE",
        "TEXTAREA",
        "TFOOT",
        "TH",
        "THEAD",
        "TIME",
        "TITLE",
        "TR",
        "TRACK",
        "TT",
        "U",
        "UL",
        "VAR",
        "VIDEO",
        "WBR",
        "XMP"
    ].forEach(tag => {
        (Od as any)[tag] = (fst?: any, snd?: any) => elt(tag, fst, snd);
    });

    export type ElementConstructor =
        (fst?: IProps | Vdoms, snd?: Vdoms) => IVdom;

    export declare const A: ElementConstructor;
    export declare const ABBR: ElementConstructor;
    export declare const ACRONYM: ElementConstructor;
    export declare const ADDRESS: ElementConstructor;
    export declare const APPLET: ElementConstructor;
    export declare const AREA: ElementConstructor;
    export declare const ARTICLE: ElementConstructor;
    export declare const ASIDE: ElementConstructor;
    export declare const AUDIO: ElementConstructor;
    export declare const B: ElementConstructor;
    export declare const BASE: ElementConstructor;
    export declare const BASEFONT: ElementConstructor;
    export declare const BDI: ElementConstructor;
    export declare const BDO: ElementConstructor;
    export declare const BGSOUND: ElementConstructor;
    export declare const BIG: ElementConstructor;
    export declare const BLINK: ElementConstructor;
    export declare const BLOCKQUOTE: ElementConstructor;
    export declare const BODY: ElementConstructor;
    export declare const BR: ElementConstructor;
    export declare const BUTTON: ElementConstructor;
    export declare const CANVAS: ElementConstructor;
    export declare const CAPTION: ElementConstructor;
    export declare const CENTER: ElementConstructor;
    export declare const CITE: ElementConstructor;
    export declare const CODE: ElementConstructor;
    export declare const COL: ElementConstructor;
    export declare const COLGROUP: ElementConstructor;
    export declare const COMMAND: ElementConstructor;
    export declare const CONTENT: ElementConstructor;
    export declare const DATA: ElementConstructor;
    export declare const DATALIST: ElementConstructor;
    export declare const DD: ElementConstructor;
    export declare const DEL: ElementConstructor;
    export declare const DETAILS: ElementConstructor;
    export declare const DFN: ElementConstructor;
    export declare const DIALOG: ElementConstructor;
    export declare const DIR: ElementConstructor;
    export declare const DIV: ElementConstructor;
    export declare const DL: ElementConstructor;
    export declare const DT: ElementConstructor;
    export declare const ELEMENT: ElementConstructor;
    export declare const EM: ElementConstructor;
    export declare const EMBED: ElementConstructor;
    export declare const FIELDSET: ElementConstructor;
    export declare const FIGCAPTION: ElementConstructor;
    export declare const FIGURE: ElementConstructor;
    export declare const FONT: ElementConstructor;
    export declare const FOOTER: ElementConstructor;
    export declare const FORM: ElementConstructor;
    export declare const FRAME: ElementConstructor;
    export declare const FRAMESET: ElementConstructor;
    export declare const HEAD: ElementConstructor;
    export declare const HEADER: ElementConstructor;
    export declare const HGROUP: ElementConstructor;
    export declare const HR: ElementConstructor;
    export declare const HTML: ElementConstructor;
    export declare const I: ElementConstructor;
    export declare const IFRAME: ElementConstructor;
    export declare const IMAGE: ElementConstructor;
    export declare const IMG: ElementConstructor;
    export declare const INPUT: ElementConstructor;
    export declare const INS: ElementConstructor;
    export declare const ISINDEX: ElementConstructor;
    export declare const KBD: ElementConstructor;
    export declare const KEYGEN: ElementConstructor;
    export declare const LABEL: ElementConstructor;
    export declare const LEGEND: ElementConstructor;
    export declare const LI: ElementConstructor;
    export declare const LINK: ElementConstructor;
    export declare const LISTING: ElementConstructor;
    export declare const MAIN: ElementConstructor;
    export declare const MAP: ElementConstructor;
    export declare const MARK: ElementConstructor;
    export declare const MARQUEE: ElementConstructor;
    export declare const MENU: ElementConstructor;
    export declare const MENUITEM: ElementConstructor;
    export declare const META: ElementConstructor;
    export declare const METER: ElementConstructor;
    export declare const MULTICOL: ElementConstructor;
    export declare const NAV: ElementConstructor;
    export declare const NOBR: ElementConstructor;
    export declare const NOEMBED: ElementConstructor;
    export declare const NOFRAMES: ElementConstructor;
    export declare const NOSCRIPT: ElementConstructor;
    export declare const OBJECT: ElementConstructor;
    export declare const OL: ElementConstructor;
    export declare const OPTGROUP: ElementConstructor;
    export declare const OPTION: ElementConstructor;
    export declare const OUTPUT: ElementConstructor;
    export declare const P: ElementConstructor;
    export declare const PARAM: ElementConstructor;
    export declare const PICTURE: ElementConstructor;
    export declare const PLAINTEXT: ElementConstructor;
    export declare const PRE: ElementConstructor;
    export declare const PROGRESS: ElementConstructor;
    export declare const Q: ElementConstructor;
    export declare const RP: ElementConstructor;
    export declare const RT: ElementConstructor;
    export declare const RTC: ElementConstructor;
    export declare const RUBY: ElementConstructor;
    export declare const S: ElementConstructor;
    export declare const SAMP: ElementConstructor;
    export declare const SCRIPT: ElementConstructor;
    export declare const SECTION: ElementConstructor;
    export declare const SELECT: ElementConstructor;
    export declare const SHADOW: ElementConstructor;
    export declare const SMALL: ElementConstructor;
    export declare const SOURCE: ElementConstructor;
    export declare const SPACER: ElementConstructor;
    export declare const SPAN: ElementConstructor;
    export declare const STRIKE: ElementConstructor;
    export declare const STRONG: ElementConstructor;
    export declare const STYLE: ElementConstructor;
    export declare const SUB: ElementConstructor;
    export declare const SUMMARY: ElementConstructor;
    export declare const SUP: ElementConstructor;
    export declare const TABLE: ElementConstructor;
    export declare const TBODY: ElementConstructor;
    export declare const TD: ElementConstructor;
    export declare const TEMPLATE: ElementConstructor;
    export declare const TEXTAREA: ElementConstructor;
    export declare const TFOOT: ElementConstructor;
    export declare const TH: ElementConstructor;
    export declare const THEAD: ElementConstructor;
    export declare const TIME: ElementConstructor;
    export declare const TITLE: ElementConstructor;
    export declare const TR: ElementConstructor;
    export declare const TRACK: ElementConstructor;
    export declare const TT: ElementConstructor;
    export declare const U: ElementConstructor;
    export declare const UL: ElementConstructor;
    export declare const VAR: ElementConstructor;
    export declare const VIDEO: ElementConstructor;
    export declare const WBR: ElementConstructor;
    export declare const XMP: ElementConstructor;

}