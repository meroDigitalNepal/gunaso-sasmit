# Gunaso — Civic Feedback Platform

Gunaso is a civic feedback platform where citizens can submit questions and complaints to their **representative** — any elected official, government official, or their secretariat/office team — and that representative's team can process and respond to them. Citizens receive a tracking ID to follow up on a submission without needing an account.

## Stack

- **Frontend:** React 19 + Vite
- **UI:** [`@mero-nepal/ui`](https://www.npmjs.com/package/@mero-nepal/ui) — the shared Mero Digital Nepal design system. The client uses its components and the `safa` theme (Mero's crisp, Apple-inspired light tokens) so it stays visually consistent with the rest of the suite.
- **Auth:** Microsoft Entra ID (Azure AD) via MSAL — staff/admin sign-in only; citizens submit anonymously.
- **Backend:** Node.js + Express (deployed as a container or standalone).
- **Storage:** PostgreSQL with SQL migrations. A JSON-file store is retained for lightweight/local use.

## Architecture

- **Multi-tenant by deployment.** Each representative runs their own deployment. Tenant identity comes from the `MP_ID` env var set per deployment (`server/middleware/tenant.js`), not from the request host. _(The `MP_ID` identifier is historical and represents the representative/office tenant regardless of their title.)_
- **Role-based access.** Authenticated users carry a role (`staff` < `admin`); staff-only routes require a valid Entra token (`server/middleware/auth.js`).
- **Dual API paths.** The submissions router is mounted at both `/api/submissions` (local dev — Vite proxies to Express) and `/gunaso/api/submissions` (production, behind the `/gunaso` base path). In production the server also serves the built client from `/gunaso`.

## Getting Started

### Install dependencies
```bash
npm run install:all
```

### Run development servers
```bash
# In separate terminals:
npm run dev:server   # http://localhost:3001
npm run dev:client   # http://localhost:5173
```

### Run with Docker
Brings up the whole stack — Postgres, migrations, the Express server, **and**
the Vite client (with hot-reload) — in one command:
```bash
docker compose up --build
```
| Service | URL / port |
|---------|------------|
| Client (Vite) | http://localhost:5173 |
| Server (Express API) | http://localhost:3001 |
| Postgres | localhost:5432 |

The client source is bind-mounted, so edits hot-reload without a rebuild. In
dev the browser calls the API directly at `http://localhost:3001` (the server's
published port), so no proxy is involved. Set `ENTRA_*` and `MP_ID` in
`server/.env` (see the comments in `docker-compose.yml`).

> **Already run Postgres locally on 5432?** Add a `docker-compose.override.yml`
> to expose the container's DB on a free port instead — `!override` replaces the
> base port list rather than appending to it:
> ```yaml
> services:
>   db:
>     ports: !override
>       - "5433:5432"
> ```

### Database migrations
```bash
cd server && npm run migrate
```
Migrations live in `server/migrations/` (`001_initial_schema.sql`, `002_rename_to_mp.sql`).

### Run tests
```bash
npm test              # runs server tests
# or
cd server && npm test
```

## Environment Variables

### Server (`server/.env`)
| Variable | Description |
|----------|-------------|
| `MP_ID` | Tenant identity (the representative/office) for this deployment (required) |
| `MP_NAME` | Representative's display name, used to personalize confirmation emails |
| `DATABASE_URL` | Postgres connection string |
| `ENTRA_TENANT_ID` | Microsoft Entra tenant ID (token validation) |
| `ENTRA_CLIENT_ID` | Entra app/client ID (token audience) |
| `CORS_ORIGIN` | Allowed origin (e.g. `http://localhost:5173`) |
| `GRAPH_CLIENT_ID` | Graph mail app client ID (app-only, `Mail.Send`) — same for all Representative deployments |
| `GRAPH_CLIENT_SECRET` | Client secret for the Graph mail app |
| `MAIL_SENDER_ADDRESS` | Mailbox confirmation emails are sent from |
| `PUBLIC_APP_URL` | Canonical public URL used to build tracking links in emails — set per branch/deployment |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key, verifies the CAPTCHA on submission — same for all Representative deployments |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Storage connection string for the optional attachment upload — same for all Representative deployments |
| `AZURE_STORAGE_CONTAINER` | Blob container name for attachments (default `submission-attachments`) |
| `PORT` | Server port (default `3001`) |

Confirmation emails are sent via the Microsoft Graph API using app-only
(client-credentials) auth — a separate Azure AD app registration from
`ENTRA_CLIENT_ID`, granted the Graph **Application permission** `Mail.Send`
with admin consent. Recommend also scoping it to the sender mailbox with an
Exchange Online Application Access Policy, since `Mail.Send` is tenant-wide
by default. If the `GRAPH_*`/`MAIL_SENDER_ADDRESS`/`PUBLIC_APP_URL` vars are
unset, confirmation emails are simply skipped (logged as a warning).

`POST /api/submissions` is also rate limited (8 requests per IP per hour) and
requires a valid Cloudflare Turnstile CAPTCHA token. If `TURNSTILE_SECRET_KEY`
is unset, CAPTCHA verification is skipped (logged as a warning) — safe for
local dev. The mailer additionally has a circuit breaker: after 3 consecutive
send failures it stops attempting new sends for 60 seconds, then allows one
trial send before resuming normally — this protects the shared Graph mailbox
quota from being burned by a sustained outage or abuse burst.

Citizens may attach one optional file (JPG, PNG, WEBP, PDF, DOC, or DOCX, up
to 5MB) to a submission. Files are sniffed by their actual byte signature
(never trusted from the client-declared content type) and stored in Azure
Blob Storage, namespaced by `mp_id`/submission ID. If
`AZURE_STORAGE_CONNECTION_STRING` is unset, attachment uploads are skipped
(logged as a warning) — the submission itself still succeeds. Attachments are
staff-only: they're never included in the public tracking response, and
downloading one (`GET /api/submissions/:id/attachment`) requires staff auth.

### Client (`client/.env`, `VITE_`-prefixed)
| Variable | Description |
|----------|-------------|
| `VITE_ENTRA_CLIENT_ID` | Entra app/client ID |
| `VITE_ENTRA_AUTHORITY` | Entra authority URL |
| `VITE_ENTRA_API_SCOPE` | API scope requested for access tokens |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key, baked in at build time |

## API

All routes are mounted under both `/api/submissions` (dev) and `/gunaso/api/submissions` (prod).

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/submissions` | Public | Create a new submission (returns a tracking ID) |
| GET | `/api/submissions` | Staff | List submissions for the tenant |
| GET | `/api/submissions/:id` | Staff | Get a single submission |
| PATCH | `/api/submissions/:id` | Staff | Update status / add a response |
| GET | `/api/submissions/track/:trackingId` | Public | Citizen tracking lookup |

## Operations

Provisioning helpers live in `infra/`:

- `provision-shared.sh` — set up shared infrastructure
- `add-rep.sh` — onboard a new representative tenant/deployment
- `add-staff.sh` — grant a staff member access

Deploys run from each representative's own fork via `repository_dispatch`,
not from a branch in this repo. See [CONTRIBUTING.md](CONTRIBUTING.md) for
the fork setup and the full end-to-end onboarding runbook (which also covers
the companion `sachivalaya` repo's Cloudflare/DNS setup).

## Project Layout

```
client/   React + Vite frontend (pages, components, auth)
server/   Express API (routes, middleware, store, migrations)
infra/    Provisioning scripts
```
