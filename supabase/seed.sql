-- Local development seed: two confirmed users + sample image metadata.
--
-- Users (password for both: password123)
--   demo1@example.com  @demo_one
--   demo2@example.com  @demo_two
--
-- Image rows point at Storage paths. The objects themselves are uploaded via
-- the app (Phase 3); until then these rows exercise the read/RLS paths only.

-- ---------------------------------------------------------------------------
-- Auth users (trigger creates matching profiles)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated',
    'demo1@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"demo_one","full_name":"Demo One"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated',
    'demo2@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"demo_two","full_name":"Demo Two"}',
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values
  (
    gen_random_uuid(),
    '11111111-1111-4111-8111-111111111111',
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"demo1@example.com","email_verified":true}',
    'email', '11111111-1111-4111-8111-111111111111',
    now(), now(), now()
  ),
  (
    gen_random_uuid(),
    '22222222-2222-4222-8222-222222222222',
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"demo2@example.com","email_verified":true}',
    'email', '22222222-2222-4222-8222-222222222222',
    now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- ---------------------------------------------------------------------------
-- Sample image metadata
-- ---------------------------------------------------------------------------

insert into public.images (
  id, owner_id, title, description, storage_path, mime_type,
  size_bytes, width, height, visibility, category, tags
)
values
  (
    'aaaaaaaa-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'Mountain Sunrise',
    'Golden light over the peaks during an early morning hike.',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-1111-4111-8111-111111111111.jpg',
    'image/jpeg', 5242880, 4000, 6000, 'public', 'nature',
    array['nature', 'landscape', 'sunrise']
  ),
  (
    'aaaaaaaa-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'City Lights',
    'Neon reflections on wet streets after rain.',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-2222-4222-8222-222222222222.jpg',
    'image/jpeg', 4194304, 6000, 4000, 'public', 'street',
    array['street', 'night', 'urban']
  ),
  (
    'aaaaaaaa-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'Client Preview — The Johnsons',
    'Private client shortlist, not published.',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-3333-4333-8333-333333333333.jpg',
    'image/jpeg', 6291456, 6000, 4000, 'private', 'portrait',
    array['portrait', 'client', 'private']
  ),
  (
    'bbbbbbbb-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'Ocean Waves',
    'Long exposure at golden hour.',
    '22222222-2222-4222-8222-222222222222/bbbbbbbb-1111-4111-8111-111111111111.jpg',
    'image/jpeg', 4718592, 6000, 4000, 'public', 'nature',
    array['ocean', 'waves', 'seascape']
  )
on conflict (id) do nothing;
