# Blasta SMS API (Wrapper)

A type-safe, fully-documented REST API wrapper for the Dmark Mobile Blasta v3 SMS gateway, built with Hono and OpenAPI.

The API issues auth tokens (`/get_token/`), sends SMS and checks delivery reports (`/send_sms/`, `/dlr/`), and keeps its own audit trail in a Postgres database.

- [Blasta SMS API (Wrapper)](#blasta-sms-api-wrapper)
  - [Features](#features)
  - [Stack](#stack)
  - [Setup](#setup)
  - [Environment Variables](#environment-variables)
  - [Database](#database)
  - [Testing](#testing)
  - [Running the API](#running-the-api)
  - [Endpoints](#endpoints)
  - [Logging](#logging)

## Features

- Issues Blasta auth tokens, sends SMS, and checks delivery reports
- Local audit records for every SMS sent
- Type-safe OpenAPI routes with interactive docs (Scalar)
- Structured request logging to console, files, and Postgres
- Test suite with vitest

## Stack

| Concern              | Tool                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| API framework        | [Hono](https://hono.dev/) + [@hono/node-server](https://hono.dev/docs/getting-started/nodejs)                       |
| OpenAPI / validation | [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) + [zod](https://zod.dev/)  |
| Docs UI              | [Scalar](https://scalar.com/#api-docs) / [@scalar/hono-api-reference](https://github.com/scalar/hono-api-reference) |    |
| Database             | [Drizzle ORM](https://orm.drizzle.team/docs/overview) + [Neon serverless](https://neon.tech/) (Postgres)            |
| Logging              | [pino](https://getpino.io/) / [hono-pino](https://www.npmjs.com/package/hono-pino)                                  |
| Testing              | [vitest](https://vitest.dev/)                                                                                       |

## Setup

Install dependencies:

```sh
pnpm install
```

Create the environment files:

```sh
cp .env.example .env
cp .env.example .env.test
```

Then set your real values in **both** files:

- `BLASTA_USERNAME`, `BLASTA_PASSWORD` — your Blasta account (used by `POST /v3/api/get_token/`)
- `DATABASE_URL` — your Postgres/Neon connection string

See [Environment Variables](#environment-variables) for the full list. Both files are git-ignored; the repo ships placeholders only — never commit real credentials.

## Environment Variables

All environment variables are validated at startup against a zod schema in `src/env.ts`. The application will not start if required variables are missing or invalid.

| Variable          | Required | Default                              | Description                                                                       |
| ----------------- | -------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `NODE_ENV`        | no       | `development`                        | Runtime environment. When set to `test`, `.env.test` is loaded instead of `.env`. |
| `PORT`            | no       | `9999`                               | Port the server binds to.                                                         |
| `LOG_LEVEL`       | yes      | —                                    | Pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`.  |
| `DATABASE_URL`    | yes      | —                                    | Postgres connection URL.                                                          |
| `BLASTA_USERNAME` | yes      | —                                    | Blasta account username.                                                          |
| `BLASTA_PASSWORD` | yes      | —                                    | Blasta account password.                                                          |
| `BLASTA_BASE_URL` | no       | `https://sms.dmarkmobile.com/v3/api` | Base URL of the Blasta v3 API that all traffic is proxied to.                     |

Example `.env`:

```sh
NODE_ENV=development
PORT=9999
LOG_LEVEL=debug
DATABASE_URL=postgresql://user:pass@localhost:5432/blastadb
BLASTA_USERNAME=your_username
BLASTA_PASSWORD=your_password
BLASTA_BASE_URL=https://sms.dmarkmobile.com/v3/api
```

## Database

The API uses Postgres via the [Neon serverless driver](https://neon.tech/docs/guides/neon-serverless-driver). Drizzle schema lives in `src/db/schema.ts`.

Apply the schema (run this once after Setup, and again whenever `src/db/schema.ts` changes):

```sh
pnpm drizzle-kit push
```

drizzle-kit connects using `DATABASE_URL` from the loaded environment (`.env` in development, `.env.test` when `NODE_ENV=test`). For migrations and browsing, see `pnpm drizzle-kit generate|migrate|studio`.

## Testing

Run the test suite:

```sh
pnpm test
```

- Tests run with `NODE_ENV=test`, so `src/env.ts` loads `.env.test` (not `.env`).
- Tests read credentials from `@/env` — do **not** hardcode secrets in test files.
- Test files live in `tests/` at the project root, e.g. `tests/blasta.test.ts`.
- A test app is created with `createTestApp` from `src/lib/create-app.ts` and requests are made with Hono's `testClient` helper.
- Handlers respond from local mock state, so no live Blasta account is needed. A reachable database (`DATABASE_URL` in `.env.test`) **is** required for `db-logger` and DLR-persistence tests.

## Running the API

Development server with hot reload:

```sh
pnpm dev
```

Build and run for production:

```sh
pnpm build
pnpm start
```


Interactive API documentation is available at `GET /docs` (or `GET /reference`) with Scalar, and the raw OpenAPI spec at `GET /doc`. Operations appear in registration order: `get_token`, then `send_sms`, then `dlr`.

## Endpoints

| Method | Path                 | Description                               | Writes to DB   |
| ------ | -------------------- | ----------------------------------------- | -------------- |
| `GET`  | `/`                  | API index / health info                   | no             |
| `GET`  | `/doc`               | OpenAPI 3.0 specification                 | no             |
| `GET`  | `/reference`         | Scalar interactive API docs               | no             |
| `POST` | `/v3/api/get_token/` | Issue an access token for Blasta creds    | `auth_tokens`  |
| `POST` | `/v3/api/send_sms/`  | Send an SMS via Blasta, record it locally | `sms_messages` |
| `POST` | `/v3/api/dlr/`       | Check delivery status of a message        | no             |

Request bodies for `POST` routes are validated with zod. `POST /v3/api/send_sms/` returns `400` with `{ msg_id, status_code: "400", description }` on validation failure.

> [!NOTE]
> **Windows PowerShell:** the `sh` blocks below use bash syntax — `\` line continuations are invalid in PowerShell, and `curl` is an alias for `Invoke-WebRequest`, which doesn't accept `-X`/`-H`/`-d`. Run the `powershell` blocks instead (they pipe the JSON body into `curl.exe`), or use Git Bash/WSL.

### Example: get a token

```sh
curl -X POST http://localhost:9999/v3/api/get_token/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

```powershell
'{
    "username": "your_username",
    "password": "your_password"
}' | curl.exe -X POST http://localhost:9999/v3/api/get_token/ -H "Content-Type: application/json" -d "@-"
```

### Example: send an SMS

```sh
curl -X POST http://localhost:9999/v3/api/send_sms/ \
  -H "Content-Type: application/json" \
  -d '{
    "msg": "Hello from Blasta!",
    "numbers": "+256770123456",
    "dlr_url": "https://example.com/dlr",
    "category": "Marketing"
  }'
```

```powershell
'{
    "msg": "Hello from Blasta!",
    "numbers": "+256770123456",
    "dlr_url": "https://example.com/dlr",
    "category": "Marketing"
}' | curl.exe -X POST http://localhost:9999/v3/api/send_sms/ -H "Content-Type: application/json" -d "@-"
```

### Example: check a delivery report

```sh
curl -X POST http://localhost:9999/v3/api/dlr/ \
  -H "Content-Type: application/json" \
  -d '{
    "msgId": "mock-msg-001"
  }'
```

```powershell
'{
    "msgId": "mock-msg-001"
}' | curl.exe -X POST http://localhost:9999/v3/api/dlr/ -H "Content-Type: application/json" -d "@-"
```

## Logging

Logging is handled by `hono-pino` (`src/middlewares/pino-logger.ts`); the level is set by `LOG_LEVEL` (`silent` disables it). Every request is also persisted to the `api_requests` table by `src/middlewares/db-logger.ts` (fail-silent: a DB error never affects the API response).
