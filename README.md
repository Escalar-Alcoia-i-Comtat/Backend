# Escalar Alcoià i Comtat - Backend

[![Docker Image Version (latest by date)][docker-version-badge]][docker-hub]

# Environment variables

You can set custom environment variables to personalize how the backend runs.

### `HTTP_PORT`

The port used by the HTTP server (without SSL).

**Default: `3000`**

### `HTTPS_PORT`

The port used by the HTTPS server (with SSL). Requires a certificate to be configured properly.

### `CORS_HOSTS`

You can add multiple hosts here, sepparated by `,`, and they will be considered exceptions for the CORS policy.

# Migration
## `1.0.7`
- Renamed endpoints. New names:
    - `/api/info/blocking/:pathId` -- `/v1/info/blocking/:pathId`
    - `/api/v2/info/blocking/:pathId` -- `/v2/blocking/:pathId`
    - `/api/list/:type` -- `/v1/list/:type`
    - `/api/list/:type/:parentId` -- `/v1/list/:type/:parentId`
    - `/api/data/:type/:objectId` -- `/v1/data/:type/:objectId`
    - `/api/files/checksum` -- `/v1/files/checksum`
    - `/api/files/download` -- `/v1/files/download`
    - `/api/updater` -- `/v1/updater`
    - `/api/info` -- `/v1/info`

[docker-version-badge]:https://img.shields.io/docker/v/arnyminerz/escalaralcoiaicomtat_backend

[docker-hub]: https://hub.docker.com/repository/docker/arnyminerz/escalaralcoiaicomtat_backend