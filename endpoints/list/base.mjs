import {queryData, queryMultiple} from '../../db.mjs'
import {processDataClassQuery} from '../../data_processing.mjs';

export default async function (req, res) {
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
};