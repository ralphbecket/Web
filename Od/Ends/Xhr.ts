/// <reference path="./Oath.ts"/>

namespace Xhr {

    export interface IXhrOptions { [key: string]: any }

    // send(url, opts)
    //
    // Make an XMLHttpRequest to the given URL with the provided
    // (optional) options in opts.
    //
    // If opts contains key k and value v then the generated XMLHttpRequest
    // will have property k set to v.  You can use this scheme to set the
    // timeout value, amongst others.
    //
    // If opts contains an entry "requestHeaders" then for each key k and
    // value v therein the generated XMLHttpRequest will be initialised
    // with setRequestHeader(k, v).
    //
    // The XMLHttpRequest will be opened using the "method" (default "GET"),
    // "async" (default true), "user", and "password" entries in opts.
    //
    // The data sent is taken from the "data" entry of opts.
    //
    // All these are, of course, optional.
    //
    // The result is a promise which will be fulfilled with the XMLHttpRequest
    // if the request succeeds (i.e., the status code is in 200..299) or
    // rejected with the XMLHttpRequest if the request fails (i.e., the status
    // code is anything else).
    // 
    export const send = (
        url: string,
        opts = {} as IXhrOptions
    ): Oath.IThenable<XMLHttpRequest> => {

        const xhr = new XMLHttpRequest();

        const method = opts["method"] || "GET";
        const async = (opts["async"] !== false);
        const user = opts["user"];
        const password = opts["password"];
        const data = opts["data"];

        xhr.open(method, url, async, user, password);

        for (var key in opts) {
            const value = opts[key];
            (xhr as any)[key] = value;
        }

        const requestHeaders = opts["requestHeaders"];
        if (requestHeaders) for (var header in requestHeaders) {
            const value = requestHeaders[header];
            xhr.setRequestHeader(header, value);
        }

        const promise = Oath.make((pass, fail) => {
            xhr.onreadystatechange = readyStateChangeHandler(xhr, pass, fail);
        });

        xhr.send(data);

        return promise;
    };

    const readyStateChangeHandler = (
        xhr: XMLHttpRequest,
        pass: (xhr: XMLHttpRequest) => void,
        fail: (xhr: any) => void
    ) => (
        v: ProgressEvent
    ): any => {
        if (xhr.readyState !== 4 /* DONE */) return;
        (200 <= xhr.status && xhr.status < 300 ? pass : fail)(xhr);
    };

}