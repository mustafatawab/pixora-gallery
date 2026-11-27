# Pixora

Pixora is a photography gallery platform. Photographers sign up, upload their
work, and choose whether each image is **public** (shown in the shared feed and
on their public profile) or **private** (visible only to them). Visitors can
browse and search the public gallery without an account.

Built with Next.js 15 (App Router), Supabase (Auth, Postgres, Storage, RLS), and
Tailwind CSS.

## Features

- **Email/password auth** with server-side sessions, email confirmation, and
  route guards.
- **Direct-to-Storage uploads** — the browser uploads straight to Supabase
  Storage, then a Server Action verifies the object and writes metadata derived
  from the session.
- **Metadata-free previews** — the browser generates a bounded WebP (JPEG
  fallback) thumbnail with a canvas. Re-encoding strips EXIF/GPS, and anonymous
  visitors can only read the thumbnail, never the original.
- **Public feed** at `/` with search (title, description, tags, photographer),
  category filters, and pagination (24 per page).
- **Public profiles** at `/u/[username]`.
- **Owner dashboard** at `/profile` with public/private tabs, visibility
  toggles, deletion, and profile settings.
- **Private by default**, enforced by Postgres RLS and Storage policies.
- **Upload quota** of 30 per rolling hour, enforced in Postgres.
- **Hardening**: CSP and security headers, error boundaries, client-bundle
  secret scan, and a full GitHub Actions CI pipeline.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS, shadcn/ui, Radix |
| Backend | Supabase Postgres, Auth, Storage |
| Security | Row Level Security, private bucket, signed URLs |
| Tests | Vitest (unit/integration/RLS), Playwright (browser smoke) |
| Tooling | Bun, Supabase CLI, ESLint |

## Architecture at a glance

- `app/` — routes: feed, auth pages, upload, profile, public profiles, cron.
- `actions/` — Server Actions (image creation/deletion, profile updates).
- `lib/services/` — data access (feed pagination, signing preview URLs).
- `lib/supabase/` — browser, server, admin, and middleware clients.
- `supabase/migrations/` — schema, RLS, Storage policies, RPCs.
- `tests/` — RLS, auth, storage, and browser smoke suites.

Storage layout (private `media` bucket):

```
{user_id}/{image_uuid}.{ext}          # original (owner-only)
{user_id}/{image_uuid}.thumb.webp     # public derivative (JPEG fallback)
```

The feed is served by the `search_public_images` RPC; uploads are limited by the
`consume_upload_quota` RPC. Both are security-invoker/definer functions in SQL.

## Prerequisites

- [Bun](https://bun.sh) (1.2+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running (for
  the local Supabase stack)
- The Supabase CLI is installed as a dev dependency — always invoke it with
  `bunx supabase` or through the `bun run db:*` scripts
- Google Chrome (only for the browser smoke tests)

## First-time setup (local)

```bash
# 1. Install dependencies
bun install

# 2. Start the local Supabase stack (Postgres, Auth, Storage, Studio)
bun run db:start

# 3. Read the local keys
bunx supabase status -o env
```

Create `.env.local` from the example and fill it with the values from step 3:

```bash
cp .env.example .env.local
```

| `supabase status -o env` | `.env.local` variable |
|---|---|
| `API_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

Set `CRON_SECRET` to any dev string (for example `dev-cron-secret`). Then apply
the migrations and start the app:

```bash
bun run db:reset   # applies supabase/migrations/*.sql + seed.sql
bun run dev
```

Open:

- App — <http://localhost:3000>
- Supabase Studio — <http://127.0.0.1:54323>
- Mailpit (local email) — <http://127.0.0.1:54324>

### Seeded users

| Email | Password | Username |
|---|---|---|
| `demo1@example.com` | `password123` | `demo_one` |
| `demo2@example.com` | `password123` | `demo_two` |

Seed rows have no Storage objects, so their previews show "Preview unavailable".
Upload through the app to see real images.

## Environment variables

| Variable | Scope | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Yes | Local: `http://127.0.0.1:54321`. Cloud: `https://<ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Yes | Local: `ANON_KEY`. Cloud: publishable key (`sb_publishable_…`) or legacy anon JWT. Safe to expose. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes | Local: `SERVICE_ROLE_KEY`. Cloud: secret key (`sb_secret_…`) or legacy service-role JWT. Bypasses RLS — **never** prefix with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Server only | Yes | Protects `/api/cron/cleanup-orphans`. Generate with `openssl rand -hex 32`. |
| `ENABLE_HSTS` | Server only | No | Set `true` only on a non-Vercel HTTPS host. Vercel sets `VERCEL=1` automatically. |

### `.env` vs `.env.local`

Next.js loads `.env.local` **before** `.env`, so `.env.local` wins when both
exist. Both files are gitignored in this repo. Pick one file per environment and
keep it as the single source of truth.

Local example:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase status -o env`>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase status -o env`>
CRON_SECRET=dev-cron-secret
```

Cloud example:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
CRON_SECRET=<openssl rand -hex 32>
```

Never commit `.env` files and never paste real keys into chat, issues, or logs.
On Vercel, set these in **Project → Settings → Environment Variables**; `.env`
files are not uploaded.

## Using a hosted (cloud) Supabase project

The app can run against either the local stack or a hosted project. The CLI
defaults to **local** whenever a local config exists, so cloud commands use
`--remote`.

```bash
# 1. Authenticate the CLI (one time)
bunx supabase login

# 2. Link this repo to your project
bunx supabase link --project-ref <project-ref>

# 3. Apply migrations to the cloud database (does NOT seed)
bun run db:push:cloud

# 4. Point the app at the cloud project
#    Put the cloud values in .env or .env.local (see above), then:
bun run dev
```

Optional: regenerate TypeScript types from the linked project:

```bash
bun run db:types:cloud
```

### Auth configuration (required for cloud)

In Supabase → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` while developing against cloud, or your
  production domain.
- **Redirect URLs**: add `http://localhost:3000/auth/callback` and
  `https://your-domain.com/auth/callback`.
- Enable **email confirmations** for production and configure SMTP.

### Cloud safety rules

- **Never** run `bun run db:reset` against a cloud project — it drops the
  database.
- `bun run db:start`, `db:reset`, and `db:types` are local-only.
- `db:push:cloud` and `db:types:cloud` target the linked project.
- `supabase link` writes state to `supabase/.temp/`, which is gitignored.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Start the Next.js dev server |
| `bun run build` / `bun run start` | Production build / serve |
| `bun run lint` | ESLint via `next lint` |
| `bun run db:start` | Start the local Supabase stack |
| `bun run db:stop` | Stop the local Supabase stack |
| `bun run db:reset` | Recreate the local DB, apply migrations, seed |
| `bun run db:push:cloud` | Push migrations to the linked cloud project |
| `bun run db:types` | Regenerate types from the local DB |
| `bun run db:types:cloud` | Regenerate types from the linked cloud project |
| `bun run test` | All Vitest suites (needs local Supabase) |
| `bun run test:auth` / `test:rls` / `test:storage` | Targeted Vitest suites |
| `bun run test:e2e` | All browser smoke suites (needs a running app) |
| `bun run check:client-secrets` | Scan `.next/static` for server-only secrets |
| `bun run verify` | Lint + tests + build + secret scan |

## Testing

The Vitest suites talk to the **local** stack and ignore `.env` files — they
default to `http://127.0.0.1:54321`. Start and reset it first:

```bash
bun run db:start
bun run db:reset
bun run test
```

Browser smoke tests need the app running (in another terminal) and Chrome
installed:

```bash
bun run dev          # or: bun run build && bun run start
bun run test:e2e
```

The E2E suites create and delete their own users and Storage objects. They target
the local Supabase instance by default — **do not point them at your production
project**.

`bun run verify` is the pre-push check: lint, tests, production build, and the
client-bundle secret scan. CI runs the same plus all browser suites.

## Deploying to Vercel

1. Import the repo and set the environment variables listed above in the Vercel
   dashboard (Production + Preview).
2. Deploy. `vercel.json` schedules `/api/cron/cleanup-orphans` daily at 03:00
   UTC; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
3. Update the Supabase Auth **Site URL** and **Redirect URLs** to the deployed
   domain.
4. Verify the deployment:
   ```bash
   curl -sSI https://your-domain.com | sed -n '1,20p'
   ```
   Expect `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
   `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and
   `Strict-Transport-Security`.

The full production checklist is in [docs/deployment.md](docs/deployment.md).

## Project structure

```
app/                  Routes: feed, auth, upload, profile, /u/[username], cron
actions/              Server Actions
components/           UI (auth, gallery, profile, upload, ui primitives)
lib/
  auth/               Session helpers and safe redirects
  rate-limit/         Upload quota + cron cleanup helpers
  services/           Feed and preview data access
  storage/            Path rules, thumbnail generation, cleanup
  supabase/           Browser/server/admin/middleware clients
  types/              Generated database types
supabase/
  migrations/         Schema, RLS, Storage policies, RPCs
  seed.sql            Demo data
tests/                Vitest + Playwright smoke suites
scripts/              Client-bundle secret scan
docs/                 Setup, environments, deployment, implementation plan
```

## Security model

- **RLS is the boundary.** Every exposed table has row-level policies; server
  checks are defense in depth.
- **Private bucket.** Anonymous users can only read objects that match
  `images.thumbnail_path`. Originals stay owner-only.
- **Signed URLs.** Private previews use 1-hour links, public previews 24 hours;
  they are minted per render.
- **EXIF/GPS stripping.** Previews are re-encoded in the browser, so metadata
  never reaches public Storage.
- **Upload quota.** 30 uploads per rolling hour, enforced by a security-definer
  function with a hard-coded limit.
- **No server secrets in the browser.** CI scans `.next/static` for service-role
  keys, `service_role` JWTs, `CRON_SECRET`, and private key material.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Start Docker Desktop, then `bun run db:start`. |
| `db push` targets `127.0.0.1:54322` | Use `bun run db:push:cloud` (adds `--remote`). |
| App still uses localhost after editing `.env` | `.env.local` overrides `.env`; update or remove it. |
| `ERR_SSL_PROTOCOL_ERROR` on localhost | HSTS was enabled locally. Leave `ENABLE_HSTS` unset for HTTP. |
| "Preview unavailable" on seed data | Expected: seed rows have no Storage objects. Upload a real image. |
| E2E tests fail after switching to cloud | The suites target local Supabase; switch the app back to local for E2E. |
| `Missing Supabase environment variables` | `.env`/`.env.local` is incomplete — see the table above. |

## Further reading

- [docs/local-development.md](docs/local-development.md) — local workflow and
  policy tests
- [docs/environments.md](docs/environments.md) — local vs cloud configuration
- [docs/deployment.md](docs/deployment.md) — production checklist
- [docs/implementation-plan.md](docs/implementation-plan.md) — architecture and
  delivery plan
