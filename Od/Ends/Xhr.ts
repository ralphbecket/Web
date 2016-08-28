/// <reference path="./Oath.ts"/>

namespace Xhr {

    export interface XhrOptions {
        method?: string; // Default GET.
        async?: boolean; // Default true.
        user?: string;
        password?: string;
        requestHeaders?: {
            [header: string]: string;
        };
        timeout?: number;
        withCredentials?: boolean;
        onprogress?: (event: ProgressEvent) => any;
        overrideMimeType?: string;
        data?: any;
    }

    // send(url, opts)
    //
    // Make an XMLHttpRequest to the given URL with the provided options.
    // The result is a promise which will be fulfilled with the XMLHttpRequest
    // if the request succeeds (i.e., the status code is in 200..299) or
    // rejected with the XMLHttpRequest if the request fails (i.e., the status
    // code is anything else).
    // 
    export const send = (
        url: string,
        opts = {} as XhrOptions
    ): Oath.Promise<XMLHttpRequest> => {

        const xhr = new XMLHttpRequest();

        const method = opts.method || "GET";
        const async = (opts.async !== false);
        const user = opts.user;
        const password = opts.password;

        xhr.open(method, url, async, user, password);

        const requestHeaders = opts.requestHeaders;
        if (requestHeaders) for (var header in requestHeaders) {
            const value = requestHeaders[header];
            xhr.setRequestHeader(header, value);
        }

        if (opts.timeout != null) xhr.timeout = opts.timeout;

        if (opts.withCredentials != null) xhr.withCredentials = opts.withCredentials;

        if (opts.onprogress) xhr.addEventListener("progress", opts.onprogress);

        if (opts.overrideMimeType) xhr.overrideMimeType(opts.overrideMimeType);

        const promise = Oath.make((pass, fail) => {
            xhr.onreadystatechange = readyStateChangeHandler(xhr, pass, fail);
        });

        xhr.send(opts.data);

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