# Pixora — Auth + Image Visibility Implementation Plan

Status: Proposed
Scope: real authentication, authenticated uploads, public/private image visibility, Supabase Postgres + Storage.
Out of scope (later phases): client galleries with passwords/expiry, portfolios/custom domains, billing, analytics, AI tagging.

## Progress

- [x] **Phase 0 — Foundation**: Supabase CLI + local stack, `.env.example`, strict build/lint, v0 artifacts removed, package renamed.
- [x] **Phase 1 — Schema, storage, RLS**: migrations applied, trigger + RLS matrix, private `media` bucket, seed data, generated DB types, 14 policy tests passing.
- [x] **Phase 2 — Authentication**: SSR middleware/session refresh, register/login/logout, email-confirmation callback (PKCE + token_hash), `requireUser`/`requireProfile`, route guards, real navbar + profile identity, safe redirects, auth + browser tests passing.
- [x] **Phase 3 — Upload pipeline**: direct browser → private `media` bucket, server-verified metadata action, real owner gallery with signed previews, delete row + object, 24 h orphan cleanup cron, storage/validation/cleanup tests and upload E2E passing.
- [x] **Phase 4 — Visibility + feeds**: real public home feed with search/category filters, `/u/[username]` public profile, owner dashboard visibility toggles, signed previews for both feed and profile, RLS-isolated private rows, empty/loading/not-found states, feed RLS tests and feed E2E passing.
- [x] **Phase 5 — Hardening**: paginated feed via `search_public_images`, browser-generated WebP/JPEG thumbnails with public reads limited to derivatives, upload quota (30/hour) with cron cleanup, error boundaries, CSP/security headers, client-bundle secret scan, GitHub Actions CI, deployment checklist, expanded RLS/storage tests and all E2E suites passing. Lighthouse baseline on the local production build (home feed): performance 99, accessibility 100, best-practices 100, SEO 100.

Notes / deviations:
- The mock data layer (`lib/mock-data.ts`) has been removed. The home feed, owner dashboard, and public profiles all read Supabase.
- `/profile` remains the owner dashboard (tabs, settings, visibility controls, delete). `/u/[username]` is the public profile. The plan's "`/profile` redirects" idea was not adopted because the dashboard has owner-only actions that do not belong on the public page.
- The home feed is paginated at 24 rows per page. `search_public_images` (security invoker) filters on visibility, searches title/description/tags/owner, applies the category filter, and returns the total count in one query. The UI preserves `q` and `category` across pages.
- Public previews are browser-generated derivatives (`{uid}/{uuid}.thumb.webp`, JPEG fallback). Canvas re-encoding strips EXIF/GPS. The Storage policy only allows anonymous reads of `images.thumbnail_path`, so originals stay owner-only. Legacy rows without a thumbnail show "Preview unavailable" to visitors; the owner can still see the original.
- Uploads are limited to 30 per rolling hour by `consume_upload_quota` (security definer, hard-coded limit, advisory lock). The counter lives in `upload_events`; the daily cron removes events older than 7 days. The client cannot pass its own limit.
- Visibility toggling is a single owner-scoped `UPDATE`; it never moves or re-uploads the Storage object. The action revalidates `/`, `/profile`, and `/u/[username]`.
- Public profile reads rely on the same RLS policy as the feed: visitors receive only public rows, while the owner also receives private rows (marked with a Private badge).
- The browser uploads to `{uid}/{uuid}.{ext}` and then sends only `{id, mimeType, metadata}`. The action re-derives the path and owner from the session, verifies the object with `storage.list`, and inserts the row. It never accepts a client-supplied owner or path.
- Metadata insert failure triggers a compensating Storage delete. Delete removes the DB row first, then the object; if the object delete fails the row is already gone and the daily cron removes the orphan.
- `GET /api/cron/cleanup-orphans` requires `Authorization: Bearer $CRON_SECRET`; `vercel.json` schedules it daily. It needs `SUPABASE_SERVICE_ROLE_KEY` server-side and also prunes expired upload-quota events.
- Security headers and a CSP are set in `next.config.mjs` for every route. The CSP allows `'unsafe-inline'` for Next/Radix inline styles and scripts (nonce-based CSP is a future improvement), and HSTS is only sent when `VERCEL=1` or `ENABLE_HSTS=true`.
- `scripts/check-client-bundle.mjs` scans `.next/static` for service-role keys, `service_role` JWTs, cron secrets, private key material, and suspicious `NEXT_PUBLIC_*` names. `bun run verify` runs lint, tests, build, and the scan.
- `.github/workflows/ci.yml` boots local Supabase, resets/seeds, runs lint + all Vitest suites + build + secret scan, then starts the production server and runs all three browser smoke suites.
- Local email confirmations stay off for developer convenience (`enable_confirmations = false`); enable them in the hosted project. The callback route supports both PKCE `code` and `token_hash` links.
- The legacy JWT `ANON_KEY` / `SERVICE_ROLE_KEY` are used locally; the CLI also exposes new `PUBLISHABLE_KEY` / `SECRET_KEY`, but `@supabase/ssr` + our tests use the JWT keys.
- `20251124000002_backfill_profiles.sql` provisions profiles for auth users that predate the trigger, so existing hosted users are not locked out.
- Seeded image rows have no Storage objects (they exercise RLS only), so the owner profile shows "Preview unavailable" for them until they are deleted or replaced.


---

## 1. Product behavior (v1)

- **Anonymous visitors** can browse the public gallery and public profiles.
- **Registered users** can log in, upload images, manage their own images.
- **Only authenticated users can upload.** No anonymous upload endpoints.
- Every image has a **visibility** of `public` or `private`.
  - `public` — listed in the home feed and on the owner's public profile; anyone (anon or logged-in) can view.
  - `private` — visible **only to the owner**; unlisted everywhere else. It is not encrypted, it is access-controlled.
- Visibility can be **changed at any time** by the owner (public ⇄ private) without re-uploading the file.
- Default visibility on upload: **private** (privacy-safe default).
- Deleting an image removes both the DB row and the stored object.

> Assumption to confirm: anonymous users may view public images. If the product requires login-to-browse, only one RLS policy and one middleware rule change.

---

## 2. Key architecture decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Supabase Auth (email + password)** with `@supabase/ssr` cookie sessions | Already a dependency; no new auth vendor. |
| D2 | **Server Components for reads, Server Actions for writes** | No hand-rolled REST layer; type-safe, less code, no client API keys for mutations. |
| D3 | **One private Storage bucket (`media`)** + short-lived **signed URLs** | Visibility toggling is a single DB `UPDATE` — no copy/move between buckets. Privacy is enforced uniformly. |
| D4 | **Postgres is the source of truth** for visibility and ownership; Storage RLS mirrors it | Never trust client-supplied `owner_id` or `visibility`. |
| D5 | **Direct browser → Storage upload**, then Server Action for metadata | Avoids Next.js Server Action body limits (~1 MB default) and server memory spikes for 20 MB photos. |
| D6 | **Storage object path = `{user_id}/{image_uuid}.{ext}`** | Matches folder-based Storage RLS; makes ownership enforceable at the object level. |
| D7 | **DB role checks in three layers**: middleware (UX), page/action guards (correctness), RLS (security) | Defense in depth. Middleware is never the security boundary. |
| D8 | **`supabase/migrations/` via Supabase CLI** instead of loose `scripts/*.sql` | Reproducible schema, reviewable diffs, CI-friendly. |

### D3 trade-off (explicit)

Single private bucket means public image URLs are **signed** and expire (e.g. 24 h), so a copied image link stops working later; the app re-mints URLs on each render. Benefits: toggling visibility is atomic and cheap, one code path, no duplicated objects, no public bucket leak risk.

Alternative considered and rejected for v1: separate public/private buckets. Supabase Storage has no cross-bucket move/copy, so toggling would require downloading and re-uploading the file (or an S3-compatible worker). If stable public asset URLs become a hard requirement, migrate only *public* objects to a public bucket/CDN later — the DB schema already supports this by storing `storage_path` rather than a URL.

---

## 3. Target code architecture

```
app/
  layout.tsx                     # root shell (remove v0 badge)
  page.tsx                       # public gallery (Server Component)
  loading.tsx                    # real skeletons
  (auth)/
    login/page.tsx
    register/page.tsx
    auth/callback/route.ts       # code exchange for email confirmation
    auth/signout/route.ts        # or Server Action
  (app)/
    layout.tsx                   # authenticated shell (guards)
    upload/page.tsx
    profile/page.tsx             # redirect -> /u/{username}
    settings/page.tsx
  u/[username]/page.tsx          # public profile (owner sees private too)
actions/
  auth.ts                        # register, login, logout
  images.ts                      # create, updateVisibility, delete
lib/
  supabase/
    client.ts                    # browser (existing)
    server.ts                    # server (existing, canonical)
    middleware.ts                # session refresh helper
    admin.ts                     # service-role, `import "server-only"` (only if needed)
  auth/
    require-user.ts              # requireUser(), getOptionalUser()
    redirects.ts                 # safe `next` param validation
  services/
    images.ts                    # queries + signed URL minting
    profiles.ts
    storage.ts                   # path builder, delete, signed URLs
  validation/
    auth.ts                      # zod schemas
    image.ts
  types/
    database.ts                  # generated via Supabase CLI
    domain.ts                    # app-level types
components/
  auth/*                         # forms using react-hook-form + zod
  gallery/*                      # ImageCard, GalleryGrid, VisibilityBadge
  upload/*                       # UploadDropzone, UploadForm
middleware.ts                    # session refresh + route gating (UX only)
supabase/
  config.toml
  migrations/*.sql
.env.example
```

Conventions:
- `lib/supabase/server.ts` is the **only** way server code reaches the DB. No ad-hoc clients.
- Every server-only module starts with `import "server-only"`.
- Actions return a discriminated union: `{ ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string,string> }`.
- Zod schemas are shared between forms and actions.

---

## 4. Data model

Migration `0001_init.sql` (replaces `scripts/01-create-tables.sql`):

```sql
create extension if not exists citext;

create type public.image_visibility as enum ('public', 'private');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    citext not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  full_name   text,
  bio         text,
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.images (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  storage_path text not null unique,
  mime_type    text not null,
  size_bytes   bigint,
  width        int,
  height       int,
  visibility   public.image_visibility not null default 'private',
  category     text,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Feed pagination
create index images_public_feed_idx on public.images (created_at desc) where visibility = 'public';
-- Owner dashboards
create index images_owner_idx on public.images (owner_id, created_at desc);
-- Tag filtering (optional v1.5)
create index images_tags_idx on public.images using gin (tags);
```

Why these changes vs the existing schema:
- `user_id` → `owner_id` (clearer, avoids confusion with `auth.users`).
- `is_published` (boolean) → `visibility` (enum). A boolean conflates "draft" with "private"; an enum leaves room for `unlisted`/`draft` later.
- Adds `tags`, `category`, `mime_type`, `size_bytes`, `width`, `height` — all needed by the existing UI or useful for quotas/rendering.
- Stores `storage_path`, not `image_url` — signed URLs are minted at read time and must not be persisted.

### New-user trigger

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)),
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

Username uniqueness is enforced by the unique index. Pre-check availability with an RPC or a debounced server check; still catch the unique-violation race in the register action.

### RLS

```sql
alter table public.profiles enable row level security;
alter table public.images   enable row level security;

-- Profiles: public read, owner write
create policy "profiles are publicly readable"
  on public.profiles for select using (true);

create policy "users update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Images: public OR own
create policy "images readable when public or owned"
  on public.images for select
  using (visibility = 'public' or (select auth.uid()) = owner_id);

create policy "users insert own images"
  on public.images for insert
  with check (
    (select auth.uid()) = owner_id
    and storage_path like (select auth.uid())::text || '/%'
  );

create policy "users update own images"
  on public.images for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "users delete own images"
  on public.images for delete
  using ((select auth.uid()) = owner_id);
```

Notes:
- `(select auth.uid())` instead of `auth.uid()` lets Postgres treat it as an initplan — a real performance difference on large tables.
- The `storage_path` prefix check stops a user from inserting a row that points at someone else's object.
- No `insert` policy on `profiles`: the trigger (security definer) owns creation.

### Storage

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

-- Owner can read own objects (needed for private signed URLs)
create policy "owners read own media"
  on storage.objects for select
  using (bucket_id = 'media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Anyone can read objects that back a public image (needed for public signed URLs)
create policy "public image objects are readable"
  on storage.objects for select
  using (bucket_id = 'media' and exists (
    select 1 from public.images i
    where i.storage_path = storage.objects.name
      and i.visibility = 'public'
  ));

-- Owner-only writes, scoped to their folder
create policy "owners upload own media"
  on storage.objects for insert
  with check (bucket_id = 'media'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owners update own media"
  on storage.objects for update
  using (bucket_id = 'media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owners delete own media"
  on storage.objects for delete
  using (bucket_id = 'media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
```

The "public image objects are readable" policy is what lets an **anonymous** server client mint signed URLs for public images without ever using the service role. It references `public.images`, whose own RLS only exposes public rows to anon — so it cannot leak private paths.

---

## 5. Authentication flow

### Register
1. Form (`react-hook-form` + zod): email, password (min 8), confirm, username, full name.
2. Server Action `register`:
   - Validate with zod.
   - `supabase.auth.signUp({ email, password, options: { data: { username, full_name }, emailRedirectTo: `${origin}/auth/callback?next=/profile` } })`.
   - On `user already registered`, show a generic "check your email" message (anti-enumeration).
   - On unique-username violation from the trigger, surface a field error.
3. Email confirmation (recommended ON) → `/auth/callback?code=...` route handler → `exchangeCodeForSession(code)` → redirect to a safe `next` path.

### Login
- `signInWithPassword`. Generic error: "Invalid email or password."
- On success, redirect to validated `next` (default `/`). Reject absolute URLs and `//` to prevent open redirects.
- Rate limiting is handled by Supabase Auth; add a UI cooldown.

### Session + route protection
- `middleware.ts` runs on every request except static assets:
  - refresh cookies via `lib/supabase/middleware.ts` (`supabase.auth.getUser()`),
  - redirect unauthenticated users away from `/upload`, `/settings`, `/profile`,
  - redirect authenticated users away from `/login`, `/register`.
- `requireUser()` helper in every protected page/action (`redirect("/login?next=...")`). **RLS remains the real boundary.**
- Logout: Server Action `signOut()` → redirect `/`.

### Security notes
- Never use `getSession()` server-side; it trusts cookie contents. Use `getUser()`, which verifies with the Auth server.
- No service-role key in any `NEXT_PUBLIC_*` variable or client component.
- Auth callback and any route handler must validate `next` and origin.

---

## 6. Upload flow (direct-to-storage)

```
Browser                         Next.js                     Supabase
-------                         -------                     --------
1. pick file, validate type/size
3. create uuid -> path
   {uid}/{uuid}.jpg
4. storage.upload(path)  -------------------------------->  Storage RLS (owner folder)
5. server action createImage({ id, path, title, ... }) -->  validate + getUser()
                                                            insert images row (RLS)
6. revalidate('/'), router.refresh()
```

Details:
- Client-side checks are UX only: MIME allowlist (`jpeg/png/webp/avif`), size ≤ 50 MB. Server action re-validates metadata; object existence + size can be confirmed via `storage.list(uid)` or `storage.info`.
- The action derives `owner_id` from the session — **never** accepts it from the client.
- If metadata insert fails, the client calls `storage.remove([path])` in a `catch`. A periodic cleanup job (pg_cron or a Vercel cron) removes objects older than 24 h with no matching `images.storage_path`.
- Optional `width`/`height` captured client-side from `createImageBitmap` and passed as untrusted hints (used for layout only).
- Upload progress via `supabase.storage.upload` uses fetch (no progress events); either accept a spinner or switch to resumable uploads (TUS) in a later phase.

### Visibility toggle
- Plain DB update in `actions/images.ts` → `update({ visibility })`. RLS ensures only the owner can do it.
- No storage operation, no URL change (URLs are minted per render). This is the main payoff of D3.

### Delete
1. Server action verifies ownership (query or RLS update returning).
2. Delete DB row first → object immediately stops being listed/signable.
3. Remove the Storage object.
4. If step 3 fails, log it; the cleanup job handles the orphan. (Cross-system atomicity is impossible; choose the failure mode that fails closed.)

---

## 7. Read paths

### Home feed (`app/page.tsx` — Server Component)
```ts
const supabase = await createClient()
const { data: images } = await supabase
  .from("images")
  .select(`
    id, title, description, storage_path, category, tags, created_at,
    owner:profiles!images_owner_id_fkey ( username, full_name, avatar_path )
  `)
  .eq("visibility", "public")
  .order("created_at", { ascending: false })
  .range(offset, offset + PAGE_SIZE - 1)

const paths = images.map(i => i.storage_path)
const { data: signed } = await supabase.storage.from("media").createSignedUrls(paths, 60 * 60 * 24)
```
- `.eq("visibility","public")` lets Postgres use the partial index; RLS is still the safety net.
- Batch-sign URLs (one call), not one call per image.
- Search/category filtering can stay client-side for v1 (small page sizes) or move to `ilike`/`contains` queries + `pg_trgm` later.

### Profile (`/u/[username]`)
- Fetch profile; fetch images (RLS returns public + own automatically).
- Owner sees private items with a "Private" badge; visitors never receive those rows at all.
- Keep `/profile` as a redirect to `/u/{currentUsername}` for backward compatibility with the navbar.

### Signed URL strategy
| Image | Signer | Expiry |
|---|---|---|
| private (owner) | authenticated server client | 1 h |
| public | anonymous/authenticated server client via public policy | 24 h |

Set page cache TTL below the signing window (or render dynamically). Never persist signed URLs.

---

## 8. Validation & error UX

Zod schemas in `lib/validation`:

```ts
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),          // bcrypt limit
  confirmPassword: z.string(),
  username: z.string().regex(/^[a-z0-9_]{3,30}$/),
  fullName: z.string().min(1).max(80),
}).refine(d => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })

export const createImageSchema = z.object({
  id: z.string().uuid(),
  storagePath: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(40).optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  visibility: z.enum(["public", "private"]).default("private"),
})
```

- Map Supabase error codes to friendly messages; log raw errors server-side only.
- `sonner` toasts for action results; field errors inline.
- Disable submit while pending (`useTransition`); prevent double submits.

---

## 9. Config & tooling changes

- **Remove** `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` from `next.config.mjs`; add an ESLint config. Fix resulting type errors as part of Phase 0.
- If image optimization is re-enabled, add `images.remotePatterns` for `<project-ref>.supabase.co/storage/v1/object/sign/**`; otherwise keep `unoptimized`.
- `.env.example`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  # server-only, never NEXT_PUBLIC
  SUPABASE_SERVICE_ROLE_KEY=
  ```
- Supabase CLI: `supabase init`, `supabase start` (local stack), `supabase db push`; generate types with `supabase gen types typescript --local > lib/types/database.ts`.
- Add scripts: `"db:start"`, `"db:reset"`, `"db:types"`.
- Delete `styles/globals.css` (unused duplicate) and the v0 "Built with" badge in `app/layout.tsx`.
- Add `import "server-only"` to `lib/supabase/server.ts`, `admin.ts`, `services/*`.

---

## 10. Testing strategy

| Layer | Tool | Coverage |
|---|---|---|
| Validation | Vitest | zod schemas, path builder, safe-redirect |
| RLS | Vitest + local Supabase (`anon`, `userA`, `userB` clients) | anon sees public only; userB cannot see/update/delete userA private; userA sees own; cross-folder storage insert rejected |
| Actions | Vitest (integration against local stack) | register/login, createImage rejects spoofed owner/path, visibility toggle, delete |
| E2E | Playwright | register → confirm (local inbox) → login → upload private → owner sees it → toggle public → anon sees it → delete |
| Manual | — | signed URL expiry behavior, large file, invalid MIME |

RLS tests are non-negotiable: a passing UI test does not prove data isolation.

---

## 11. Phased delivery

**Phase 0 — Foundation (0.5 d)**
- Supabase CLI + local stack, `.env.example`, remove mock data imports, fix tsconfig/build strictness, delete v0 badge.
- Acceptance: `bun dev` runs against local Supabase; build passes with strict TS.

**Phase 1 — Schema, storage, RLS (1 d)**
- Migrations: enum, profiles, images, indexes, trigger, RLS, bucket + storage policies.
- Seed script with 2 users and sample data.
- Acceptance: RLS test matrix passes; bucket is private; cross-user access denied.

**Phase 2 — Authentication (1.5 d)**
- Middleware + `requireUser`, register/login/callback/logout, guarded routes, navbar reflects real session.
- Acceptance: full register → confirm → login → logout cycle; protected routes redirect; no open redirect.

**Phase 3 — Upload pipeline (1.5 d)**
- Direct-to-storage upload, metadata action, progress/error states, delete, orphan cleanup job.
- Acceptance: only logged-in users can upload; path is `{uid}/...`; RLS blocks foreign paths; delete removes both records.

**Phase 4 — Visibility + feeds (1 d)**
- Public home feed, `/u/[username]`, owner dashboard, visibility toggle, signed URLs, empty/loading states.
- Acceptance: private image absent for anon; appears instantly for owner; toggle reflects everywhere after refresh; public images viewable anonymously.

**Phase 5 — Hardening (1–2 d)**
- Pagination, thumbnails/derivatives, error boundaries, rate limits, EXIF/GPS stripping, headers/CSP, tests, CI, deploy checklist.
- Acceptance: E2E green; Lighthouse reasonable; no service-role leakage in client bundle.

Total: roughly **6–8 focused dev days** for a production-quality v1.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Forgetting RLS on a new table/policy | Migration checklist + RLS tests in CI; `alter table ... enable row level security` in every migration. |
| Signed URL expiry breaking shared links | 24 h public TTL, re-mint on render; documented migration path to public bucket/CDN for public assets. |
| Upload orphans / bill growth | Cleanup cron; per-user storage quota later. |
| Duplicate usernames at signup | Unique index + handle violation; optional availability RPC. |
| Client MIME spoofing | Allowlist at bucket level + magic-byte validation if abuse appears. |
| Service-role key leaking | Keep out of `NEXT_PUBLIC_*`; `server-only` imports; CI grep for key usage in client bundle. |
| Next Action body limit confusion | Direct-to-storage uploads (metadata-only actions). |
| Storage egress costs | Derivatives + caching; monitor; revisit CDN/R2 when full-res downloads ship. |

---

## 13. Open decisions (recommended defaults)

1. **Anonymous browsing of public images** — recommended: yes.
2. **Email confirmation** — recommended: on; local stack uses Inbucket.
3. **Signed URLs vs public bucket** — recommended: private bucket + signed URLs (D3); revisit when stable public links are required.
4. **URL shape for profiles** — recommended: `/u/{username}`; `/profile` redirects.
5. **Visibility values** — recommended: `public | private`; `draft`/`unlisted` added later if needed.
6. **Upload limits** — recommended: 50 MB/file, JPEG/PNG/WebP/AVIF, max 10 tags.
