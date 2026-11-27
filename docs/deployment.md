# Deployment checklist

Use this when promoting Pixora from the local stack to a hosted Supabase project
and a Next.js host (Vercel is assumed for cron and HSTS, but the steps are
portable).

---

## 1. Supabase project

1. Create (or choose) the cloud project.
2. Link the CLI to it:
   ```bash
   bunx supabase link --project-ref <project-ref>
   ```
3. Push migrations and seed only if you want demo data:
   ```bash
   bunx supabase db push
   ```
   The migrations create:
   - `profiles` / `images` / `upload_events` with RLS.
   - the private `media` bucket and Storage policies.
   - `search_public_images` (feed pagination/search).
   - `consume_upload_quota` (30 uploads per rolling hour).
   - `images.thumbnail_path` and the public-thumbnail read policy.

   > Do **not** run `supabase db reset` against cloud.

4. **Auth → URL Configuration**
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`
   - Add the local equivalent only while testing against cloud.
   - Enable **email confirmations** for production.
   - Configure SMTP if you need reliable delivery.

5. **Storage**
   - Confirm the `media` bucket exists and is **private**.
   - Confirm anonymous reads are limited to thumbnails: the policy compares
     `storage.objects.name` to `images.thumbnail_path`, not `storage_path`.
   - Keep the 50 MB file-size limit and the image MIME allow-list.

---

## 2. Host environment variables

Set these in the host dashboard (never commit them):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key. Safe for the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used by the cleanup cron. **Never** prefix with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Random value, e.g. `openssl rand -hex 32`. |
| `ENABLE_HSTS` | Optional. Vercel sets `VERCEL=1`; set this to `true` on another HTTPS host. |

Rotate any key that was ever pasted into chat, logs, or a client bundle.

---

## 3. Deploy

1. Build locally against the production env once if you want to catch config
   errors:
   ```bash
   bun run build
   bun run check:client-secrets
   ```
2. Deploy the app (Vercel: connect the repo, set env vars, deploy).
3. Confirm `vercel.json` still schedules `/api/cron/cleanup-orphans` daily at
   03:00 UTC. On another host, schedule the same request yourself with
   `Authorization: Bearer $CRON_SECRET`.

---

## 4. Post-deploy verification

### Headers and CSP

```bash
curl -sSI https://your-domain.com | sed -n '1,25p'
```

Expect `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, and
`Strict-Transport-Security`. The CSP must include the Supabase origin in
`connect-src` and `img-src`.

### Auth

- Register a new user → confirmation email → callback → `/profile`.
- Log out and confirm `/upload` and `/profile` redirect to `/login?next=...`.
- Log in and confirm the redirect honors the safe `next` path.

### Uploads, thumbnails, and EXIF

- Upload a JPEG with GPS EXIF.
- In Supabase Storage, confirm two objects exist:
  `{uid}/{uuid}.jpg` and `{uid}/{uuid}.thumb.webp` (or `.thumb.jpg`).
- Confirm `images.thumbnail_path` is set.
- As an anonymous visitor, open the public profile/feed and confirm the preview
  loads.
- Try to mint a signed URL for the **original** as an anonymous user; it must
  fail. Only the thumbnail should be publicly signable.
- Toggle the image private and confirm it disappears from the anonymous feed
  and public profile.

### Feed pagination and search

- Publish more than 24 images (or use seed data) and confirm `/` shows
  `Page 1 of N` and the next/previous links preserve `q` and `category`.
- Search by title, tag, and photographer username.
- Confirm private images never appear for anonymous visitors.

### Upload quota

- Upload 30 images within an hour from one account; the 31st must be rejected
  with the friendly limit message.
- Confirm the rejected attempt did **not** leave a Storage object behind.
- Confirm the cron response includes `uploadEventsDeleted`.

### Cron

```bash
curl -i https://your-domain.com/api/cron/cleanup-orphans
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/cleanup-orphans
```

The first call must return `401`; the second returns a JSON summary. A missing
`CRON_SECRET` returns `503`.

### Secret scan

Run against the deployed build output in CI or locally:

```bash
bun run build
bun run check:client-secrets
```

It must report zero findings. The scan looks for the service-role key/value,
`service_role` JWTs, `CRON_SECRET`, private key material, and suspicious
`NEXT_PUBLIC_*` names.

---

## 5. Rollback and incident notes

- **Bad migration:** roll forward with a new migration; do not hand-edit the
  cloud schema. If you must restore, use a Supabase backup and re-run
  `supabase db push` after fixing the migration.
- **Leaked service-role key:** rotate it in Supabase → Project Settings → API,
  update the host env, redeploy, and re-run the cron once.
- **Leaked `CRON_SECRET`:** rotate it in the host env and redeploy. The old
  bearer token stops working immediately.
- **Public original exposure:** verify the Storage policy still matches
  `images.thumbnail_path`. If a public original was signed, make the bucket
  private again and rotate any affected URLs; signed URLs expire (24 h for
  public, 1 h for private previews).
- **CSP breakage:** check the browser console for blocked origins. Add the exact
  Supabase host to `connect-src`/`img-src` in `next.config.mjs`; avoid widening
  to `*`.

---

## 6. Ongoing checks

- CI (`.github/workflows/ci.yml`) runs lint, all Vitest suites, build, the secret
  scan, and the three browser smoke suites on every push/PR.
- Re-run the RLS suite after any new table, policy, or Storage change.
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of the client bundle; the scan is the
  guardrail, not a substitute for review.
- Revisit a nonce-based CSP when the app no longer depends on inline Next/Radix
  styles and scripts.
