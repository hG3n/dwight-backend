import * as https from "https";
import {URL} from "url";
import {Promise} from 'es6-promise';

export const httpRequest = (method, url: string, body: any = null): Promise<HttpResponse> => {
    if (!['GET', 'POST', 'HEAD'].includes(method)) {
        throw new Error(`Invalid method: ${method}`);
    }

    let urlObject;

    try {
        urlObject = new URL(url);
    } catch (error) {
        throw new Error(`Invalid url ${url}`);
    }

    if (body && method !== 'POST') {
        throw new Error(`Invalid use of the body parameter while using the ${method.toUpperCase()} method.`);
    }

    let options = {
        method: method,
        hostname: urlObject.hostname,
        port: urlObject.port,
        path: urlObject.pathname,
        headers: null,
    };

    if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    return new Promise((resolve, reject) => {

        const clientRequest = https.request(options, incomingMessage => {

            // Response object.
            let response = {
                statusCode: incomingMessage.statusCode,
                headers: incomingMessage.headers,
                body: null
            };

            const body_chunks = [];

            // Collect response body data.
            incomingMessage.on('data', chunk => {
                body_chunks.push(chunk);
            });

            // Resolve on end.
            incomingMessage.on('end', () => {
                if (body_chunks.length) {
                    response.body = Buffer.concat(body_chunks).toString();
                }

                resolve(response);
            });
        });

        // Reject on request error.
        clientRequest.on('error', error => {
            reject(error);
        });

        // Write request body if present.
        if (body) {
            clientRequest.write(body);
        }

        // Close HTTP connection.
        clientRequest.end();
    });
};

export interface HttpResponse {
    statusCode: number;
    headers: any;
    body: string | any;
}
