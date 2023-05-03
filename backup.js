const {info, log} = require("./logger.mjs");
const fs = require("fs");
const {addData} = require("./db.mjs");

const {core} = require('express');

module.exports = {
    /**
     * Adds the /clone path to the
     * @param {core.Express} app The app instance to add the get method to.
     */
    addClone: (app) => {
        app.get('/clone', async (req, res) => {
            info("Cloning data from data.json to Database...");
            const now = new Date().toJSON().slice(0, 19).replace('T', ' ');
            const jsonData = fs.readFileSync('data.json');
            const data = JSON.parse(jsonData);
            for (let areaKey in data)
                if (data.hasOwnProperty(areaKey)) {
                    const area = data[areaKey];

                    info(`Inserting Area \"${areaKey}\"...`);
                    const aCreation = new Date(area.created.value._seconds * 1000).toJSON().slice(0, 19).replace('T', ' ');
                    const a = await addData('Areas', [areaKey, aCreation, now, area.displayName, area.image, area.kmz, area.webURL]);
                    log("Area SQL:", a);

                    const zones = area.__collections__.Zones;
                    for (let zoneKey in zones)
                        if (zones.hasOwnProperty(zoneKey)) {
                            const zone = zones[zoneKey];

                            info(`  Inserting Zone \"${zoneKey}\"...`);
                            const zCreation = new Date(zone.created.value._seconds * 1000).toJSON().slice(0, 19).replace('T', ' ');
                            const zPos = zone.location.value;
                            const z = await addData(
                                'Zones',
                                [
                                    zoneKey,
                                    zCreation,
                                    now,
                                    zone.displayName,
                                    zone.image,
                                    zone.kmz,
                                    zPos._latitude,
                                    zPos._longitude,
                                    zone.webURL,
                                    areaKey,
                                ],
                            );
                            log("Zone SQL:", z);

                            const sectors = zone.__collections__.Sectors;
                            for (let sectorKey in sectors)
                                if (sectors.hasOwnProperty(sectorKey)) {
                                    const sector = sectors[sectorKey];

                                    info(`  Inserting Sector \"${sectorKey}\"...`);
                                    const sCreation = new Date(zone.created.value._seconds * 1000).toJSON().slice(0, 19).replace('T', ' ');
                                    const sPos = zone.location.value;
                                    const sun = sector.sunTime;
                                    const s = await addData(
                                        'Sectors',
                                        [
                                            sectorKey,
                                            sCreation,
                                            now,
                                            sector.displayName,
                                            sector.image,
                                            sector.kidsApt,
                                            sPos._latitude,
                                            sPos._longitude,
                                            sun === 0 ? 'day' : sun === 1 ? 'morning' : sun === 2 ? 'afternoon' : 'none',
                                            sector.walkingTime,
                                            sector.weight,
                                            areaKey,
                                        ],
                                    );
                                    log("Sector SQL:", s);

                                    const paths = sector.__collections__.Paths;
                                    for (let pathKey in paths)
                                        if (paths.hasOwnProperty(pathKey)) {
                                            const path = paths[pathKey];

                                            info(`  Inserting Path \"${pathKey}\"...`);
                                            const pCreation = new Date(path.created.value._seconds * 1000).toJSON().slice(0, 19).replace('T', ' ');
                                            const p = await addData(
                                                'Paths',
                                                [
                                                    pathKey,
                                                    pCreation,
                                                    now,
                                                    path.displayName,
                                                    path.sketchId,
                                                    path.grade,
                                                    !!path.height ? path.height.join(';') : 'NULL',
                                                    !!path.builtBy && path.builtBy.length > 0 ? path.builtBy : 'NULL',
                                                    !!path.rebuiltBy && !!path.rebuiltBy.length > 0 ? path.rebuiltBy.join(';') : 'NULL',
                                                    path.description && path.description.length > 0 ? path.description : 'NULL',
                                                    path.description && path.description.length > 0 ? path.showDescription : false,
                                                    path.stringCount,
                                                    path.paraboltCount,
                                                    path.burilCount,
                                                    path.pitonCount,
                                                    path.spitCount,
                                                    path.tensorCount,
                                                    path.crackerRequired,
                                                    path.friendRequired,
                                                    path.lanyardRequired,
                                                    path.nailRequired,
                                                    path.pitonRequired,
                                                    path.stripsRequired,
                                                    !!path.ending && path.ending.length > 0 ? path.ending.join(';') : 'NULL',
                                                    !!path.ending_artifo && path.ending_artifo.length > 0 ? path.ending_artifo.replaceAll('\r', '').replaceAll('\n', ';') : 'NULL',
                                                    sectorKey,
                                                ],
                                            );
                                            log("Path SQL:", p);
                                        }
                                }
                        }
                }

            res.status(200).type("application/json").send(data);
        });
    },
};