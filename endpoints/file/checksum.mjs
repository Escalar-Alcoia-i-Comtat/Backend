import {queryWhere} from "../../db.mjs";

export default async (req, res) => {
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
};
