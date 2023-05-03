import {queryWhere} from '../db.mjs';
import {processBlockingData} from '../logic/blocking.mjs';

/**
 * This should get called in the endpoint that makes a fetch to blocking statuses.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export default async (req, res) => {
    /** @type {import('core').ParamsDictionary} */
    const params = req.params;
    /** @type {string} */
    const pathId = params['pathId'];
    /** @type {null|string[][]} */
    const pathSelector = pathId === '*' ? null : [['path', pathId]];

    // Run the SQL query: fetch all the data in Blocking
    const query = await queryWhere("Blocking", pathSelector);

    /**
     * Stores all the blockages loaded from the DB
     * @type {BlockingData[]}
     */
    let blockages = processBlockingData(query);

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
};
