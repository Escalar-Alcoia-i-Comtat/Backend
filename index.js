'use strict';

require('dotenv').config()

const express = require('express');
const fs = require('fs');

const {info, error, logRequest} = require('./logger');

const app = express();

info("🔧 Running environment checks...");

/**
 * The port which the application listens for http requests.
 * @type {number}
 */
const http_port = process.env.HTTP_PORT || 3000;

let mysqlError = false;

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

if (mysqlError) {
    error("❌ Some MySQL environment variables were not set.");
    error("   MySQL is required for the correct working of the system.");
    error("   Boot is not possible.");
    process.exit(1);
    return;
}

const {queryData, queryWhere, queryMultiple} = require('./db');
const {processDataClassQuery} = require('./data_processing');
const {runHashesRoutine} = require('./hashes');

runHashesRoutine().then(() => {
    info("🕳️ Adding GET listeners...");

    app.get('/api/info/blocking/:pathId', async (req, res) => {
        const params = req.params;
        /**
         * @type {string}
         */
        const pathId = params['pathId'];
        const query = await queryWhere("Blocking", [["path", pathId]]);
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
            if (endDate != null) {
                const now = new Date();
                if (now.getTime() < endDate.getTime())
                    return res.status(200).type('application/json').send({'result': {blocked: true, type}});
            } else
                return res.status(200).type('application/json').send({'result': {blocked: true, type}});
        }
        res.status(200).type('application/json').send({'result': {blocked: false}});
    });

    app.get('/api/list/:type', async (req, res) => {
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
             * @type {{fields: string[], table: string}[]}
             */
            const queries = types.map((type) => {
                return {
                    table: type,
                    fields: [],
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

    app.get('/api/list/:type/:parentId', async (req, res) => {
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

    app.get('/api/files/checksum', async (req, res) => {
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

    app.get('/api/files/download', (req, res) => {
        const query = req.query;
        /**
         * @type {string|null}
         */
        const path = query.path;
        if (path == null)
            return res
                .status(400)
                .type("application/json")
                .send({'error': 'bad-request', 'message': 'Missing "path" parameter.'});
        if (!path.startsWith('images'))
            return res
                .status(400)
                .type("application/json")
                .send({
                    'error': 'invalid-path',
                    'message': 'The path specified is not valid. Accepted paths: images/**'
                });
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
        res.status(200).type('image/jpeg').send(imageFile);
    });

    app.get('/', (req, res) => {
        res.status(200).type("text/plain").send("hello world!");
    });

    app.listen(http_port, () => {
        info(`Listening for requests on http://localhost:${http_port}`);
    });
});
