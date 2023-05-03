/**
 * @typedef {Object} BlockingRow
 * @property {number} id The id of the blocking row.
 * @property {string} type The type of blocking.
 * @property {string} path The id of the path blocked.
 * @property {Date|null} end_date The date when the blocking ends, may be null if not established or applicable.
 */

/**
 * @typedef {Object} BlockingData
 * @property {number} id The id of the blocking row.
 * @property {string} path The id of the path.
 * @property {boolean} blocked Whether the path is blocked or not (may have expired).
 * @property {string} type The type of blocking.
 * @property {Date|null} endDate May be null if any or not applicable. The ending date of the blocking.
 */

/**
 * Processes blocking data fetched from the database.
 * @param {BlockingRow[]} data The data fetched from the server.
 * @return {BlockingData[]}
 */
export const processBlockingData = (data) => {
    /**
     * Stores all the blockages loaded from the DB
     * @type {BlockingData[]}
     */
    let blockages = [];

    const now = new Date(Date.now());

    for (const row of data) {
        if (!row.id) continue;
        /** @type {string} */
        const type = row['type'];
        /** @type {Date|null} */
        const endDate = row['end_date'];
        /** @type {string} */
        const path = row['path'];

        /** @type {BlockingData} */
        const data = endDate == null ?
            // If there's no end date, push the blocked path with null as endDate
            {id: row.id, path, blocked: true, type, endDate: null} :
            // If there's end date, push the blocked path, but replace "blocked" by true if the date has still not
            // passed, or false otherwise.
            {id: row.id, path, blocked: now.getTime() < endDate.getTime(), type, endDate};

        blockages.push(data);
    }

    return blockages;
};
