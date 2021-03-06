// noinspection HttpUrlsUsage

'use strict';

require('dotenv').config()

const version = require('root-require')('package.json').version;

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const http = require('http');
const https = require('https');

const {info, error, warn, logRequest} = require('./logger');

const app = express();

const allowedOrigins = [
    'localhost:5000', // The Firebase emulator
    'images.escalaralcoiaicomtat.org', // The image generator server
    'arnyminerz.com', // The reverse proxy
];
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
    return;
}
if (acmeError) {
    warn("❌ Some ACME validation variables were not set.");
}
if (sslError) {
    warn("❌ Some SSL files were not found.");
    warn("   HTTPS will not work.");
}

const {queryData, queryWhere, queryMultiple} = require('./db');
const {processDataClassQuery, processRow} = require('./data_processing');
const {runHashesRoutine} = require('./hashes');

runHashesRoutine().then(() => {
    info("🕳️ Adding GET listeners...");

    app.get('/api/info/blocking/:pathId', cors(corsOptions), async (req, res) => {
        /**
         * @type {*[]}
         */
        const params = req.params;
        /**
         * @type {string}
         */
        const pathId = params['pathId'];
        /**
         * @type {null|string[][]}
         */
        const pathSelector = pathId === '*' ? null : [['path', pathId]];

        // Run the SQL query
        const query = await queryWhere("Blocking", pathSelector);

        /**
         * Stores all the blockages loaded from the DB
         * @type {{path:string,blocked:boolean,type:string,endDate:Date|null}[]}
         */
        let blockages = [];

        const now = new Date();

        for (let i in query) {
            const row = query[i];
            if (!row.id) continue;
            /**
             * @type {string}
             */
            const type = row['type'];
            /**
             * @type {Date|null}
             */
            const endDate = row['end_date'];
            /**
             * @type {string}
             */
            const path = row['path'];

            if (endDate != null && now.getTime() < endDate.getTime())
                blockages.push({path, blocked: true, type, endDate})
            else
                blockages.push({path, blocked: true, type, endDate: null})
        }

        /**
         * @type {{path: string, blocked: boolean, type: string, endDate: (Date|null)}|Object<string, {path: string, blocked: boolean, type: string, endDate: (Date|null)}[]>}
         */
        let result = blockages.length === 1 ?
            // If only one item, result is that item
            blockages[0] :
            // If multiple items, create a map with all the items and the respective path ids
            blockages.reduce((map, obj) => {
                const path = obj.path;
                delete obj.path;
                map[path] = obj;
                return map;
            }, {});

        // If the result was single item, remove the path property
        if (result.hasOwnProperty('path'))
            delete result.path;

        res.status(200)
            .type('application/json')
            .send({result});
    });

    app.get('/api/list/:type', cors(corsOptions), async (req, res) => {
        const params = req.params;
        const type = params.type;
        let code = 400;
        let result = {"error": "bad-request"};
        const types = ['Areas', 'Zones', 'Sectors', 'Paths'];
        if (types.includes(type)) {
            const query = await queryData(params.type);
            code = 200;
            result = {result: processDataClassQuery(query)};
        } else if (type === '*') {
            /**
             * @type {{table:string,fields:string[]|null,where:string[][]|null,limit:number|null}[]}
             */
            const queries = types.map((type) => {
                return {
                    table: type,
                    where: null,
                    fields: null,
                    limit: null,
                };
            });
            const results = await queryMultiple(queries);
            code = 200;
            const builtResult = {};
            for (let i in results) {
                const row = results[i];
                builtResult[types[i]] = processDataClassQuery(row);
            }
            result = {
                result: builtResult
            };
        }
        res.status(code).type("application/json").send(result);
    });

    app.get('/api/list/:type/:parentId', cors(corsOptions), async (req, res) => {
        logRequest(req);
        const params = req.params;
        const type = params.type;
        let code = 400;
        let result = {"error": "bad-request"};
        if (['Zones', 'Sectors', 'Paths'].includes(type)) {
            const colName = type === 'Zones' ? 'area' : type === 'Sectors' ? 'zone' : 'sector';
            const query = await queryWhere(params.type, [[colName, params.parentId]]);
            code = 200;
            result = {result: processDataClassQuery(query)};
        }
        res.status(code).type("application/json").send(result);
    });

    app.get('/api/data/:type/:objectId', cors(corsOptions), async (req, res) => {
        logRequest(req);
        const params = req.params;
        /**
         * @type {string}
         */
        const type = params.type;
        /**
         * @type {string}
         */
        const objectId = params.objectId;

        const query = req.query;
        const loadChildren = query['loadChildren'] === 'true';

        let code = 400;
        let result = {"error": "bad-request"};
        if (['Areas', 'Zones', 'Sectors', 'Paths'].includes(type)) {
            /**
             * @type {{table:string,fields:string[]|null,where:string[][]|null,limit:number|null}[]}
             */
            let queries = [];
            queries.push({
                table: type,
                where: [['objectId', '=', `'${objectId}'`]],
                fields: null,
                limit: null,
            });

            // Check if loadChildren is true, and if the type selected may contain children.
            if (loadChildren && ['Areas', 'Zones', 'Sectors'].includes(type)) {
                const childTable = type === 'Areas' ? 'Zones' : type === 'Zones' ? 'Sectors' : 'Paths';
                const colName = type === 'Areas' ? 'area' : type === 'Zones' ? 'zone' : 'sector';
                queries.push({
                    table: childTable,
                    where: [[colName, objectId]],
                    fields: null,
                });
            }
            const queryResults = await queryMultiple(queries);

            const parent = processDataClassQuery(queryResults[0]);
            let children = [];
            if (loadChildren) {
                const childrenRows = queryResults[1];
                const keys = Object.keys(childrenRows);
                for (let k in keys) {
                    const key = keys[k];
                    if (key === 'meta') continue;
                    const row = childrenRows[key];
                    children.push(processRow(row, false));
                }
            }

            code = 200;
            result = {result: children.length > 0 ? {parent, children} : parent};
        }
        res.status(code).type("application/json").send(result);
    });

    app.get('/api/files/checksum', cors(corsOptions), async (req, res) => {
        const query = req.query;
        /**
         * @type {string|null}
         */
        const pairs = query['pairs'];
        if (pairs == null)
            return res.status(400).type("application/json").send({
                'error': 'bad-request',
                'message': 'Missing "pairs" parameter.'
            });
        /**
         * @type {string[]}
         */
        const json = JSON.parse(pairs);
        /**
         * @type {string[]}
         */
        const paths = Object.keys(json);
        /**
         * @type {string[]}
         */
        const checksums = Object.values(json);
        /**
         * Stores all the hashes that should be downloaded again by the requesting device.
         * @type {string[]}
         */
        const expiredHashes = [];
        for (let p in paths) {
            const path = paths[p];
            const requestChecksum = checksums[p];
            const query = await queryWhere('Hashes', [['path', path]], 'hash');
            // There should only be one or none result
            /**
             * @type {{hash:string}|null}
             */
            const item = query[0];
            if (item == null)
                return res
                    .status(400)
                    .type('application/json')
                    .send({'error': 'file-not-found', 'message': `The file "${path}" was not found in server.`});
            const serverHash = item.hash;
            if (requestChecksum !== serverHash)
                expiredHashes.push(path);
        }
        res.status(200).type('application/json').send({'result': {'expired_hashes': expiredHashes}});
    });

    app.get('/api/files/download', cors(corsOptions), (req, res) => {
        const query = req.query;
        /**
         * @type {string|null}
         */
        let path = query.path;
        if (path == null)
            return res
                .status(400)
                .type("application/json")
                .send({'error': 'bad-request', 'message': 'Missing "path" parameter.'});
        path = `${process.env.FILES_PATH}/${path}`;
        if (!fs.existsSync(path))
            return res
                .status(406)
                .type("application/json")
                .send({'error': 'path-not-found', 'message': 'The path specified was not found'});
        const fileInfo = fs.lstatSync(path);
        if (fileInfo.isDirectory())
            return res
                .status(406)
                .type("application/json")
                .send({'error': 'path-not-file', 'message': 'The path must point to a file'});
        const imageFile = fs.readFileSync(path);
        const mime = path.endsWith('jpg') || path.endsWith('jpeg') ? 'image/jpeg' :
            path.endsWith('jpg') ? 'image/png' :
                path.endsWith('kmz') ? 'application/vnd.google-earth.kmz' :
                    path.endsWith('kml') ? 'application/vnd.google-earth.kmz+xml' : 'text/plain';

        res.status(200).type(mime).send(imageFile);
    });

    app.get('/api/updater', cors(corsOptions), async (req, res) => {
        const query = req.query;
        /**
         * @type {string|null}
         */
        const millis = query['millis'];
        if (millis == null)
            return res.status(400).send({'error': 'bad-request', 'message': 'Missing "millis" parameter.'});
        const tables = ['Areas', 'Zones', 'Sectors', 'Paths'];
        const typesQuery = await queryMultiple(tables.map((table) => {
            return {
                table,
                fields: ['objectId'],
                where: [['UNIX_TIMESTAMP(last_edit)*1000', '>=', `'${millis}'`]],
                limit: null
            }
        }));
        let updatableObjects = [];
        for (let q in typesQuery) {
            const tableResults = typesQuery[q];
            if (tableResults.length > 0)
                updatableObjects.push({
                    table: tables[q],
                    ids: tableResults.map((result) => {
                        return result['objectId'].toString();
                    }),
                });
        }
        res.send({result: {updateAvailable: updatableObjects.length > 0, fields: updatableObjects}});
    });

    app.get('/api/info', cors(corsOptions), async (req, res) => {
        res.send({ version, isProduction });
    });

    app.get('/', (req, res) => {
        res.status(200).type("text/plain").send("hello world!");
    });

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
