import {queryWhere} from "../db.mjs";

export default async (req, res) => {
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
};
