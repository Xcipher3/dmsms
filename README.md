# Blasta SMS API (Wrapper)

A type-safe, fully-documented REST API wrapper for the Dmark Mobile Blasta v3 SMS gateway, built with Hono and OpenAPI.

The API proxies SMS operations (sending, delivery reports, auth tokens, opt-in/opt-out management) to the Blasta gateway while keeping its own audit trail in a Postgres database.

- [Blasta SMS API (Wrapper)](#blasta-sms-api-wrapper)
  - [Features](#features)
  - [Stack](#stack)
  - [Setup](#setup)
  - [Environment Variables](#environment-variables)
  - [Database](#database)
  - [Running the API](#running-the-api)
  - [Available Commands](#available-commands)
  - [Endpoints](#endpoints)
  - [Logging](#logging)
  - [Code Tour](#code-tour)
  - [Testing](#testing)

## Features

- Sends SMS through the Blasta v3 SMS gateway and checks delivery reports (`/send_sms/`, `/dlr/`)
- Local audit records for every SMS sent
- Fully documented type-safe routes with `@hono/zod-openapi`
- Interactive API docs served with Scalar
- Structured logging with pino / hono-pino
- Persistent request logs written to Postgres
- Type-safe environment variables with zod
- Database access with Drizzle ORM
- Test suite with vitest

## Stack

| Concern              | Tool                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| API framework        | [Hono](https://hono.dev/) + [@hono/node-server](https://hono.dev/docs/getting-started/nodejs)                                                 |
| OpenAPI / validation | [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) + [zod](https://zod.dev/)                            |
| Docs UI              | [Scalar](https://scalar.com/#api-docs) / [@scalar/hono-api-reference](https://github.com/scalar/scalar/tree/main/packages/hono-api-reference) |
| Helpers              | [stoker](https://www.npmjs.com/package/stoker)                                                                                                |
| Database             | [Drizzle ORM](https://orm.drizzle.team/docs/overview) + [Neon serverless](https://neon.tech/) (Postgres)                                      |
| Logging              | [pino](https://getpino.io/) / [hono-pino](https://www.npmjs.com/package/hono-pino)                                                            |
| Testing              | [vitest](https://vitest.dev/)                                                                                                                 |

## Setup

Install dependencies:

```sh
pnpm install
```

Create the environment file (see [Environment Variables](#environment-variables) for each option):

```sh
cp .env.example .env
```

Create the test environment file (used by the test suite):

```sh
cp .env.example .env.test
```

Push the database schema (see [Database](#database) for details):

```sh
pnpm drizzle-kit push
```

Run the API:

```sh
pnpm dev
```

## Environment Variables

All environment variables are validated at startup against a zod schema in `src/env.ts`. The application will not start if required variables are missing or invalid.

| Variable              | Required        | Default                              | Description                                                                       |
| --------------------- | --------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `NODE_ENV`            | no              | `development`                        | Runtime environment. When set to `test`, `.env.test` is loaded instead of `.env`. |
| `PORT`                | no              | `9999`                               | Port the server binds to.                                                         |
| `LOG_LEVEL`           | yes             | —                                    | Pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`.  |
| `DATABASE_URL`        | yes             | —                                    | Postgres connection URL.                                                          |
| `DATABASE_AUTH_TOKEN` | production only | —                                    | Neon auth token; required when `NODE_ENV=production`.                             |
| `BLASTA_USERNAME`     | yes             | —                                    | Blasta account username.                                                          |
| `BLASTA_PASSWORD`     | yes             | —                                    | Blasta account password.                                                          |
| `BLASTA_BASE_URL`     | no              | `https://sms.dmarkmobile.com/v3/api` | Base URL of the Blasta v3 API that all traffic is proxied to.                     |

Example `.env`:

```sh
NODE_ENV=development
PORT=9999
LOG_LEVEL=debug
DATABASE_URL=postgresql://user:pass@localhost:5432/blastadb
DATABASE_AUTH_TOKEN=
BLASTA_USERNAME=your_username
BLASTA_PASSWORD=your_password
BLASTA_BASE_URL=https://sms.dmarkmobile.com/v3/api
```

## Database

The API uses Postgres via the [Neon serverless driver](https://neon.tech/docs/guides/neon-serverless-driver). Drizzle schema lives in `src/db/schema.ts`.

Two tables are maintained locally:

| Table          | Purpose                                                                            | Written by                        |
| -------------- | ---------------------------------------------------------------------------------- | --------------------------------- |
| `sms_messages` | Audit trail of every SMS sent through the wrapper                                  | `POST /v3/api/send_sms/`          |
| `request_logs` | Every HTTP request: method, path, status, latency, IP, request + response payloads | All routes (db-logger middleware) |

Apply schema changes to the database:

```sh
pnpm drizzle-kit push
```

If schema changes are needed first, generate a migration:

```sh
pnpm drizzle-kit generate
```

Apply generated migrations:

```sh
pnpm drizzle-kit migrate
```

Open the interactive Drizzle Studio UI:

```sh
pnpm drizzle-kit studio
```

> Note: drizzle-kit connects using `DATABASE_URL` from the loaded environment (`.env` in development, `.env.test` when `NODE_ENV=test`).

## Running the API

Development server with hot reload:

```sh
pnpm dev
```

Build for production:

```sh
pnpm build
```

Run the production build:

```sh
pnpm start
```

The server prints its URL on boot:

```sh
Server is running on port http://localhost:9999
```

## Available Commands

| Command                                                             | What it does                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                                          | Starts the dev server with hot reload via `tsx watch`.          |
| `pnpm build`                                                        | Compiles TypeScript and resolves path aliases with `tsc-alias`. |
| `pnpm start`                                                        | Runs the compiled output from `./dist`.                         |
| `pnpm test`                                                         | Runs the vitest test suite with `NODE_ENV=test`.                |
| `pnpm typecheck`                                                    | Type-checks the project with `tsc --noEmit`.                    |
| `pnpm lint`                                                         | Lints the project with ESLint.                                  |
| `pnpm lint:fix`                                                     | Lints and auto-fixes issues.                                    |
| `pnpm drizzle-kit push`│ Pushes the Drizzle schema to the database. |
| `pnpm drizzle-kit generate`                                         | Generates SQL migrations from schema changes.                   |
| `pnpm drizzle-kit migrate`                                          | Applies generated migrations to the database.                   |
| `pnpm drizzle-kit studio`                                           | Opens Drizzle Studio UI to browse the database.                 |

## Endpoints

Interactive API documentation is available at `GET /reference` (Scalar) and the raw OpenAPI spec at `GET /doc`.

| Method | Path                | Description                               | Writes to DB   |
| ------ | ------------------- | ----------------------------------------- | -------------- |
| `GET`  | `/`                 | API index / health info                   | no             |
| `GET`  | `/doc`              | OpenAPI 3.0 specification                 | no             |
| `GET`  | `/reference`        | Scalar interactive API docs               | no             |
| `POST` | `/v3/api/send_sms/` | Send an SMS via Blasta, record it locally | `sms_messages` |
| `POST` | `/v3/api/dlr/`      | Check delivery status of a message        | no             |

Request bodies for `POST` routes are validated with zod. `POST /v3/api/send_sms/` returns `400` with `{ msg_id, status_code: "400", description }` on validation failure.

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

### Example: check a delivery report

```sh
curl -X POST http://localhost:9999/v3/api/dlr/ \
  -H "Content-Type: application/json" \
  -d '{
    "msgId": "mock-msg-001"
  }'
```

## Logging

Logging is handled by `hono-pino` (configured in `src/middlewares/pino-logger.ts`). Every incoming request is logged with a request ID.

- Log level is controlled by the `LOG_LEVEL` environment variable.
- Logs are human-readable (pretty-printed) during development and raw JSON in production.
- Every request is also written to JSON files in `logs/` by `src/middlewares/db-logger.ts`, one file per day (e.g. `logs/requests.2026-09-21.1.log`), rolled automatically by `pino-roll`. Each entry is timestamped by pino and includes the request ID, method, path, status, latency, request body and response body. The `logs/` directory is created on demand and is git-ignored.
- Set `LOG_LEVEL=silent` to disable logging entirely (both console and file).
- Every request is also persisted to the `request_logs` table by `src/middlewares/db-logger.ts`. The insert runs in the background after the response is produced and is fail-silent: a database error is logged via pino and never affects the API response. Each row stores the incoming request body and the outgoing response body (`request_body`, `response_body` as `jsonb`, `null` when a body is absent or not JSON).

Log levels in order: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.

## Code Tour

```text
src/
├── index.ts                  # Node server entry point (@hono/node-server)
├── app.ts                    # Base app: wires createApp + configureOpenAPI + all routes
├── env.ts                    # Zod-validated environment variables
├── db/
│   ├── index.ts              # Drizzle + Neon client
│   └── schema.ts             # Drizzle schema
├── lib/
│   ├── create-app.ts         # createApp / createRouter / createTestApp factories
│   ├── configure-open-api.ts # OpenAPI info + Scalar reference endpoint
│   ├── types.ts              # Shared OpenAPIHono types
│   ├── constants.ts          # Shared schema/reference constants
│   └── zod-utils.ts          # zod v4 typing helpers
├── middlewares/
│   ├── pino-logger.ts        # Request logging middleware
│   └── db-logger.ts          # Persists every request to the request_logs table
└── routes/
    ├── index.route.ts        # GET / index route
    ├── sms.index.ts          # Router assembling the SMS routes + handlers
    ├── sms.routes.ts         # OpenAPI route definitions
    └── sms.handlers.ts       # Hono request handlers (proxy + DB writes)
tests/
    ├── blasta.test.ts        # Route group tests
    └── db-logger.test.ts     # DB request-log persistence test
```

- Router/route definitions/handlers follow the split used in `src/routes/` (`sms.index.ts` + `sms.routes.ts` + `sms.handlers.ts`) — copy that pattern as a template for new route groups.
- All app routes are grouped and exported as `AppType` in `app.ts` for `hono/client` RPC type-safety.

## Testing

Run the test suite:

```sh
pnpm test
```

Tests run with `NODE_ENV=test`, so `src/env.ts` loads `.env.test` (not `.env`).

- Test files live in `tests/` at the project root, e.g. `tests/blasta.test.ts`.
- A test app is created with `createTestApp` from `src/lib/create-app.ts` and requests are made with Hono's `testClient` helper.
- Note: the route handlers proxy to the real Blasta gateway (`BLASTA_BASE_URL`), so tests that exercise handlers against the live API require valid sandbox credentials and a reachable database.

```

```
