-- Phase 5 hardening:
--   * public derivatives (thumbnails) so originals are never publicly signable
--   * server-side feed search + pagination with a total count
--   * a database-backed upload quota that cannot be bypassed by the client

-- ---------------------------------------------------------------------------
-- 1. Image derivatives
-- ---------------------------------------------------------------------------

alter table public.images
  add column thumbnail_path text;

-- Thumbnails live in the owner's folder next to the original. The suffix keeps
-- them distinguishable from originals and lets the Storage policy match only
-- derivatives for public reads.
alter table public.images
  add constraint images_thumbnail_path_owner
  check (
    thumbnail_path is null
    or (
      thumbnail_path like owner_id::text || '/%'
      and thumbnail_path like '%.thumb.%'
    )
  );

create unique index images_thumbnail_path_key
  on public.images (thumbnail_path)
  where thumbnail_path is not null;

-- Public visitors may read derivatives only. Originals stay owner-only, so
-- EXIF/GPS metadata in the original file is never exposed to anonymous users.
drop policy if exists "public image objects are readable" on storage.objects;
drop policy if exists "public image thumbnails are readable" on storage.objects;

create policy "public image thumbnails are readable"
  on storage.objects
  for select
  using (
    bucket_id = 'media'
    and exists (
      select 1
      from public.images i
      where i.thumbnail_path = storage.objects.name
        and i.visibility = 'public'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Public feed search + pagination
-- ---------------------------------------------------------------------------

-- Runs with invoker rights, so `images` RLS still applies to the caller. The
-- explicit `visibility = 'public'` filter keeps the feed public even for owners
-- who can see their own private rows.
create or replace function public.search_public_images(
  p_search text default '',
  p_category text default '',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  storage_path text,
  thumbnail_path text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  visibility public.image_visibility,
  category text,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz,
  owner_username text,
  owner_full_name text,
  owner_bio text,
  owner_avatar_path text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      i.id,
      i.owner_id,
      i.title,
      i.description,
      i.storage_path,
      i.thumbnail_path,
      i.mime_type,
      i.size_bytes,
      i.width,
      i.height,
      i.visibility,
      i.category,
      i.tags,
      i.created_at,
      i.updated_at,
      p.username as owner_username,
      p.full_name as owner_full_name,
      p.bio as owner_bio,
      p.avatar_path as owner_avatar_path
    from public.images i
    join public.profiles p on p.id = i.owner_id
    where i.visibility = 'public'
      and (coalesce(p_category, '') = '' or i.category = p_category)
      and (
        coalesce(p_search, '') = ''
        or i.title ilike '%' || p_search || '%'
        or coalesce(i.description, '') ilike '%' || p_search || '%'
        or array_to_string(i.tags, ' ') ilike '%' || p_search || '%'
        or p.username ilike '%' || p_search || '%'
        or coalesce(p.full_name, '') ilike '%' || p_search || '%'
      )
  )
  select
    filtered.*,
    count(*) over () as total_count
  from filtered
  order by filtered.created_at desc, filtered.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_public_images(text, text, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Upload quota
-- ---------------------------------------------------------------------------

create table public.upload_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index upload_events_user_created_idx
  on public.upload_events (user_id, created_at desc);

alter table public.upload_events enable row level security;

-- No policies: only the security-definer function below may read or write.
revoke all on table public.upload_events from anon, authenticated;

-- Hard-coded limits: the caller cannot pass its own quota. A rolling window
-- means a burst cannot reset on a clock boundary. The advisory lock serialises
-- concurrent uploads from the same user so the limit cannot be raced.
create or replace function public.consume_upload_quota()
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit constant integer := 30;
  v_window constant interval := interval '1 hour';
  v_used integer;
  v_oldest timestamptz;
begin
  if v_user is null then
    return query select false, 0, 0, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('upload_quota:' || v_user::text));

  -- Keep the table small without a separate job.
  delete from public.upload_events
  where user_id = v_user
    and created_at < now() - interval '7 days';

  select count(*), min(created_at)
    into v_used, v_oldest
  from public.upload_events
  where user_id = v_user
    and created_at >= now() - v_window;

  if v_used >= v_limit then
    return query select false, v_used, 0, coalesce(v_oldest, now()) + v_window;
    return;
  end if;

  insert into public.upload_events (user_id) values (v_user);

  return query
    select true, v_used + 1, v_limit - v_used - 1, coalesce(v_oldest, now()) + v_window;
end;
$$;

revoke all on function public.consume_upload_quota() from public, anon, authenticated;
grant execute on function public.consume_upload_quota() to authenticated;
