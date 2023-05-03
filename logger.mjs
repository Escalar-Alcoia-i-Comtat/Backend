import clc from 'cli-color';

export const info = (...data) => console.info(clc.yellow(data.join(' ')));

export const log = (...data) => console.log(data.join(' '));

export const warn = (...data) => console.warn(clc.yellow(data.join(' ')));

export const error = (...data) => console.error(clc.red(data.join(' ')));

/**
 * Logs a message according to a server request.
 * @param {import('express').Request<import('express').P, import('express').ResBody, import('express').ReqQuery, import('express').Locals>} request The request made to the server.
 */
export const logRequest = (request) =>
    info("📡 Received request. URL:", request.url, "IP:", request.ip);
