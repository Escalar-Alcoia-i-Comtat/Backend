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

    /** @type {Object} */
    let result = {};

    for (const blockage of blockages) {
        const id = blockage.path;
        const paths = result.hasOwnProperty(id) ? result[id] : [];
        delete blockage.path;
        paths.push(blockage);
        result[id] = paths;
    }

    // If the result was single item, remove the path property
    if (result.hasOwnProperty('path'))
        delete result.path;

    res.status(200)
        .type('application/json')
        .send({result});
};
