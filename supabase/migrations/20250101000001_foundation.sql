-- Signal Home — foundation: households, membership, invites, settings, helpers.
--
-- Security model (read this before editing):
--   * Every table has RLS enabled. Clients never get blanket table privileges:
--     privileges are granted per table/column to `authenticated` only.
--   * Shared data is gated by `private.is_member(household_id)`.
--   * Membership changes happen only through SECURITY DEFINER RPCs.
--   * Functions use `set search_path = ''` and schema-qualify everything.
--   * Helpers live in the `private` schema, which PostgREST does not expose.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'friend'), '@', 1), 'friend'), 40)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Households (exactly two members, explicitly authorised)
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.households enable row level security;

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id) -- one household per person
);
alter table public.household_members enable row level security;

create function private.enforce_household_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.household_members m where m.household_id = new.household_id) >= 2 then
    raise exception 'household_full' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger household_capacity
  before insert on public.household_members
  for each row execute function private.enforce_household_capacity();

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_email text not null check (invited_email = lower(invited_email) and char_length(invited_email) between 3 and 254),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz
);
alter table public.household_invites enable row level security;
create unique index household_invites_token_hash_key on public.household_invites (token_hash);

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so policies can read membership
-- without recursing through household_members' own RLS)
-- ---------------------------------------------------------------------------
create function private.is_member(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household and m.user_id = auth.uid()
  );
$$;

create function private.my_household() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.household_id from public.household_members m where m.user_id = auth.uid() limit 1;
$$;

create function private.partner_of(p_household uuid, p_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.household_members m
  where m.household_id = p_household and m.user_id <> p_user limit 1;
$$;

create function private.uuid_or_null(p_text text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Per-user settings (notifications + consent switches)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  notify_love_pings boolean not null default true,
  notify_hidden_notes boolean not null default true,
  notify_mischief boolean not null default true,
  notify_listening_invites boolean not null default true,
  -- Consent: mischief is OFF until the recipient opts in; disruptive effects
  -- are a separate, second opt-in.
  allow_mischief boolean not null default false,
  allow_disruptive_mischief boolean not null default false,
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint check (quiet_hours_end between 0 and 23),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;

-- Shared, server-maintained household state (rose / bond growth).
create table public.household_state (
  household_id uuid primary key references public.households (id) on delete cascade,
  bond_xp integer not null default 0 check (bond_xp >= 0),
  xp_day date not null default (now() at time zone 'utc')::date,
  xp_today integer not null default 0 check (xp_today >= 0),
  updated_at timestamptz not null default now()
);
alter table public.household_state enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.household_members a
      join public.household_members b on b.household_id = a.household_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy households_select on public.households for select to authenticated
  using (private.is_member(id));
create policy households_update on public.households for update to authenticated
  using (private.is_member(id)) with check (private.is_member(id));

create policy members_select on public.household_members for select to authenticated
  using (private.is_member(household_id));

create policy invites_select on public.household_invites for select to authenticated
  using (private.is_member(household_id));

create policy settings_select on public.user_settings for select to authenticated
  using (user_id = auth.uid());
create policy settings_update on public.user_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy state_select on public.household_state for select to authenticated
  using (private.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Privileges (least privilege; Supabase default grants are revoked first)
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.households, public.household_members,
  public.household_invites, public.user_settings, public.household_state
  from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select on public.household_members to authenticated;
-- token_hash is never readable by clients.
grant select (id, household_id, invited_email, created_by, created_at, expires_at, accepted_by, accepted_at)
  on public.household_invites to authenticated;
grant select on public.user_settings to authenticated;
grant update (notify_love_pings, notify_hidden_notes, notify_mischief, notify_listening_invites,
              allow_mischief, allow_disruptive_mischief, quiet_hours_start, quiet_hours_end)
  on public.user_settings to authenticated;
grant select on public.household_state to authenticated;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger user_settings_touch before update on public.user_settings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function public.create_household(p_name text, p_display_name text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by) values (btrim(p_name), v_uid) returning id into v_household;
  insert into public.household_members (household_id, user_id) values (v_household, v_uid);
  insert into public.household_state (household_id) values (v_household);
  insert into public.user_settings (user_id, household_id) values (v_uid, v_household);

  if p_display_name is not null and char_length(btrim(p_display_name)) between 1 and 40 then
    update public.profiles set display_name = btrim(p_display_name) where id = v_uid;
  end if;
  return v_household;
end $$;

-- Returns the one-time invite token. Only its SHA-256 is stored.
create function public.invite_partner(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := private.my_household();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_household is null then raise exception 'not_in_household' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if (select count(*) from public.household_members m where m.household_id = v_household) >= 2 then
    raise exception 'household_full' using errcode = 'P0001';
  end if;

  delete from public.household_invites i where i.household_id = v_household and i.accepted_at is null;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.household_invites (household_id, invited_email, token_hash, created_by, expires_at)
  values (v_household, v_email, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_uid, now() + interval '7 days');
  return v_token;
end $$;

-- The signed-in account's verified email must equal the invited email.
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.household_invites;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if exists (select 1 from public.household_members m where m.user_id = v_uid) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  select * into v_invite from public.household_invites i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    and i.accepted_at is null and i.expires_at > now()
  for update;

  -- One generic error: do not reveal whether the token exists or the email differs.
  if not found or v_email = '' or v_invite.invited_email <> v_email then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id) values (v_invite.household_id, v_uid);
  insert into public.user_settings (user_id, household_id) values (v_uid, v_invite.household_id)
    on conflict (user_id) do nothing;
  update public.household_invites set accepted_by = v_uid, accepted_at = now() where id = v_invite.id;
  return v_invite.household_id;
end $$;

create function public.server_now() returns timestamptz
language sql stable security definer set search_path = '' as $$ select now(); $$;

revoke execute on function public.create_household(text, text), public.invite_partner(text),
  public.accept_invite(text), public.server_now() from public, anon;
grant execute on function public.create_household(text, text), public.invite_partner(text),
  public.accept_invite(text), public.server_now() to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
