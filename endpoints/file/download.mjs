import fs from "fs";

export default (req, res) => {
    const query = req.query;
    /**
     * @type {string|null}
     */
    let path = query.path;
    if (path == null)
        return res
            .status(400)
            .type("application/json")
            .send({'error': 'bad-request', 'message': 'Missing "path" parameter.'});
    path = `${process.env.FILES_PATH}/${path}`;
    if (!fs.existsSync(path))
        return res
            .status(406)
            .type("application/json")
            .send({'error': 'path-not-found', 'message': 'The path specified was not found'});
    const fileInfo = fs.lstatSync(path);
    if (fileInfo.isDirectory())
        return res
            .status(406)
            .type("application/json")
            .send({'error': 'path-not-file', 'message': 'The path must point to a file'});
    const imageFile = fs.readFileSync(path);
    const mime = path.endsWith('jpg') || path.endsWith('jpeg') ? 'image/jpeg' :
        path.endsWith('jpg') ? 'image/png' :
            path.endsWith('kmz') ? 'application/vnd.google-earth.kmz' :
                path.endsWith('kml') ? 'application/vnd.google-earth.kmz+xml' : 'text/plain';

    res.status(200).type(mime).send(imageFile);
};
