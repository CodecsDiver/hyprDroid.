-- Signal Home — real-time events with offline delivery.
--
-- Events are durable rows, not transient messages: a recipient who is offline
-- receives them (until expiry) the next time they connect. Properties:
--   * Idempotent      unique (sender_id, client_event_id); retries are safe.
--   * Server-stamped  created_at / expires_at are set by the server only.
--   * Expiring        expires_at is clamped; expired rows are invisible to RLS
--                     and removed by purge_expired_events().
--   * Consent-aware   mischief is rejected unless the recipient opted in.
--   * Rate-limited    60 events / minute / sender.
--   * Sanitised       payloads are rebuilt from validated fields only.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  client_event_id uuid not null,
  kind text not null check (kind in (
    'love_ping', 'heart_tap', 'hug', 'sticker', 'love_note',
    'note_placed', 'spell_cast', 'mischief', 'listening_invite'
  )),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 2048),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  seen_at timestamptz,
  unique (sender_id, client_event_id),
  check (sender_id <> recipient_id)
);
alter table public.events enable row level security;
create index events_inbox_idx on public.events (recipient_id, created_at) where seen_at is null;
create index events_expiry_idx on public.events (expires_at);

create policy events_select on public.events for select to authenticated
  using (
    private.is_member(household_id)
    and (recipient_id = auth.uid() or sender_id = auth.uid())
    and expires_at > now()
  );

revoke all on public.events from public, anon, authenticated;
grant select on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- Payload validation helpers
-- ---------------------------------------------------------------------------
create function private.payload_text(p jsonb, k text, max_len int, required boolean default false)
returns text language plpgsql immutable set search_path = '' as $$
declare v jsonb := p -> k;
begin
  if v is null or v = 'null'::jsonb then
    if required then raise exception 'invalid_payload' using errcode = 'P0001', hint = k; end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'string'
     or char_length(p ->> k) > max_len
     or (required and char_length(btrim(p ->> k)) = 0) then
    raise exception 'invalid_payload' using errcode = 'P0001', hint = k;
  end if;
  return p ->> k;
end $$;

create function private.payload_enum(p jsonb, k text, allowed text[], required boolean default true)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := private.payload_text(p, k, 64, required);
begin
  if v is not null and not (v = any (allowed)) then
    raise exception 'invalid_payload' using errcode = 'P0001', hint = k;
  end if;
  return v;
end $$;

create function private.mischief_effects() returns text[]
language sql immutable set search_path = '' as $$
  select array['confetti', 'sparkle_trail', 'tiny_ghost', 'peekaboo_cat', 'balloons',
               'shake_room', 'flip_room', 'invert_colors', 'fake_glitch'];
$$;

create function private.mischief_is_disruptive(p_effect text) returns boolean
language sql immutable set search_path = '' as $$
  select p_effect = any (array['shake_room', 'flip_room', 'invert_colors', 'fake_glitch']);
$$;

create function private.spell_effects() returns text[]
language sql immutable set search_path = '' as $$
  select array['sparkle_burst', 'petal_rain', 'moon_glow', 'starfall', 'heart_swirl', 'ember_drift'];
$$;

-- Returns a payload rebuilt from validated fields only (unknown keys dropped).
create function private.sanitize_event_payload(p_kind text, p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_color text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;

  case p_kind
    when 'love_ping' then
      return jsonb_strip_nulls(jsonb_build_object(
        'reaction', private.payload_enum(p, 'reaction',
          array['heart', 'kiss', 'hug', 'miss_you', 'thinking_of_you', 'comfort', 'goodnight', 'safe', 'custom']),
        'label', private.payload_text(p, 'label', 24),
        'emoji', private.payload_text(p, 'emoji', 16),
        'message', private.payload_text(p, 'message', 280),
        'animation', private.payload_enum(p, 'animation', array['float', 'burst', 'pulse', 'rain'], false)
      ));
    when 'heart_tap' then
      return '{}'::jsonb;
    when 'hug' then
      return jsonb_strip_nulls(jsonb_build_object('message', private.payload_text(p, 'message', 280)));
    when 'sticker' then
      if private.uuid_or_null(private.payload_text(p, 'sticker_id', 36, true)) is null then
        raise exception 'invalid_payload' using errcode = 'P0001', hint = 'sticker_id';
      end if;
      return jsonb_build_object('sticker_id', p ->> 'sticker_id');
    when 'love_note' then
      return jsonb_build_object(
        'body', private.payload_text(p, 'body', 500, true),
        'voice', private.payload_enum(p, 'voice', array['love', 'miss'])
      );
    when 'note_placed' then
      return jsonb_strip_nulls(jsonb_build_object(
        'object_id', private.payload_text(p, 'object_id', 63, true),
        'note_id', private.payload_text(p, 'note_id', 36, true),
        'open_when', private.payload_text(p, 'open_when', 60)
      ));
    when 'spell_cast' then
      v_color := private.payload_text(p, 'color', 7);
      if v_color is not null and v_color !~ '^#[0-9a-fA-F]{6}$' then
        raise exception 'invalid_payload' using errcode = 'P0001', hint = 'color';
      end if;
      return jsonb_strip_nulls(jsonb_build_object(
        'effect', private.payload_enum(p, 'effect', private.spell_effects()),
        'name', private.payload_text(p, 'name', 40, true),
        'color', v_color,
        'message', private.payload_text(p, 'message', 140)
      ));
    when 'mischief' then
      return jsonb_build_object('effect', private.payload_enum(p, 'effect', private.mischief_effects()));
    when 'listening_invite' then
      return jsonb_strip_nulls(jsonb_build_object('track_title', private.payload_text(p, 'track_title', 120)));
    else
      raise exception 'invalid_kind' using errcode = 'P0001';
  end case;
end $$;

create function private.event_default_ttl(p_kind text) returns integer
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'mischief' then 3600              -- 1 hour: stale pranks are pointless
    when 'listening_invite' then 3600
    when 'heart_tap' then 86400            -- 1 day
    when 'note_placed' then 2592000        -- 30 days
    when 'love_note' then 2592000
    else 604800                            -- 7 days
  end;
$$;

create function private.event_xp(p_kind text, p_payload jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'love_ping' then case when p_payload ->> 'reaction' in ('heart', 'kiss', 'hug', 'comfort') then 2 else 1 end
    when 'hug' then 2 when 'love_note' then 2 when 'spell_cast' then 2 when 'note_placed' then 2
    else 1
  end;
$$;

-- ---------------------------------------------------------------------------
-- Core emit (shared by send_event and other RPCs that must deliver atomically)
-- ---------------------------------------------------------------------------
create function private.emit_event(
  p_sender uuid, p_household uuid, p_recipient uuid, p_client_event_id uuid,
  p_kind text, p_payload jsonb, p_ttl_seconds integer default null
) returns public.events
language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.events;
  v_row public.events;
  v_payload jsonb;
  v_ttl integer;
  v_settings public.user_settings;
  v_xp integer;
  v_today date := (now() at time zone 'utc')::date;
begin
  select * into v_existing from public.events e
  where e.sender_id = p_sender and e.client_event_id = p_client_event_id;
  if found then return v_existing; end if;   -- idempotent replay: no side effects

  if (select count(*) from public.events e
      where e.sender_id = p_sender and e.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_payload := private.sanitize_event_payload(p_kind, p_payload);

  if p_kind = 'mischief' then
    select * into v_settings from public.user_settings s where s.user_id = p_recipient;
    if not found or not v_settings.allow_mischief
       or (private.mischief_is_disruptive(v_payload ->> 'effect') and not v_settings.allow_disruptive_mischief) then
      raise exception 'recipient_declined' using errcode = 'P0001';
    end if;
  end if;

  v_ttl := greatest(10, least(coalesce(p_ttl_seconds, private.event_default_ttl(p_kind)), 2592000));

  insert into public.events (household_id, sender_id, recipient_id, client_event_id, kind, payload, created_at, expires_at)
  values (p_household, p_sender, p_recipient, p_client_event_id, p_kind, v_payload, now(), now() + make_interval(secs => v_ttl))
  on conflict (sender_id, client_event_id) do nothing
  returning * into v_row;

  if v_row.id is null then  -- lost a race with a concurrent identical retry
    select * into v_row from public.events e where e.sender_id = p_sender and e.client_event_id = p_client_event_id;
    return v_row;
  end if;

  -- Bond XP: shared, server-maintained, capped per UTC day so it can't be farmed.
  v_xp := private.event_xp(p_kind, v_payload);
  update public.household_state hs set
    xp_day = v_today,
    xp_today = case when hs.xp_day = v_today then least(hs.xp_today + v_xp, 40) else least(v_xp, 40) end,
    bond_xp = hs.bond_xp + (
      case when hs.xp_day = v_today then least(v_xp, greatest(0, 40 - hs.xp_today)) else least(v_xp, 40) end
    ),
    updated_at = now()
  where hs.household_id = p_household;

  return v_row;
end $$;

create function public.send_event(
  p_client_event_id uuid, p_kind text, p_payload jsonb default '{}'::jsonb, p_ttl_seconds integer default null
) returns public.events
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_partner uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_client_event_id is null then raise exception 'invalid_payload' using errcode = 'P0001', hint = 'client_event_id'; end if;
  v_household := private.my_household();
  if v_household is null then raise exception 'not_in_household' using errcode = 'P0001'; end if;
  v_partner := private.partner_of(v_household, v_uid);
  if v_partner is null then raise exception 'no_partner' using errcode = 'P0001'; end if;
  if p_kind = 'note_placed' then   -- only place_note may emit this
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
  return private.emit_event(v_uid, v_household, v_partner, p_client_event_id, p_kind, p_payload, p_ttl_seconds);
end $$;

create function public.ack_events(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.events e set seen_at = now()
  where e.id = any (coalesce(p_ids, array[]::uuid[]))
    and e.recipient_id = auth.uid() and e.seen_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Cron / service role only.
create function public.purge_expired_events() returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_count bigint;
begin
  delete from public.events e where e.expires_at <= now() - interval '1 day';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.send_event(uuid, text, jsonb, integer), public.ack_events(uuid[]),
  public.purge_expired_events() from public, anon, authenticated;
grant execute on function public.send_event(uuid, text, jsonb, integer), public.ack_events(uuid[]) to authenticated;
grant execute on function public.purge_expired_events() to service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Schedule the purge when pg_cron is available (Supabase: enable the extension).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-expired-events', '17 * * * *', 'select public.purge_expired_events()');
  end if;
end $$;
