-- Signal Home — Mood Garden, Date Jar, Hidden Notes, Spell Table, reactions.

-- ===========================================================================
-- Mood Garden
-- ===========================================================================
create function private.mood_keys() returns text[]
language sql immutable set search_path = '' as $$
  select array['happy', 'calm', 'playful', 'cozy', 'missing', 'gentle', 'busy', 'sleepy', 'arriving', 'cuddly'];
$$;

create table public.moods (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  mood text not null check (mood = any (private.mood_keys())),
  note text check (char_length(note) <= 140),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  mood text not null check (mood = any (private.mood_keys())),
  created_at timestamptz not null default now()
);
create index mood_entries_household_idx on public.mood_entries (household_id, created_at desc);

create table public.garden_plants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  planted_by uuid not null references auth.users (id) on delete cascade,
  mood text not null check (mood = any (private.mood_keys())),
  planted_on date not null default (now() at time zone 'utc')::date,
  seed integer not null default floor(random() * 2147483647)::integer,
  water_count integer not null default 0 check (water_count >= 0),
  last_watered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, planted_by, planted_on)   -- one seed per person per day
);
create index garden_plants_household_idx on public.garden_plants (household_id, created_at desc);

create table public.garden_waterings (
  plant_id uuid not null references public.garden_plants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  watered_on date not null default (now() at time zone 'utc')::date,
  primary key (plant_id, user_id, watered_on)
);

alter table public.moods enable row level security;
alter table public.mood_entries enable row level security;
alter table public.garden_plants enable row level security;
alter table public.garden_waterings enable row level security;

create policy moods_select on public.moods for select to authenticated using (private.is_member(household_id));
create policy mood_entries_select on public.mood_entries for select to authenticated using (private.is_member(household_id));
create policy garden_plants_select on public.garden_plants for select to authenticated using (private.is_member(household_id));
create policy garden_waterings_select on public.garden_waterings for select to authenticated
  using (exists (select 1 from public.garden_plants p where p.id = plant_id and private.is_member(p.household_id)));

revoke all on public.moods, public.mood_entries, public.garden_plants, public.garden_waterings from public, anon, authenticated;
grant select on public.moods, public.mood_entries, public.garden_plants, public.garden_waterings to authenticated;

create function public.set_mood(p_mood text, p_note text default null) returns public.moods
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := private.my_household();
  v_row public.moods;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_household is null then raise exception 'not_in_household' using errcode = 'P0001'; end if;
  if p_mood is null or not (p_mood = any (private.mood_keys())) then raise exception 'invalid_mood' using errcode = 'P0001'; end if;
  if v_note is not null and char_length(v_note) > 140 then raise exception 'invalid_payload' using errcode = 'P0001', hint = 'note'; end if;

  insert into public.moods (household_id, user_id, mood, note, updated_at)
  values (v_household, v_uid, p_mood, v_note, now())
  on conflict (household_id, user_id) do update
    set mood = excluded.mood, note = excluded.note, updated_at = now()
  returning * into v_row;

  insert into public.mood_entries (household_id, user_id, mood) values (v_household, v_uid, p_mood);

  -- First mood of the (UTC) day plants that day's seed.
  insert into public.garden_plants (household_id, planted_by, mood)
  values (v_household, v_uid, p_mood)
  on conflict (household_id, planted_by, planted_on) do nothing;

  return v_row;
end $$;

create function public.water_plant(p_plant uuid) returns public.garden_plants
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_plant public.garden_plants;
  v_inserted integer;
begin
  select * into v_plant from public.garden_plants p where p.id = p_plant;
  if not found or not private.is_member(v_plant.household_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.garden_waterings (plant_id, user_id) values (p_plant, v_uid) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.garden_plants p set water_count = p.water_count + 1, last_watered_at = now()
    where p.id = p_plant returning * into v_plant;
  end if;
  return v_plant;
end $$;

-- ===========================================================================
-- Date Jar
-- ===========================================================================
create table public.date_ideas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (char_length(notes) <= 500),
  category text not null default 'anything'
    check (category in ('anything', 'at_home', 'outdoors', 'food', 'creative', 'adventure', 'cozy')),
  is_favorite boolean not null default false,
  completed_at timestamptz,
  completed_note text check (char_length(completed_note) <= 500),
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now()
);
create index date_ideas_household_idx on public.date_ideas (household_id, created_at desc);
alter table public.date_ideas enable row level security;

create policy date_ideas_select on public.date_ideas for select to authenticated using (private.is_member(household_id));
create policy date_ideas_insert on public.date_ideas for insert to authenticated
  with check (private.is_member(household_id) and created_by = auth.uid());
create policy date_ideas_update on public.date_ideas for update to authenticated
  using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy date_ideas_delete on public.date_ideas for delete to authenticated
  using (private.is_member(household_id));

-- Completion time is server-stamped: any client value is replaced.
create function private.stamp_date_completion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.completed_at is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.completed_at := now();
  elsif old.completed_at is null then
    new.completed_at := now();
  else
    new.completed_at := old.completed_at;
  end if;
  return new;
end $$;
create trigger date_ideas_stamp before insert or update on public.date_ideas
  for each row execute function private.stamp_date_completion();

revoke all on public.date_ideas from public, anon, authenticated;
grant select, delete on public.date_ideas to authenticated;
grant insert (household_id, title, notes, category, is_favorite) on public.date_ideas to authenticated;
grant update (title, notes, category, is_favorite, completed_at, completed_note, rating) on public.date_ideas to authenticated;

-- ===========================================================================
-- Hidden Notes (private messages pinned to scene objects)
-- ===========================================================================
create table public.hidden_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  client_note_id uuid not null,
  object_id text not null check (object_id ~ '^[a-z][a-z0-9_]{1,62}$'),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  open_when text check (char_length(open_when) <= 60),
  reveal text not null default 'fade' check (reveal in ('none', 'fade', 'envelope', 'sparkle', 'spell')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (author_id, client_note_id),
  check (author_id <> recipient_id)
);
create index hidden_notes_inbox_idx on public.hidden_notes (recipient_id, object_id) where read_at is null;
alter table public.hidden_notes enable row level security;

create policy hidden_notes_select on public.hidden_notes for select to authenticated
  using (private.is_member(household_id) and (author_id = auth.uid() or recipient_id = auth.uid()));
create policy hidden_notes_delete on public.hidden_notes for delete to authenticated
  using (author_id = auth.uid());

revoke all on public.hidden_notes from public, anon, authenticated;
grant select, delete on public.hidden_notes to authenticated;

create function public.place_note(
  p_client_note_id uuid, p_object_id text, p_body text,
  p_open_when text default null, p_reveal text default 'fade'
) returns public.hidden_notes
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := private.my_household();
  v_partner uuid;
  v_row public.hidden_notes;
  v_open text := nullif(btrim(coalesce(p_open_when, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_household is null then raise exception 'not_in_household' using errcode = 'P0001'; end if;
  v_partner := private.partner_of(v_household, v_uid);
  if v_partner is null then raise exception 'no_partner' using errcode = 'P0001'; end if;
  if p_client_note_id is null or p_object_id is null or p_object_id !~ '^[a-z][a-z0-9_]{1,62}$'
     or p_body is null or char_length(btrim(p_body)) not between 1 and 2000
     or (v_open is not null and char_length(v_open) > 60)
     or coalesce(p_reveal, 'fade') not in ('none', 'fade', 'envelope', 'sparkle', 'spell') then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;

  insert into public.hidden_notes (household_id, author_id, recipient_id, client_note_id, object_id, body, open_when, reveal)
  values (v_household, v_uid, v_partner, p_client_note_id, p_object_id, btrim(p_body), v_open, coalesce(p_reveal, 'fade'))
  on conflict (author_id, client_note_id) do nothing
  returning * into v_row;

  if v_row.id is null then   -- idempotent replay
    select * into v_row from public.hidden_notes n where n.author_id = v_uid and n.client_note_id = p_client_note_id;
    return v_row;
  end if;

  -- Body is never copied into the event: the event only says "something is waiting".
  perform private.emit_event(v_uid, v_household, v_partner, p_client_note_id, 'note_placed',
    jsonb_build_object('object_id', p_object_id, 'note_id', v_row.id::text, 'open_when', v_open));
  return v_row;
end $$;

create function public.mark_note_read(p_note uuid) returns public.hidden_notes
language plpgsql security definer set search_path = '' as $$
declare v_row public.hidden_notes;
begin
  update public.hidden_notes n set read_at = coalesce(n.read_at, now())
  where n.id = p_note and n.recipient_id = auth.uid()
  returning * into v_row;
  if v_row.id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  return v_row;
end $$;

-- ===========================================================================
-- Vee's Spell Table + custom reactions
-- ===========================================================================
create table public.spell_recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  ingredients text[] not null default '{}'
    check (cardinality(ingredients) <= 8),
  effect text not null check (effect = any (private.spell_effects())),
  message text check (char_length(message) <= 140),
  color text not null default '#c9a7ff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);
alter table public.spell_recipes enable row level security;

create function private.check_ingredients() returns trigger
language plpgsql set search_path = '' as $$
declare i text;
begin
  foreach i in array new.ingredients loop
    if char_length(btrim(i)) not between 1 and 30 then
      raise exception 'invalid_payload' using errcode = 'P0001', hint = 'ingredients';
    end if;
  end loop;
  return new;
end $$;
create trigger spell_recipes_ingredients before insert or update on public.spell_recipes
  for each row execute function private.check_ingredients();

create policy spell_recipes_select on public.spell_recipes for select to authenticated using (private.is_member(household_id));
create policy spell_recipes_insert on public.spell_recipes for insert to authenticated
  with check (private.is_member(household_id) and author_id = auth.uid());
create policy spell_recipes_update on public.spell_recipes for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and private.is_member(household_id));
create policy spell_recipes_delete on public.spell_recipes for delete to authenticated using (author_id = auth.uid());

revoke all on public.spell_recipes from public, anon, authenticated;
grant select, delete on public.spell_recipes to authenticated;
grant insert (household_id, name, ingredients, effect, message, color) on public.spell_recipes to authenticated;
grant update (name, ingredients, effect, message, color) on public.spell_recipes to authenticated;

create table public.reaction_presets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 24),
  emoji text not null check (char_length(emoji) between 1 and 16),
  animation text not null default 'float' check (animation in ('float', 'burst', 'pulse', 'rain')),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reaction_presets enable row level security;

create function private.limit_reaction_presets() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reaction_presets r where r.owner_id = new.owner_id) >= 24 then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger reaction_presets_limit before insert on public.reaction_presets
  for each row execute function private.limit_reaction_presets();

create policy reaction_presets_select on public.reaction_presets for select to authenticated using (private.is_member(household_id));
create policy reaction_presets_insert on public.reaction_presets for insert to authenticated
  with check (private.is_member(household_id) and owner_id = auth.uid());
create policy reaction_presets_update on public.reaction_presets for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and private.is_member(household_id));
create policy reaction_presets_delete on public.reaction_presets for delete to authenticated using (owner_id = auth.uid());

revoke all on public.reaction_presets from public, anon, authenticated;
grant select, delete on public.reaction_presets to authenticated;
grant insert (household_id, label, emoji, animation, sort_order) on public.reaction_presets to authenticated;
grant update (label, emoji, animation, sort_order) on public.reaction_presets to authenticated;

-- ===========================================================================
-- Privileges for RPCs
-- ===========================================================================
revoke execute on function public.set_mood(text, text), public.water_plant(uuid),
  public.place_note(uuid, text, text, text, text), public.mark_note_read(uuid) from public, anon;
grant execute on function public.set_mood(text, text), public.water_plant(uuid),
  public.place_note(uuid, text, text, text, text), public.mark_note_read(uuid) to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
