/// <reference path="./Oath.ts"/>
var Xhr;
(function (Xhr) {
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
    Xhr.send = function (url, opts) {
        if (opts === void 0) { opts = {}; }
        var xhr = new XMLHttpRequest();
        var method = opts.method || "GET";
        var async = (opts.async !== false);
        var user = opts.user;
        var password = opts.password;
        xhr.open(method, url, async, user, password);
        var requestHeaders = opts.requestHeaders;
        if (requestHeaders)
            for (var header in requestHeaders) {
                var value = requestHeaders[header];
                xhr.setRequestHeader(header, value);
            }
        if (opts.timeout != null)
            xhr.timeout = opts.timeout;
        if (opts.withCredentials != null)
            xhr.withCredentials = opts.withCredentials;
        if (opts.onprogress)
            xhr.addEventListener("progress", opts.onprogress);
        if (opts.overrideMimeType)
            xhr.overrideMimeType(opts.overrideMimeType);
        var promise = Oath.make(function (pass, fail) {
            xhr.onreadystatechange = readyStateChangeHandler(xhr, pass, fail);
        });
        xhr.send(opts.data);
        return promise;
    };
    var readyStateChangeHandler = function (xhr, pass, fail) {
        return function (v) {
            if (xhr.readyState !== 4 /* DONE */)
                return;
            (200 <= xhr.status && xhr.status < 300 ? pass : fail)(xhr);
        };
    };
})(Xhr || (Xhr = {}));