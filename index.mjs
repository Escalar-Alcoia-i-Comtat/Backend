// noinspection HttpUrlsUsage

'use strict';

import dotenv from 'dotenv';
dotenv.config();

import packageJson from './package.json' assert {type: 'json'};

import express from 'express';
import cors from 'cors';
import fs from 'fs';

import http from 'http';
import https from 'https';

import {info, error, warn} from './logger.mjs';

const app = express();

info("🔧 Running environment checks...");

/**
 * The port which the application listens for http requests.
 * @type {number}
 */
const http_port = process.env.HTTP_PORT || 3000;

/**
 * The port which the application listens for https requests.
 * @type {number}
 */
const https_port = process.env.HTTPS_PORT || 3001;

const isProduction = process.env.IS_PRODUCTION || false;

const sslPathRoot = process.env.SSL_PATH || '/usr/src/escalaralcoiaicomtat/letsencrypt';

const sslPrivFileName = process.env.SSL_PRIV_FILENAME || 'privkey.pem';
const sslCertFileName = process.env.SSL_CERT_FILENAME || 'cert.pem';
const sslChainFileName = process.env.SSL_CHAIN_FILENAME || 'chain.pem';

const corsHosts = process.env.CORS_HOSTS;

const sslPathPriv = `${sslPathRoot}/${sslPrivFileName}`;
const sslPathCert = `${sslPathRoot}/${sslCertFileName}`;
const sslPathCa = `${sslPathRoot}/${sslChainFileName}`;

let mysqlError = false;
let acmeError = false;
let sslError = false;

if (process.env.MYSQL_HOST == null) {
    error("⚠️ MYSQL_HOST environment variable is not set.");
    mysqlError = true;
}
if (process.env.MYSQL_USER == null) {
    error("⚠️ MYSQL_USER environment variable is not set.");
    mysqlError = true;
}
if (process.env.MYSQL_PASS == null) {
    error("⚠️ MYSQL_PASS environment variable is not set.");
    mysqlError = true;
}
if (process.env.FILES_PATH == null) {
    warn("❗ FILES_PATH environment variable is not set. Using default ./files");
    process.env['FILES_PATH'] = './files';
}

if (process.env.ACME_NAME == null) {
    error("⚠️ ACME_NAME environment variable is not set.");
    acmeError = true;
}
if (process.env.ACME_VALUE == null) {
    error("⚠️ ACME_VALUE environment variable is not set.");
    acmeError = true;
}

if (!fs.existsSync(sslPathPriv)) {
    error("⚠️ Private SSL key file doesn't exist.");
    sslError = true;
}
if (!fs.existsSync(sslPathCert)) {
    error("⚠️ SSL certificate doesn't exist.");
    sslError = true;
}
if (!fs.existsSync(sslPathCa)) {
    error("⚠️ SSL chain file doesn't exist.");
    sslError = true;
}

if (mysqlError) {
    error("❌ Some MySQL environment variables were not set.");
    error("   MySQL is required for the correct working of the system.");
    error("   Boot is not possible.");
    process.exit(1);
}
if (acmeError) {
    warn("❌ Some ACME validation variables were not set.");
}
if (sslError) {
    warn("❌ Some SSL files were not found.");
    warn("   HTTPS will not work.");
}

info('🔐 Creating CORS options...');
const allowedOrigins = [
    // 'localhost:5000', // The Firebase emulator
    'images.escalaralcoiaicomtat.org', // The image generator server
    'arnyminerz.com', // The reverse proxy
];
if (corsHosts != null) {
    const hosts = corsHosts.split(',');
    info('   Adding', hosts.length, 'hosts to the CORS policy:');
    for (const h in hosts)
        if (hosts.hasOwnProperty(h)) {
            const host = hosts[h];
            allowedOrigins.push(host);
        }
}
const corsOptions = {
    /**
     * @callback corsCallback
     * @param {*} error The error message. null if no error should be shown.
     * @param {boolean|string|RegExp|Array} origin The result origin.
     */
    /**
     * Gets called whenever a CORS request needs to be parsed.
     * @param {string|null} or The origin name. Contains protocol prefix.
     * @param {corsCallback} callback Should be called with the result of the operation.
     * @return {*}
     */
    origin: (or, callback) => {
        // Allow requests with no origin. This includes the Android app.
        if (!or)
            return callback(null, true);

        // Remove the protocol prefix.
        const origin = or
            .replace('https://', '')
            .replace('http://', '');

        // Do not allow requests from sources not included in allowedOrigins
        if (allowedOrigins.indexOf(origin) === -1)
            return callback(
                new Error('The CORS policy of this site does not allow requests from the specified domain'),
                false
            );

        // If allowed origins includes origin, allow request.
        return callback(null, true);
    },
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

import {runHashesRoutine} from './hashes.mjs';

import blockingEndpoint from './endpoints/blocking.mjs';
import oldBlockingEndpoint from './endpoints/blocking.old.mjs';
import listBaseEndpoint from './endpoints/list/base.mjs';
import listChildEndpoint from './endpoints/list/child.mjs';
import dataEndpoint from './endpoints/data.mjs';
import checksumEndpoint from './endpoints/file/checksum.mjs';
import downloadEndpoint from './endpoints/file/download.mjs';
import updaterEndpoint from './endpoints/updater.mjs';

runHashesRoutine().then(async () => {
    info("🕳️ Adding GET listeners...");

    app.get('/api/info/blocking/:pathId', cors(corsOptions), oldBlockingEndpoint);
    app.get('/api/v1/info/blocking/:pathId', cors(corsOptions), oldBlockingEndpoint);
    app.get('/api/v2/info/blocking/:pathId', cors(corsOptions), blockingEndpoint);

    app.get('/api/list/:type', cors(corsOptions), listBaseEndpoint);
    app.get('/api/v1/list/:type', cors(corsOptions), listBaseEndpoint);

    app.get('/api/list/:type/:parentId', cors(corsOptions), listChildEndpoint);
    app.get('/api/v1/list/:type/:parentId', cors(corsOptions), listChildEndpoint);

    app.get('/api/data/:type/:objectId', cors(corsOptions), dataEndpoint);
    app.get('/api/v1/data/:type/:objectId', cors(corsOptions), dataEndpoint);

    app.get('/api/files/checksum', cors(corsOptions), checksumEndpoint);
    app.get('/api/v1/files/checksum', cors(corsOptions), checksumEndpoint);

    app.get('/api/files/download', cors(corsOptions), downloadEndpoint);
    app.get('/api/v1/files/download', cors(corsOptions), downloadEndpoint);

    app.get('/api/updater', cors(corsOptions), updaterEndpoint);
    app.get('/api/v1/updater', cors(corsOptions), updaterEndpoint);

    app.get('/api/info', cors(corsOptions), (req, res) =>res.send({version: packageJson.version, isProduction}));
    app.get('/api/v1/info', cors(corsOptions), (req, res) =>res.send({version: packageJson.version, isProduction}));

    if (!acmeError) {
        const acmeName = process.env.ACME_NAME;
        const acmeContents = process.env.ACME_VALUE;
        info(`🔃 Adding ACME validation endpoint (${acmeName})...`);
        app.get(`/.well-known/acme-challenge/${acmeName}`, (req, res) => {
            res.status(200).send(acmeContents);
        });
    }

    if (!sslError) {
        info("🔃 Creating https server...");
        const httpsServer = https.createServer({
            key: fs.readFileSync(sslPathPriv, 'utf8'),
            cert: fs.readFileSync(sslPathCert, 'utf8'),
            ca: fs.readFileSync(sslPathCa, 'utf8'),
        }, app);

        httpsServer.listen(https_port, () => {
            info(`👂 Listening for requests on https://localhost:${https_port}`);
        });
    }

    info("🔃 Creating http server...");
    const httpServer = http.createServer(app);

    httpServer.listen(http_port, () => {
        info(`👂 Listening for requests on http://localhost:${http_port}`);
    });
});
