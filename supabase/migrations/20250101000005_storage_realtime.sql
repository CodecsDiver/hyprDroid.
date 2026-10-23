-- Signal Home — private storage buckets, storage RLS, realtime wiring.
--
-- Every bucket is PRIVATE. Clients read through short-lived signed URLs or
-- authenticated downloads; nothing here is ever served from a public URL.
--
-- Object path contract:  <household_id>/<owner_user_id>/<object>
--   read   : any member of <household_id> (vault: shared memories, or your own)
--   write  : only into your own <household_id>/<your user id>/ folder
--   delete : only your own objects
--   update : never (objects are immutable; upload a new object instead)
--   time-capsule: read-only for members; written with the service role only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('music',        'music',        false, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/flac']),
  ('covers',       'covers',       false, 5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('vault',        'vault',        false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav']),
  ('stickers',     'stickers',     false, 5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('time-capsule', 'time-capsule', false, 20971520, array['text/html'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy storage_read_household on storage.objects for select to authenticated
  using (
    bucket_id in ('music', 'covers', 'stickers', 'time-capsule')
    and private.is_member(private.uuid_or_null((storage.foldername(name))[1]))
  );

-- Vault: your own files, or files attached to a memory RLS lets you see (i.e. shared).
create policy storage_read_vault on storage.objects for select to authenticated
  using (
    bucket_id = 'vault'
    and private.is_member(private.uuid_or_null((storage.foldername(name))[1]))
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (select 1 from public.memories m where m.storage_path = storage.objects.name)
    )
  );

create policy storage_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id in ('music', 'covers', 'vault', 'stickers')
    and private.is_member(private.uuid_or_null((storage.foldername(name))[1]))
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy storage_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id in ('music', 'covers', 'vault', 'stickers')
    and (storage.foldername(name))[2] = auth.uid()::text
    and private.is_member(private.uuid_or_null((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------------------
-- Realtime: postgres_changes honours the RLS policies above.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'events', 'moods', 'garden_plants', 'hidden_notes', 'listening_sessions',
      'listening_consent', 'household_state', 'date_ideas', 'love_notes', 'stickers',
      'spell_recipes', 'memories', 'tracks', 'playlists'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Private realtime channels (broadcast + presence) for ephemeral sync such as
-- "both of us are tapping the heart right now". Topic: household:<household_id>
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy realtime_household_read on realtime.messages for select to authenticated
      using (
        realtime.topic() like 'household:%'
        and private.is_member(private.uuid_or_null(substr(realtime.topic(), 11)))
      )
    $p$;
    execute $p$
      create policy realtime_household_write on realtime.messages for insert to authenticated
      with check (
        realtime.topic() like 'household:%'
        and private.is_member(private.uuid_or_null(substr(realtime.topic(), 11)))
      )
    $p$;
  end if;
end $$;
