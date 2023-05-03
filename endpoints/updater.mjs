import {queryMultiple} from "../db.mjs";

export default async (req, res) => {
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
};
