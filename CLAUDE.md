# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gunaso is a civic feedback platform. Citizens submit questions/complaints to a **representative** (any elected/government official or their office) and receive a tracking ID to follow up without an account. The representative's staff process and respond via an authenticated dashboard.

## Commands

```bash
npm run install:all      # install both client and server deps

npm run dev:server       # Express on http://localhost:3001 (node --watch)
npm run dev:client       # Vite on http://localhost:5173

npm test                 # server tests (node --test); same as: cd server && npm test
cd server && node --test test/app.test.js      # run a single test file
cd client && npm run lint                       # eslint (client only; server has no lint)

cd server && npm run migrate    # apply pending SQL migrations
docker compose up               # Postgres + migrate + server (no client)
```

There is no client test suite and no root-level lint. `docker compose up` does **not** serve the client — run `dev:client` separately, or build the client into the server's `public/gunaso` for the production image.

## Architecture

**Multi-tenant by deployment, not by request.** Each representative runs their own deployment. Tenant identity comes from the `MP_ID` env var (`server/middleware/tenant.js`), which sets `req.mp` — it is never derived from the request Host/subdomain at runtime. The `mp`/`MP_ID` naming is historical ("member of parliament") and represents any representative/office tenant. Every store query is scoped by `mp_id`; `mp_id` is stripped from all API responses (`server/store/submissionsStore.js` → `toSubmission`).

**Dual API mount paths.** The submissions router is mounted at both `/api/submissions` (local dev — Vite proxies `/api` to Express) and `/gunaso/api/submissions` (production, behind the `/gunaso` base path). In production the same Express server also serves the built client from `/gunaso` (`server/index.js`). The client's `BASE`/`basename` switch on `import.meta.env.DEV` / `BASE_URL` (`/` in dev, `/gunaso/` in prod, set by `vite.config.js` `base`).

**Auth.** Staff/admin sign in with Microsoft Entra ID (Azure AD) via MSAL popup (client `src/auth/`). Citizens are always anonymous. `requireAuth` (`server/middleware/auth.js`) verifies the Entra JWT against the tenant's JWKS, looks the user up by `entra_oid` in the `users` table, and rejects if `user.mp_id !== req.mp.id`. `requireRole('staff'|'admin')` enforces a rank hierarchy (`staff` < `admin`) and must run after `requireAuth`. Public routes (POST create, GET track) skip auth entirely.

**Dependency injection everywhere.** `createApp(store, { resolveTenantMiddleware, mailer, submissionRateLimit, turnstileVerifier, blobStorage })` and `createSubmissionsRouter(...)` take all external dependencies as injectable params defaulting to real singletons. Tests (`server/test/app.test.js`) inject an in-memory store, no-op rate limit, always-allow Turnstile, and a fake blob storage — no real DB, network, or Azure needed. Follow this pattern when adding external integrations.

**Graceful degradation of optional integrations.** Confirmation email (Graph API), CAPTCHA (Turnstile), and attachment upload (Azure Blob) each no-op with a logged warning when their env vars are unset, and the submission still succeeds. When `blobStorage.uploadAttachment` returns `null` (unconfigured), attachment metadata is skipped rather than stored for a nonexistent file. Preserve this "optional integration → warn and continue, never fail the request" behavior.

**camelCase ↔ snake_case boundary.** `server/utils/caseConvert.js` (`toDb`/`fromDb`) converts between JS camelCase (API + app code) and Postgres snake_case columns. The store layer is the only place columns are named in snake_case.

## Data model

Three tables (`server/migrations/001_initial_schema.sql`): `mps` (tenants), `users` (staff, FK to `mps`, role check), `submissions` (FK to `mps`, indexed by `mp_id` + status/created_at). Submissions carry `status` (`new`/`in_review`/`resolved`), an optional `category` (made nullable in migration 004 — it's currently hidden from the UI but still validated when supplied), optional `contact_email` and `contact_phone` (`contact_phone` added in migration 005 — both citizen-supplied, nullable, and unvalidated), `public_response` (citizen-visible), and `internal_notes` (staff-only). Attachment columns were added in migration 003.

Migrations are plain `.sql` files in `server/migrations/`, applied in filename sort order by `migrate.js`, tracked in a `migrations` table. Add a new numbered file (next is `006_*.sql`); never edit an already-applied migration.

## Security-sensitive request ordering

`POST /submissions` middleware order is deliberate and must be preserved (`server/routes/submissions.js`):
1. Rate limit (8/IP/hour) → 2. resolve tenant → 3. **verify Turnstile CAPTCHA (token via `X-Turnstile-Token` header)** → 4. multer file parse → 5. handler.

CAPTCHA is checked **before** multer buffers any bytes, so an unauthenticated request can't force 5MB into memory first. Attachment type is sniffed from magic bytes (`file-type`), never trusted from the client-declared `mimetype`. Attachments are staff-only except via the citizen's own tracking ID. The mailer has a circuit breaker (3 failures → 60s pause) to protect the shared Graph mailbox quota.

## Deployment

Deploys run from each **representative's own fork**, not from a branch here. A fork push triggers `fork-notify-deploy.yml` → `repository_dispatch` → main repo's `azure-deploy.yml`, which pauses for a required-reviewer approval, then builds/migrates/updates the representative's Azure Container App. Onboarding a new representative spans three repos in order (`infra/add-rep.sh` here → fork setup → `sachivalaya` repo for DNS). Full runbook is in **CONTRIBUTING.md**. Provisioning helpers: `infra/{provision-shared,add-rep,add-staff}.sh`.

## Frontend UI

Uses `@mero-nepal/ui` (shared Mero Digital Nepal design system) with the `safa` theme — Mero's crisp, Apple-inspired light tokens. Keep new UI on `@mero-nepal/ui` components and the `safa` theme for cross-suite visual consistency; do not reintroduce `mdn-light`.
