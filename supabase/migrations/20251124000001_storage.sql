-- Phase 1: private media bucket + Storage RLS.
-- Replaces the old scripts/02-create-storage-bucket.sql and the public
-- 'gallery-images' bucket. All access goes through signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owners can read their own objects (private signed URLs).
create policy "owners read own media"
  on storage.objects
  for select
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Anonymous visitors can read objects that back a public image, which is what
-- lets the server mint signed URLs for public images without a service-role key.
-- The referenced row is itself filtered by images RLS, so private paths leak
-- neither data nor access.
create policy "public image objects are readable"
  on storage.objects
  for select
  using (
    bucket_id = 'media'
    and exists (
      select 1
      from public.images i
      where i.storage_path = storage.objects.name
        and i.visibility = 'public'
    )
  );

create policy "owners upload own media"
  on storage.objects
  for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "owners update own media"
  on storage.objects
  for update
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "owners delete own media"
  on storage.objects
  for delete
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
