const {log, info} = require("./logger");
const fs = require("fs");
const crypto = require("crypto");
const {queryData, update, insert} = require("./db");

/**
 * Gets the hash of the specified file.
 * @param {string} path The path of the file to checksum.
 * @return {string} The hash of the file.
 */
const getFileHash = (path) => crypto.createHash('md5').update(fs.readFileSync(path)).digest('hex');

/**
 * Runs the MD5 file updates on the set path.
 * @param {string} path The path to run md5 on.
 * @return {{path:string,hash:string}[]} A list of the hashes generated.
 */
const md5FileCheck = (path) => {
    /**
     * @type {{path:string,hash:string}[]}
     */
    let hashes = [];
    log(`📁 Getting contents of "${path}"...`);
    const files = fs.readdirSync(path);
    for (let f in files) {
        const file = files[f];
        const filePath = `${path}/${file}`;
        const stat = fs.lstatSync(filePath);
        if (stat.isDirectory())
            hashes = Object.assign({}, hashes, md5FileCheck(`${path}/${file}`));
        else
            hashes.push({path: filePath, hash: getFileHash(filePath)});
    }
    return hashes;
};

module.exports = {
    getFileHash,
    runHashesRoutine: async () => {
        info("📂 Running images MD5 checks...");

        const hashes = md5FileCheck('images');
        info("ℹ️ Got", hashes.length, "hashes.");

        info("🛒 Fetching server hashes...");
        const serverHashesData = await queryData("Hashes", "id", "path", "hash");
        /**
         * An array of the data loaded from the server.
         * @type {{path:string,hash:string,id:Number}[]}
         */
        let serverHashes = [];
        for (let h in serverHashesData)
            if (serverHashesData.hasOwnProperty(h) && serverHashesData[h].path != null) {
                const serverHash = serverHashesData[h];
                serverHashes.push({path: serverHash.path, hash: serverHash.hash, id: serverHash.id});
            }
        info("   Got", serverHashes.length, "hashes from server.");

        /**
         * Stores all the hashes that must be updated on the server.
         * @type {{serverId:Number,path:string,hash:string}[]}
         */
        const updateHashes = [];

        info("🗳️ Searching for wrong hashes...");
        const serverPaths = serverHashes.map((item) => item.path);
        for (const h in Object.keys(hashes)) {
            const key = Object.keys(hashes)[h];
            const localRow = hashes[key];
            const localHash = localRow.hash;
            const path = localRow.path;
            const serverIndex = serverPaths.indexOf(path);
            /**
             * @type {{path: string, hash: string, id: Number}|null}
             */
            const serverRow = serverIndex >= 0 ? serverHashes[serverIndex] : null;
            if (serverRow == null || localHash !== serverRow.hash) {
                log(`💨 Hash of "${path}" is not stored on server, or it's wrong.`);
                updateHashes.push({
                    serverId: serverRow != null ? serverRow.id : null,
                    path: path,
                    hash: localHash,
                });
            }
        }
        info("   Got", updateHashes.length, "hashes to update.");

        for (const h in updateHashes) {
            const hashData = updateHashes[h];
            const serverId = hashData.serverId;
            const path = hashData.path;
            const hash = hashData.hash;
            if (serverId != null)
                await update("Hashes", ['id', serverId.toString()], {hash})
            else
                await insert("Hashes", {path, hash});
        }
    }
};
