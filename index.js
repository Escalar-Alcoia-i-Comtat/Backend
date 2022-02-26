'use strict';

require('dotenv').config()

const express = require('express');
const fs = require('fs');

const {info, error, warn, logRequest} = require('./logger');

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
if (process.env.FILES_PATH == null) {
    warn("❗ FILES_PATH environment variable is not set. Using default ./files");
    process.env['FILES_PATH'] = './files';
}

if (mysqlError) {
    error("❌ Some MySQL environment variables were not set.");
    error("   MySQL is required for the correct working of the system.");
    error("   Boot is not possible.");
    process.exit(1);
    return;
}

const {queryData, queryWhere, queryMultiple} = require('./db');
const {processDataClassQuery, processRow} = require('./data_processing');
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

    app.get('/api/data/:type/:objectId', async (req, res) => {
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

    app.get('/api/updater', async (req, res) => {
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

    app.get('/', (req, res) => {
        res.status(200).type("text/plain").send("hello world!");
    });

    app.listen(http_port, () => {
        info(`Listening for requests on http://localhost:${http_port}`);
    });
});
