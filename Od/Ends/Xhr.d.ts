/// <reference path="Oath.d.ts" />
declare namespace Xhr {
    interface XhrOptions {
        method?: string;
        async?: boolean;
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
    const send: (url: string, opts?: XhrOptions) => Oath.Promise<XMLHttpRequest>;
}
