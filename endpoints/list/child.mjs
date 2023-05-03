import {logRequest} from '../../logger.mjs';
import {queryWhere} from '../../db.mjs';
import {processDataClassQuery} from '../../data_processing.mjs';

export default async function (req, res) {
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
};
