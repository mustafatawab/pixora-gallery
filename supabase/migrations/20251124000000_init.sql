-- Phase 1: core schema, profile provisioning, indexes, and RLS.
-- Replaces the old scripts/01-create-tables.sql.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.image_visibility as enum ('public', 'private');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null,
  full_name   text,
  bio         text,
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

create unique index profiles_username_key on public.profiles (username);

create table public.images (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
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
  updated_at   timestamptz not null default now(),
  constraint images_title_length  check (char_length(title) between 1 and 200),
  constraint images_tags_limit    check (cardinality(tags) <= 10),
  constraint images_path_owner    check (storage_path like owner_id::text || '/%')
);

-- Feed pagination (partial index keeps the common query small).
create index images_public_feed_idx on public.images (created_at desc) where visibility = 'public';
-- Owner dashboards.
create index images_owner_idx on public.images (owner_id, created_at desc);
-- Tag filtering (optional in v1, cheap to add now).
create index images_tags_idx on public.images using gin (tags);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger images_set_updated_at
  before update on public.images
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Provision a profile for every new auth user (atomic with signup)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(
      nullif(lower(new.raw_user_meta_data->>'username'), ''),
      'user_' || left(new.id::text, 8)
    ),
    nullif(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grants (RLS decides row visibility; grants decide table capability)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update on table public.profiles to authenticated;
grant select on table public.images to anon;
grant select, insert, update, delete on table public.images to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.images   enable row level security;

-- Profiles: public read, owner-only write. Creation happens in the trigger.
create policy "profiles are publicly readable"
  on public.profiles
  for select
  using (true);

create policy "users update own profile"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Images: public rows are visible to everyone; private rows only to the owner.
create policy "images readable when public or owned"
  on public.images
  for select
  using (visibility = 'public' or (select auth.uid()) = owner_id);

-- Ownership is derived from the session, never from the client. The path check
-- ensures a user cannot attach a row to someone else's Storage object.
create policy "users insert own images"
  on public.images
  for insert
  with check (
    (select auth.uid()) = owner_id
    and storage_path like (select auth.uid()::text) || '/%'
  );

create policy "users update own images"
  on public.images
  for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "users delete own images"
  on public.images
  for delete
  using ((select auth.uid()) = owner_id);
