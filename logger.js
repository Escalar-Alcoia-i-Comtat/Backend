const clc = require('cli-color');
const {Request, P, ResBody, ReqQuery, Locals} = require('express');

const _info = (...data) => {
    console.info(clc.yellow(data.join(' ')));
};

module.exports = {
    info: _info,
    log: (...data) => {
        console.log(data.join(' '));
    },
    warn: (...data) => {
        console.warn(clc.yellow(data.join(' ')));
    },
    error: (...data) => {
        console.error(clc.red(data.join(' ')));
    },

    /**
     * Logs a message according to a server request.
     * @param {Request<P, ResBody, ReqQuery, Locals>} request The request made to the server.
     */
    logRequest: (request) => {
        _info("📡 Received request. URL:", request.url, "IP:", request.ip);
    },
};
