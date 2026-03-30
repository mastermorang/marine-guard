# Marine Guard deployment

## Target architecture

- Cloudflare Pages: static frontend from `web/public`
- Node backend: API and Socket.IO server from `web/backend/server.js`
- Local field collector: serial reader from `web/collector/index.js`
- Database:
  - local development: SQLite
  - cloud deployment: PostgreSQL via `DATABASE_URL`

## 1. Backend deployment

Deploy the repository with root directory `web`.

Install command:

```bash
npm install
```

Start command:

```bash
npm run start:backend
```

Required environment variables:

- `FRONTEND_ORIGIN=https://your-project.pages.dev`
- `INGEST_TOKEN=strong-secret`

Optional environment variables:

- `DATABASE_URL=postgresql://...`
- `PGSSL=true`
- `PORT=3000`
- `SERVE_STATIC=false`

Health check:

```text
GET /api/health
```

## 2. Cloudflare Pages deployment

Project settings:

- Framework preset: `None`
- Root directory: `web/public`
- Build command: leave empty
- Output directory: leave empty

Before deploying, edit `web/public/config.js`:

```js
window.MARINE_GUARD_CONFIG = {
  apiBase: "https://your-backend.example.com",
  socketUrl: "https://your-backend.example.com",
  socketPath: "/socket.io"
};
```

## 3. Local collector deployment

Run on the Windows PC that is physically connected to the serial device.

From `web`:

```bash
npm install
npm run start:collector
```

Environment variables:

- `BACKEND_URL=https://your-backend.example.com`
- `INGEST_TOKEN=strong-secret`
- `COLLECTOR_LABEL=marine-guard-field-pc`

## 4. Local all-in-one development

Backend:

```bash
npm run start:backend
```

Collector:

```bash
npm run start:collector
```

Frontend for local testing:

- open `http://localhost:3000`

## Notes

- Cloudflare Pages alone cannot access USB serial hardware.
- The collector must keep running on the field PC for live telemetry.
- When `DATABASE_URL` is not set, backend data is stored in local SQLite and is not suitable for production failover.
