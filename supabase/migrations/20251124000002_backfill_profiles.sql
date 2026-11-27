-- Backfill profiles for auth users created before the provisioning trigger existed
-- (for example, users that already exist in a hosted project when these
-- migrations are first applied).
--
-- New signups are handled by the on_auth_user_created trigger.

do $$
declare
  auth_user record;
  base_username text;
  candidate text;
  suffix_number int;
begin
  for auth_user in
    select u.id, u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    base_username := lower(
      regexp_replace(
        coalesce(
          nullif(auth_user.raw_user_meta_data->>'username', ''),
          'user_' || left(auth_user.id::text, 8)
        ),
        '[^a-z0-9_]',
        '',
        'g'
      )
    );

    if char_length(base_username) < 3 then
      base_username := 'user_' || left(auth_user.id::text, 8);
    end if;

    base_username := left(base_username, 30);
    candidate := base_username;
    suffix_number := 0;

    while exists (select 1 from public.profiles where username = candidate) loop
      suffix_number := suffix_number + 1;
      candidate :=
        left(base_username, 30 - char_length(suffix_number::text) - 1)
        || '_' || suffix_number;
    end loop;

    insert into public.profiles (id, username, full_name)
    values (
      auth_user.id,
      candidate,
      nullif(auth_user.raw_user_meta_data->>'full_name', '')
    );
  end loop;
end;
$$;
