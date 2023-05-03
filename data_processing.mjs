/**
 * Processes the data from a row of the database.
 * @param row
 * @param {boolean} deleteObjectId
 * @returns
 */
export const processRow = (row, deleteObjectId = true) => {
    if (deleteObjectId)
        delete row["objectId"];
    else
        row['objectId'] = row.objectId.toString();

    if (row.hasOwnProperty('area'))
        row['area'] = row.area.toString();
    if (row.hasOwnProperty('zone'))
        row['zone'] = row.zone.toString();
    if (row.hasOwnProperty('sector'))
        row['sector'] = row.sector.toString();

    // Sector adjustments
    if (row.hasOwnProperty('kidsApt'))
        row['kidsApt'] = row.kidsApt === '1';

    // Path adjustments
    if (row.hasOwnProperty('showDescription'))
        row['showDescription'] = row.showDescription === 1;
    if (row.hasOwnProperty('crackerRequired'))
        row['crackerRequired'] = row.crackerRequired === 1;
    if (row.hasOwnProperty('friendRequired'))
        row['friendRequired'] = row.friendRequired === 1;
    if (row.hasOwnProperty('lanyardRequired'))
        row['lanyardRequired'] = row.lanyardRequired === 1;
    if (row.hasOwnProperty('nailRequired'))
        row['nailRequired'] = row.nailRequired === 1;
    if (row.hasOwnProperty('pitonRequired'))
        row['pitonRequired'] = row.pitonRequired === 1;
    if (row.hasOwnProperty('stripsRequired'))
        row['stripsRequired'] = row.stripsRequired === 1;

    return row;
};

export const processDataClassQuery = (query) => {
    let items = {};
    for (let i in query)
        if (query.hasOwnProperty(i) && query[i].objectId != null) {
            const row = query[i];
            const objectId = row.objectId.toString();
            items[objectId] = processRow(row);
        }
    return items;
};