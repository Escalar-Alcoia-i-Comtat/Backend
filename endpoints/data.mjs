import {logRequest} from '../logger.mjs';
import {queryMultiple} from '../db.mjs';
import {processDataClassQuery, processRow} from '../data_processing.mjs';

export default async function (req, res){
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
};
