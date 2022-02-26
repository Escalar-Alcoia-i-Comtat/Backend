const mariadb = require('mariadb');
const {log} = require("./logger");

const pool = mariadb.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    connectionLimit: process.env.MYSQL_CONN_LIMIT || 5,
});

module.exports = {
    /**
     * Does the same as [queryData] but makes multiple requests before closing the connection to the database.
     * @param {{table:string,fields:string[]|null,where:string[][]|null,limit:number|null}[]} queries All the queries to make
     * @return {Promise<any[]>} A list of the results of the requests.
     */
    queryMultiple: async (queries) => {
        let results = [];
        let conn;
        try {
            conn = await pool.getConnection();
            for (let i in queries) {
                const request = queries[i];
                const table = request.table;
                const fields = request.fields;
                const whereParams = request.where;
                const limit = request.limit;

                let wheres = [];
                if (whereParams != null)
                    for (let k in whereParams)
                        if (whereParams.hasOwnProperty(k)) {
                            const pair = whereParams[k];
                            const key = pair[0];
                            const operation = pair[1];
                            const value = pair[2];
                            wheres.push(`${key}${operation}${value}`);
                        }

                const fieldsToSelect = fields != null && fields.length > 0 ? fields.join(',') : '*';
                const whereParameter = wheres.length > 0 ? wheres.join(',') : '1';
                const limitParameter = limit != null ? ` LIMIT ${limit}` : '';

                const query = `SELECT ${fieldsToSelect} FROM escalaralcoiaicomtat.${table} WHERE ${whereParameter}${limitParameter}`;
                log("📝 SQL query: ", query);
                const queryResult = await conn.query(query);
                delete queryResult['meta'];
                results.push(queryResult);
            }
        } catch (err) {
            throw err;
        } finally {
            if (conn) await conn.end();
        }
        return results;
    },
    /**
     * Fetches data from the set table.
     * @param {string} table The table to select.
     * @param {string} fields The fields to select. Set to null to select all.
     * @return {Promise<any>} The result of the request.
     */
    queryData: async (table, ...fields) => {
        let conn, res;
        try {
            conn = await pool.getConnection();
            const query = `SELECT ${fields.length > 0 ? fields.join(',') : '*'} FROM escalaralcoiaicomtat.${table}`;
            log("📝 SQL query: ", query);
            res = await conn.query(query);
        } catch (err) {
            throw err;
        } finally {
            if (conn) await conn.end();
        }
        delete res['meta'];
        return res;
    },
    /**
     * Fetches data from the set table.
     * @param {string} table The table to select.
     * @param {string[][]} params The parameters to select, in pairs of column-value.
     * @param {string} fields The fields to select. Set to null to select all.
     * @return {Promise<any>} The result of the request.
     */
    queryWhere: async (table, params, ...fields) => {
        let conn, res;
        let wheres = [];
        for (let k in params)
            if (params.hasOwnProperty(k)) {
                const pair = params[k];
                wheres.push(`${pair[0]}='${pair[1]}'`);
            }
        try {
            conn = await pool.getConnection();
            const query = `SELECT ${fields.length > 0 ? fields.join(',') : '*'} FROM escalaralcoiaicomtat.${table} WHERE ${wheres.join(',')}`;
            log("📝 SQL query: " + query);
            res = await conn.query(query);
        } catch (err) {
            throw err;
        } finally {
            if (conn) await conn.end();
        }
        delete res['meta'];
        return res;
    },
    /**
     * Updates the data stored on a table
     * @param {string} table The table to update.
     * @param {[string,string]} selector A pair of strings which represent the column to use as selector, and the value
     * that it should have.
     * @param {{}} data Some pairs of strings that represent the column name and value to set.
     */
    update: async (table, selector, data) => {
        let conn, res;
        try {
            conn = await pool.getConnection();
            const updates = [];
            for (let e in Object.keys(data)) {
                const column = Object.keys(data)[e];
                updates.push(`${column}='${data[column]}'`);
            }
            const query = `UPDATE escalaralcoiaicomtat.${table} SET ${updates.join(', ')} WHERE ${selector[0]}='${selector[1]}'`;
            log("📝 SQL query: " + query);
            res = await conn.query(query);
        } catch (err) {
            throw err;
        } finally {
            if (conn) await conn.end();
        }
        delete res['meta'];
        return res;
    },
    /**
     * Inserts the given data into the set table.
     * @param {string} table The name of the table to insert to
     * @param {any[]} data The data to insert
     */
    addData: async (table, data) => {
        let conn, res;
        try {
            conn = await pool.getConnection();
            const values = [];
            for (let e in data)
                values.push('?');
            const query = `INSERT INTO escalaralcoiaicomtat.${table} value (${values.join(', ')})`;
            log("📝 SQL query: " + query);
            res = await conn.query(query, data);
        } catch (err) {
            throw err;
        } finally {
            if (conn) await conn.end();
        }
        delete res['meta'];
        return res;
    },
    /**
     * Inserts the given data into the set table.
     * @param {string} table The table where to insert the data.
     * @param {Object} data Dictionaries containing the column names and contents to insert.
     * @return {Promise<void>}
     */
    insert: async (table, data) => {
        const keys = [];
        const values = [];
        for (const k in Object.keys(data)) {
            const key = Object.keys(data)[k];
            const value = data[key];
            if (!keys.includes(key))
                keys.push(key);
            if (!values.includes(value))
                values.push(`'${value}'`);
        }
        let conn, res;
        try {
            conn = await pool.getConnection();
            const query = `INSERT INTO escalaralcoiaicomtat.${table} (${keys.join(', ')}) values (${values.join(', ')})`;
            log("📝 SQL query: " + query);
            res = await conn.query(query);
        } catch (err) {
            throw err;
        } finally {
            if (conn) await conn.end();
        }
        delete res['meta'];
        return res;
    }
};
