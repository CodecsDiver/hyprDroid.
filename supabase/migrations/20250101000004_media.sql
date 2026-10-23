-- Signal Home — Listening Together, Memory Vault, Love Universe, Time Capsule.
--
-- Binary media (songs, covers, photos, voice notes, stickers, originals) lives in
-- PRIVATE storage buckets (see 0005). Rows here store storage paths only.
-- Path contract for user uploads:  <household_id>/<owner_user_id>/<file>

-- ===========================================================================
-- Listening Together
-- ===========================================================================
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  artist text check (char_length(artist) <= 120),
  audio_path text not null check (char_length(audio_path) <= 300),
  cover_path text check (char_length(cover_path) <= 300),
  duration_ms integer check (duration_ms between 0 and 86400000),
  created_at timestamptz not null default now(),
  check (audio_path like household_id::text || '/' || owner_id::text || '/%'),
  check (cover_path is null or cover_path like household_id::text || '/' || owner_id::text || '/%')
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  cover_path text check (char_length(cover_path) <= 300),
  created_at timestamptz not null default now(),
  check (cover_path is null or cover_path like household_id::text || '/' || owner_id::text || '/%')
);

create table public.playlist_tracks (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  position integer not null check (position >= 0),
  primary key (playlist_id, track_id)
);

-- Opt-in to synchronised playback. Sync only operates while BOTH are opted in.
create table public.listening_consent (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  opted_in boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.listening_sessions (
  household_id uuid primary key references public.households (id) on delete cascade,
  host_id uuid references auth.users (id) on delete set null,
  track_id uuid references public.tracks (id) on delete set null,
  playlist_id uuid references public.playlists (id) on delete set null,
  state text not null default 'stopped' check (state in ('stopped', 'playing', 'paused')),
  position_ms integer not null default 0 check (position_ms >= 0),
  -- Server clock: clients compute live position as position_ms + (server_now - updated_at).
  updated_at timestamptz not null default now(),
  revision bigint not null default 0
);

alter table public.tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.listening_consent enable row level security;
alter table public.listening_sessions enable row level security;

create policy tracks_select on public.tracks for select to authenticated using (private.is_member(household_id));
create policy tracks_insert on public.tracks for insert to authenticated
  with check (private.is_member(household_id) and owner_id = auth.uid());
create policy tracks_update on public.tracks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and private.is_member(household_id));
create policy tracks_delete on public.tracks for delete to authenticated using (owner_id = auth.uid());

create policy playlists_select on public.playlists for select to authenticated using (private.is_member(household_id));
create policy playlists_insert on public.playlists for insert to authenticated
  with check (private.is_member(household_id) and owner_id = auth.uid());
create policy playlists_update on public.playlists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and private.is_member(household_id));
create policy playlists_delete on public.playlists for delete to authenticated using (owner_id = auth.uid());

-- Playlist membership: only the playlist owner edits it, and only with tracks of the same household.
create policy playlist_tracks_select on public.playlist_tracks for select to authenticated using (private.is_member(household_id));
create policy playlist_tracks_write on public.playlist_tracks for all to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()))
  with check (
    private.is_member(household_id)
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid() and p.household_id = playlist_tracks.household_id)
    and exists (select 1 from public.tracks t where t.id = track_id and t.household_id = playlist_tracks.household_id)
  );

create policy listening_consent_select on public.listening_consent for select to authenticated using (private.is_member(household_id));
create policy listening_sessions_select on public.listening_sessions for select to authenticated using (private.is_member(household_id));

revoke all on public.tracks, public.playlists, public.playlist_tracks, public.listening_consent, public.listening_sessions
  from public, anon, authenticated;
grant select, delete on public.tracks, public.playlists to authenticated;
grant insert (household_id, title, artist, audio_path, cover_path, duration_ms) on public.tracks to authenticated;
grant update (title, artist, cover_path) on public.tracks to authenticated;
grant insert (household_id, name, cover_path) on public.playlists to authenticated;
grant update (name, cover_path) on public.playlists to authenticated;
grant select, insert, update, delete on public.playlist_tracks to authenticated;
grant select on public.listening_consent, public.listening_sessions to authenticated;

create function public.listening_set_consent(p_opted_in boolean) returns public.listening_consent
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := private.my_household();
  v_row public.listening_consent;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_household is null then raise exception 'not_in_household' using errcode = 'P0001'; end if;

  insert into public.listening_consent (household_id, user_id, opted_in, updated_at)
  values (v_household, v_uid, coalesce(p_opted_in, false), now())
  on conflict (household_id, user_id) do update set opted_in = excluded.opted_in, updated_at = now()
  returning * into v_row;

  -- Either person opting out ends the shared session immediately.
  if not coalesce(p_opted_in, false) then
    update public.listening_sessions s
      set state = 'stopped', updated_at = now(), revision = s.revision + 1
      where s.household_id = v_household;
  end if;
  return v_row;
end $$;

create function public.listening_command(
  p_action text, p_track uuid default null, p_position_ms integer default 0, p_playlist uuid default null
) returns public.listening_sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := private.my_household();
  v_row public.listening_sessions;
  v_state text;
  v_position integer := greatest(0, coalesce(p_position_ms, 0));
  v_prev_track uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_household is null then raise exception 'not_in_household' using errcode = 'P0001'; end if;
  if p_action not in ('play', 'pause', 'seek', 'stop') then raise exception 'invalid_payload' using errcode = 'P0001', hint = 'action'; end if;

  if (select count(*) from public.listening_consent c where c.household_id = v_household and c.opted_in) < 2 then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  if p_track is not null and not exists (select 1 from public.tracks t where t.id = p_track and t.household_id = v_household) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_playlist is not null and not exists (select 1 from public.playlists p where p.id = p_playlist and p.household_id = v_household) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.listening_sessions (household_id, host_id, track_id, playlist_id, state, position_ms, updated_at, revision)
  values (v_household, v_uid, null, null, 'stopped', 0, now(), 0)
  on conflict (household_id) do nothing;

  select * into v_row from public.listening_sessions s where s.household_id = v_household for update;
  v_prev_track := v_row.track_id;
  v_state := case p_action when 'play' then 'playing' when 'pause' then 'paused' when 'stop' then 'stopped' else v_row.state end;

  update public.listening_sessions s set
    host_id = v_uid,
    track_id = coalesce(p_track, s.track_id),
    playlist_id = case when p_track is not null then p_playlist else s.playlist_id end,
    state = v_state,
    position_ms = case when p_action = 'stop' then 0 else v_position end,
    updated_at = now(),
    revision = s.revision + 1
  where s.household_id = v_household
  returning * into v_row;

  if p_action = 'play' and p_track is not null and p_track is distinct from v_prev_track then
    perform private.emit_event(
      v_uid, v_household, private.partner_of(v_household, v_uid), gen_random_uuid(), 'listening_invite',
      jsonb_build_object('track_title', (select t.title from public.tracks t where t.id = p_track)));
  end if;
  return v_row;
end $$;

-- ===========================================================================
-- Memory Vault
-- ===========================================================================
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('photo', 'voice', 'note', 'milestone')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text check (char_length(body) <= 5000),
  storage_path text check (char_length(storage_path) <= 300),
  mime_type text check (mime_type ~ '^(image|audio)/[a-z0-9.+-]+$'),
  size_bytes integer check (size_bytes between 1 and 26214400),
  occurred_on date,
  -- 'private' memories are visible to their author only.
  visibility text not null default 'shared' check (visibility in ('shared', 'private')),
  created_at timestamptz not null default now(),
  check (kind not in ('photo', 'voice') or (storage_path is not null and mime_type is not null)),
  check (kind in ('photo', 'voice') or storage_path is null),
  check (kind not in ('note', 'milestone') or body is not null),
  check (storage_path is null or storage_path like household_id::text || '/' || author_id::text || '/%')
);
create index memories_household_idx on public.memories (household_id, created_at desc);
alter table public.memories enable row level security;

create policy memories_select on public.memories for select to authenticated
  using (private.is_member(household_id) and (visibility = 'shared' or author_id = auth.uid()));
create policy memories_insert on public.memories for insert to authenticated
  with check (private.is_member(household_id) and author_id = auth.uid());
create policy memories_update on public.memories for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and private.is_member(household_id));
create policy memories_delete on public.memories for delete to authenticated using (author_id = auth.uid());

revoke all on public.memories from public, anon, authenticated;
grant select, delete on public.memories to authenticated;
grant insert (household_id, kind, title, body, storage_path, mime_type, size_bytes, occurred_on, visibility)
  on public.memories to authenticated;
grant update (title, body, occurred_on, visibility) on public.memories to authenticated;

-- ===========================================================================
-- Love Universe: notes + stickers
-- ===========================================================================
create table public.love_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  voice text not null default 'love' check (voice in ('love', 'miss')),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index love_notes_household_idx on public.love_notes (household_id, voice);
alter table public.love_notes enable row level security;

create policy love_notes_select on public.love_notes for select to authenticated using (private.is_member(household_id));
create policy love_notes_insert on public.love_notes for insert to authenticated
  with check (private.is_member(household_id) and author_id = auth.uid());
create policy love_notes_update on public.love_notes for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and private.is_member(household_id));
create policy love_notes_delete on public.love_notes for delete to authenticated using (author_id = auth.uid());

revoke all on public.love_notes from public, anon, authenticated;
grant select, delete on public.love_notes to authenticated;
grant insert (household_id, voice, body) on public.love_notes to authenticated;
grant update (voice, body) on public.love_notes to authenticated;

-- A sticker is either a whole image or one cell of a sprite sheet.
create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 40),
  storage_path text not null check (char_length(storage_path) <= 300),
  sprite_cols smallint check (sprite_cols between 1 and 16),
  sprite_rows smallint check (sprite_rows between 1 and 16),
  sprite_index smallint check (sprite_index >= 0),
  created_at timestamptz not null default now(),
  check ((sprite_cols is null) = (sprite_rows is null) and (sprite_cols is null) = (sprite_index is null)),
  check (sprite_index is null or sprite_index < sprite_cols * sprite_rows),
  check (storage_path like household_id::text || '/' || owner_id::text || '/%')
);
alter table public.stickers enable row level security;

create policy stickers_select on public.stickers for select to authenticated using (private.is_member(household_id));
create policy stickers_insert on public.stickers for insert to authenticated
  with check (private.is_member(household_id) and owner_id = auth.uid());
create policy stickers_delete on public.stickers for delete to authenticated using (owner_id = auth.uid());

revoke all on public.stickers from public, anon, authenticated;
grant select, delete on public.stickers to authenticated;
grant insert (household_id, label, storage_path, sprite_cols, sprite_rows, sprite_index) on public.stickers to authenticated;

-- ===========================================================================
-- Time Capsule (immutable, written only by the service role)
-- ===========================================================================
create table public.time_capsule_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  content_type text not null default 'text/html' check (content_type = 'text/html'),
  archived_at timestamptz not null default now(),
  unique (household_id, slug)
);
alter table public.time_capsule_items enable row level security;
create policy time_capsule_select on public.time_capsule_items for select to authenticated using (private.is_member(household_id));
revoke all on public.time_capsule_items from public, anon, authenticated;
grant select on public.time_capsule_items to authenticated;

-- ===========================================================================
-- Privileges for RPCs
-- ===========================================================================
revoke execute on function public.listening_set_consent(boolean), public.listening_command(text, uuid, integer, uuid)
  from public, anon;
grant execute on function public.listening_set_consent(boolean), public.listening_command(text, uuid, integer, uuid)
  to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
