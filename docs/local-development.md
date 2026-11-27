# Local development

> Using a hosted Supabase project? See [environments.md](environments.md) for the
> local-vs-cloud key mapping and migration workflow.

## Prerequisites

- Bun
- Docker (running) for the local Supabase stack

## First run

```bash
bun install
bun run db:start          # boots Postgres, Auth, Storage, Studio (first run pulls images)
bunx supabase status -o env
```

Copy the values from the `status` output into `.env.local` (start from
`.env.example`):

| `status -o env` key | `.env.local` variable |
|---|---|
| `API_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

Then:

```bash
bun run db:reset          # applies supabase/migrations/*.sql and supabase/seed.sql
bun run dev
```

Studio: http://127.0.0.1:54323

## Seeded users

| Email | Password | Username |
|---|---|---|
| demo1@example.com | password123 | demo_one |
| demo2@example.com | password123 | demo_two |

The seed inserts image metadata only. Uploaded *objects* are created through the
app; the seeded rows intentionally have no file behind them, so their previews
show as unavailable. The home feed, owner dashboard, and `/u/[username]` public
profiles all read real Supabase rows.

## Visibility and feeds

| Surface | Who sees what |
|---|---|
| `/` | Public images only; search, category, and page are URL-driven (`?q=...&category=...&page=2`). |
| `/u/[username]` | Public images for visitors. The owner also sees their private images, marked with a Private badge. |
| `/profile` | Owner dashboard: public/private tabs, profile settings, delete, and make-public/make-private controls. |

Changing visibility updates one row and revalidates `/`, `/profile`, and the
owner's public profile. No Storage object is copied or moved. The feed shows 24
images per page and keeps the current search/category when paging.

## Upload flow

1. The browser validates type (JPEG/PNG/WebP/AVIF) and size (≤ 50 MB), creates a
   UUID, and generates a bounded WebP preview (JPEG fallback) with a canvas.
   Canvas re-encoding removes EXIF/GPS metadata.
2. The browser uploads the original to `{user_id}/{image_uuid}.{ext}` and the
   derivative to `{user_id}/{image_uuid}.thumb.webp` (or `.thumb.jpg`).
3. A Server Action consumes one upload-quota slot, verifies both objects exist
   in the signed-in user's folder, derives the owner and paths from the session,
   and inserts the metadata row.
4. If the metadata insert fails, both uploaded objects are removed. A daily
   cleanup job also removes any object older than 24 h that has no matching row
   (original or thumbnail).

Public reads are limited to `images.thumbnail_path`, so anonymous visitors never
receive a signed URL for the original file. The owner can still sign originals
for their own dashboard. Rows created before thumbnails existed have no
derivative, so visitors see "Preview unavailable" for them; the owner can still
see the original.

The browser never sends an owner id or Storage path to the server; both are
derived from the session and re-derived path. Storage RLS only allows writes
under `{auth.uid()}/`.

## Upload quota

`consume_upload_quota` allows 30 uploads per rolling hour per user. The counter
is stored in `upload_events`; the limit and window are hard-coded in SQL so the
client cannot raise them. The daily cron deletes quota events older than 7 days.
When the quota is exhausted, the upload form shows a friendly error and no
Storage object is written.

## Database workflow

```bash
bun run db:reset          # drop + re-apply migrations + seed
bunx supabase migration new <name>
bun run db:types          # regenerate lib/types/database.ts
```

## Policy tests

With the local stack running and reset:

```bash
bun run test:rls     # RLS + Storage policy matrix
bun run test:auth    # auth flow: signup/profile trigger, duplicate username, login/logout
bun run test:storage # path rules, image validation, orphan cleanup
bun run test         # all Vitest suites
```

`test:rls`, `test:auth` and `test:storage` default to the standard local keys;
override with `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
if your local stack uses different credentials.

## Browser smoke tests

With `bun run dev` running (and Chrome installed):

```bash
bun run test:e2e:auth    # register → logout → guarded login → confirmation callback
bun run test:e2e:upload  # register → private upload (original + thumbnail) → delete row + objects
bun run test:e2e:feed    # private upload → anon cannot see it → publish → anon sees the thumbnail → make private
```

All three tests create and delete their own users and Storage objects. Use
`bun run test:e2e` to run them sequentially.

## Orphan cleanup job

`GET /api/cron/cleanup-orphans` requires `Authorization: Bearer $CRON_SECRET`.
It scans the `media` bucket, ignores objects referenced by `images.storage_path`
or `images.thumbnail_path`, deletes unreferenced objects older than 24 hours, and
prunes upload-quota events older than 7 days. `vercel.json` schedules it daily at
03:00 UTC.

Run it manually against local:

```bash
# Add CRON_SECRET=dev-cron-secret to .env.local, restart `bun run dev`, then:
curl -i http://localhost:3000/api/cron/cleanup-orphans
curl -i -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/cleanup-orphans
```

The first call returns `401`; the second returns a JSON summary.

## Security headers and bundle scan

`next.config.mjs` applies a CSP plus `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, COOP/CORP, and (on HTTPS hosts) HSTS to
every route. The CSP allows the configured Supabase origin for API/Storage calls
and `blob:` URLs for local upload previews.

Check the headers:

```bash
curl -sSI http://localhost:3000 | sed -n '1,20p'
```

After a production build, scan the browser bundle for server-only secrets:

```bash
bun run build
bun run check:client-secrets
```

The scan fails on service-role keys/JWTs, `CRON_SECRET`, private key material,
and suspicious `NEXT_PUBLIC_*` names. `bun run verify` chains lint, tests, build,
and the scan.

## Production notes

- Enable **email confirmations** in the hosted project (locally they are off by
  default for convenience).
- Configure **Auth → URL Configuration** (Site URL + redirect allow-list) before
  enabling the `/auth/callback` flow in Phase 2.
- The `media` bucket is private. Anonymous reads are limited to
  `images.thumbnail_path`; never make the bucket public.
- Set `CRON_SECRET` in the host and keep `SUPABASE_SERVICE_ROLE_KEY` server-only;
  the cleanup route refuses to run without both.
- HSTS is sent automatically on Vercel (`VERCEL=1`). On another HTTPS host, set
  `ENABLE_HSTS=true`.
