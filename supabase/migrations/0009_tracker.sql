-- Tracker engine: coach-assigned tracker configs, client-only drafts,
-- saved entries, assignment-owned milestones, RLS-scoped reads, and
-- RPC-only writes.
create extension if not exists pg_jsonschema with schema extensions;

create or replace function private.tracker_answer_matches_config(
  p_config jsonb,
  p_answer jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_type text := p_config ->> 'type';
  v_count integer;
  v_distinct_count integer;
  v_all_known boolean;
  v_min integer;
  v_max integer;
  v_max_length integer;
begin
  if p_config is null
    or p_answer is null
    or jsonb_typeof(p_answer) <> 'object'
    or p_answer ->> 'type' is distinct from v_type
  then
    return false;
  end if;

  case v_type
    when 'single_select' then
      if jsonb_typeof(p_answer -> 'optionId') <> 'string' then
        return false;
      end if;

      return exists (
        select 1
        from jsonb_array_elements(coalesce(p_config -> 'options', '[]'::jsonb)) opt
        where opt ->> 'id' = p_answer ->> 'optionId'
      );

    when 'multi_select' then
      if jsonb_typeof(p_answer -> 'optionIds') <> 'array' then
        return false;
      end if;

      v_min := coalesce((p_config ->> 'minSelections')::integer, 0);
      v_max := coalesce(
        (p_config ->> 'maxSelections')::integer,
        jsonb_array_length(coalesce(p_config -> 'options', '[]'::jsonb))
      );

      select
        count(*)::integer,
        count(distinct selected.value)::integer,
        coalesce(bool_and(option_match.value is not null), true)
      into v_count, v_distinct_count, v_all_known
      from jsonb_array_elements_text(p_answer -> 'optionIds') selected(value)
      left join lateral (
        select opt ->> 'id' as value
        from jsonb_array_elements(coalesce(p_config -> 'options', '[]'::jsonb)) opt
        where opt ->> 'id' = selected.value
        limit 1
      ) option_match on true;

      return v_count >= v_min
        and v_count <= v_max
        and v_count = v_distinct_count
        and v_all_known;

    when 'scale' then
      if jsonb_typeof(p_answer -> 'value') <> 'string' then
        return false;
      end if;

      return exists (
        select 1
        from jsonb_array_elements(coalesce(p_config -> 'options', '[]'::jsonb)) opt
        where opt ->> 'id' = p_answer ->> 'value'
      );

    when 'short_text', 'long_text' then
      if jsonb_typeof(p_answer -> 'value') <> 'string' then
        return false;
      end if;

      v_max_length := (p_config ->> 'maxLength')::integer;
      return v_max_length is null
        or length(p_answer ->> 'value') <= v_max_length;

    when 'boolean' then
      return jsonb_typeof(p_answer -> 'value') = 'boolean';

    else
      return false;
  end case;
end;
$$;

create table public.tracker_configs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tracker_config_versions (
  id uuid primary key default gen_random_uuid(),
  tracker_config_id uuid not null references public.tracker_configs (id) on delete cascade,
  version integer not null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  status text not null check (status in ('draft', 'published', 'retired')),
  is_active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tracker_config_id, version),
  constraint tracker_active_version_is_published check (not is_active or status = 'published')
);

create unique index tracker_one_active_version
  on public.tracker_config_versions (tracker_config_id)
  where is_active;

create table public.tracker_fields (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.tracker_config_versions (id) on delete cascade,
  field_key text not null,
  field_order integer not null check (field_order > 0),
  prompt text not null,
  answer_type text not null check (
    answer_type in ('single_select', 'multi_select', 'scale', 'short_text', 'long_text', 'boolean')
  ),
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, field_key),
  unique (version_id, field_order),
  constraint tracker_field_config_type_matches check ((config ->> 'type') = answer_type),
  constraint tracker_field_config_schema check (
    extensions.jsonb_matches_schema(
      '{
        "type": "object",
        "required": ["type", "label"],
        "properties": {
          "type": { "enum": ["single_select", "multi_select", "scale", "short_text", "long_text", "boolean"] },
          "label": { "type": "string", "minLength": 1 },
          "hint": { "type": "string" },
          "options": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "label"],
              "properties": {
                "id": { "type": "string", "minLength": 1 },
                "label": { "type": "string", "minLength": 1 }
              },
              "additionalProperties": false
            }
          },
          "minSelections": { "type": "integer", "minimum": 0 },
          "maxSelections": { "type": "integer", "minimum": 1 },
          "maxLength": { "type": "integer", "minimum": 1 },
          "placeholder": { "type": "string" }
        },
        "additionalProperties": false
      }'::json,
      config
    )
  )
);

create table public.tracker_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete restrict,
  version_id uuid not null references public.tracker_config_versions (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'ended')),
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint tracker_assignment_ended_has_timestamp check (status <> 'ended' or ended_at is not null)
);

create unique index tracker_one_active_assignment_per_client
  on public.tracker_assignments (client_id)
  where status = 'active';

create table public.tracker_entries (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.tracker_assignments (id) on delete cascade,
  field_id uuid not null references public.tracker_fields (id) on delete restrict,
  version_id uuid not null references public.tracker_config_versions (id) on delete restrict,
  field_key text not null,
  field_order integer not null,
  field_prompt text not null,
  answer_type text not null check (
    answer_type in ('single_select', 'multi_select', 'scale', 'short_text', 'long_text', 'boolean')
  ),
  field_config jsonb not null,
  answer jsonb not null,
  entry_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracker_entries_assignment_field_period_key unique (assignment_id, field_id, entry_date),
  constraint tracker_entries_answer_matches_field_config
    check (private.tracker_answer_matches_config(field_config, answer))
);

create table public.tracker_entry_drafts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.tracker_assignments (id) on delete cascade,
  field_id uuid not null references public.tracker_fields (id) on delete cascade,
  version_id uuid not null references public.tracker_config_versions (id) on delete cascade,
  field_key text not null,
  field_order integer not null,
  field_prompt text not null,
  answer_type text not null check (
    answer_type in ('single_select', 'multi_select', 'scale', 'short_text', 'long_text', 'boolean')
  ),
  field_config jsonb not null,
  answer jsonb not null,
  entry_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracker_entry_drafts_assignment_field_period_key unique (assignment_id, field_id, entry_date),
  constraint tracker_entry_drafts_answer_matches_field_config
    check (private.tracker_answer_matches_config(field_config, answer))
);

create table public.tracker_milestones (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.tracker_assignments (id) on delete cascade,
  milestone_order integer not null check (milestone_order > 0),
  label text not null,
  state text not null default 'up_next' check (state in ('done', 'now', 'up_next')),
  current_step_progress integer not null default 0 check (
    current_step_progress >= 0 and current_step_progress <= 100
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, milestone_order)
);

alter table public.tracker_configs enable row level security;
alter table public.tracker_config_versions enable row level security;
alter table public.tracker_fields enable row level security;
alter table public.tracker_assignments enable row level security;
alter table public.tracker_entries enable row level security;
alter table public.tracker_entry_drafts enable row level security;
alter table public.tracker_milestones enable row level security;

grant select on public.tracker_configs to authenticated;
grant select on public.tracker_config_versions to authenticated;
grant select on public.tracker_fields to authenticated;
grant select on public.tracker_assignments to authenticated;
grant select on public.tracker_entries to authenticated;
grant select on public.tracker_entry_drafts to authenticated;
grant select on public.tracker_milestones to authenticated;
grant select, insert, update, delete on public.tracker_configs to service_role;
grant select, insert, update, delete on public.tracker_config_versions to service_role;
grant select, insert, update, delete on public.tracker_fields to service_role;
grant select, insert, update, delete on public.tracker_assignments to service_role;
grant select, insert, update, delete on public.tracker_entries to service_role;
grant select, insert, update, delete on public.tracker_entry_drafts to service_role;
grant select, insert, update, delete on public.tracker_milestones to service_role;

create policy "authenticated reads tracker configs"
  on public.tracker_configs
  for select
  to authenticated
  using (true);

create policy "authenticated reads visible tracker versions"
  on public.tracker_config_versions
  for select
  to authenticated
  using (
    status = 'published'
    or exists (
      select 1
      from public.tracker_assignments ta
      where ta.version_id = tracker_config_versions.id
        and (ta.client_id = (select auth.uid()) or private.is_coach_of(ta.client_id))
    )
  );

create policy "authenticated reads visible tracker fields"
  on public.tracker_fields
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tracker_config_versions tcv
      where tcv.id = tracker_fields.version_id
        and tcv.status = 'published'
    )
    or exists (
      select 1
      from public.tracker_assignments ta
      where ta.version_id = tracker_fields.version_id
        and (ta.client_id = (select auth.uid()) or private.is_coach_of(ta.client_id))
    )
  );

create policy "client reads own tracker assignments"
  on public.tracker_assignments
  for select
  to authenticated
  using (client_id = (select auth.uid()));

create policy "coach reads assigned tracker assignments"
  on public.tracker_assignments
  for select
  to authenticated
  using (private.is_coach_of(client_id));

create policy "client reads own tracker entries"
  on public.tracker_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tracker_assignments ta
      where ta.id = tracker_entries.assignment_id
        and ta.client_id = (select auth.uid())
    )
  );

create policy "coach reads assigned tracker entries"
  on public.tracker_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tracker_assignments ta
      where ta.id = tracker_entries.assignment_id
        and private.is_coach_of(ta.client_id)
    )
  );

create policy "client reads own tracker drafts"
  on public.tracker_entry_drafts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tracker_assignments ta
      where ta.id = tracker_entry_drafts.assignment_id
        and ta.client_id = (select auth.uid())
    )
  );

create policy "client reads own tracker milestones"
  on public.tracker_milestones
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tracker_assignments ta
      where ta.id = tracker_milestones.assignment_id
        and ta.client_id = (select auth.uid())
    )
  );

create policy "coach reads assigned tracker milestones"
  on public.tracker_milestones
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tracker_assignments ta
      where ta.id = tracker_milestones.assignment_id
        and private.is_coach_of(ta.client_id)
    )
  );

create or replace function private.tracker_period_date(
  p_client_id uuid,
  p_version_id uuid
)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cadence text;
  v_timezone text;
begin
  select tcv.cadence, coalesce(cp.timezone, 'UTC')
  into v_cadence, v_timezone
  from public.tracker_config_versions tcv
  left join public.client_profiles cp on cp.id = p_client_id
  where tcv.id = p_version_id;

  if v_cadence = 'weekly' then
    return date_trunc('week', now() at time zone v_timezone)::date;
  end if;

  return (now() at time zone v_timezone)::date;
end;
$$;

create or replace function private.refresh_tracker_milestones(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.tracker_assignments%rowtype;
  v_entries_count integer := 0;
  v_current_period_date date;
  v_field_count integer := 0;
  v_current_answer_count integer := 0;
  v_current_period_progress integer := 0;
begin
  select *
  into v_assignment
  from public.tracker_assignments
  where id = p_assignment_id;

  if not found then
    return;
  end if;

  select count(distinct te.entry_date)::integer
  into v_entries_count
  from public.tracker_entries te
  where te.assignment_id = v_assignment.id;

  v_current_period_date := private.tracker_period_date(
    v_assignment.client_id,
    v_assignment.version_id
  );

  select count(tf.id)::integer
  into v_field_count
  from public.tracker_fields tf
  where tf.version_id = v_assignment.version_id;

  select count(te.id)::integer
  into v_current_answer_count
  from public.tracker_entries te
  where te.assignment_id = v_assignment.id
    and te.entry_date = v_current_period_date;

  if v_field_count > 0 then
    v_current_period_progress := least(100, (v_current_answer_count * 100) / v_field_count);
  end if;

  with specs(milestone_order, label, threshold) as (
    values
      (1, 'Log your first entry'::text, 1),
      (2, 'Share three entries with your coach'::text, 3),
      (3, 'Review what is helping'::text, 5)
  ),
  next_step as (
    select min(specs.threshold) as threshold
    from specs
    where specs.threshold > v_entries_count
  ),
  rows as (
    select
      v_assignment.id as assignment_id,
      specs.milestone_order,
      specs.label,
      case
        when v_entries_count >= specs.threshold then 'done'
        when specs.threshold = (select threshold from next_step) then 'now'
        else 'up_next'
      end as state,
      case
        when v_entries_count >= specs.threshold then 100
        when specs.threshold = 1 then v_current_period_progress
        when specs.threshold = (select threshold from next_step) then
          least(100, (v_entries_count * 100) / specs.threshold)
        else 0
      end as current_step_progress
    from specs
  )
  insert into public.tracker_milestones (
    assignment_id,
    milestone_order,
    label,
    state,
    current_step_progress
  )
  select
    rows.assignment_id,
    rows.milestone_order,
    rows.label,
    rows.state,
    rows.current_step_progress
  from rows
  on conflict (assignment_id, milestone_order) do update
    set label = excluded.label,
        state = excluded.state,
        current_step_progress = excluded.current_step_progress,
        updated_at = now();
end;
$$;

create or replace function private.refresh_tracker_milestones_after_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_tracker_milestones(new.id);
  return new;
end;
$$;

create trigger refresh_tracker_milestones_after_assignment
  after insert or update of status on public.tracker_assignments
  for each row execute function private.refresh_tracker_milestones_after_assignment();

create or replace function private.refresh_tracker_milestones_after_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
begin
  if tg_op = 'DELETE' then
    v_assignment_id := old.assignment_id;
    perform private.refresh_tracker_milestones(v_assignment_id);
    return old;
  end if;

  v_assignment_id := new.assignment_id;
  perform private.refresh_tracker_milestones(v_assignment_id);
  return new;
end;
$$;

create trigger refresh_tracker_milestones_after_entry
  after insert or update or delete on public.tracker_entries
  for each row execute function private.refresh_tracker_milestones_after_entry();

create or replace function public.save_tracker_draft(p_field_id uuid, p_answer jsonb)
returns table (
  assignment_id uuid,
  draft_id uuid,
  entry_date date,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := (select auth.uid());
  v_field public.tracker_fields%rowtype;
  v_assignment public.tracker_assignments%rowtype;
  v_entry_date date;
  v_draft_id uuid;
begin
  if v_client_id is null then
    raise exception 'not authenticated';
  end if;

  select tf.*
  into v_field
  from public.tracker_fields tf
  join public.tracker_config_versions tcv on tcv.id = tf.version_id
  where tf.id = p_field_id
    and tcv.status = 'published'
    and tcv.is_active = true;

  if not found then
    raise exception 'tracker field is not available';
  end if;

  if not private.tracker_answer_matches_config(v_field.config, p_answer) then
    raise exception 'answer does not fit tracker field';
  end if;

  select ta.*
  into v_assignment
  from public.tracker_assignments ta
  where ta.client_id = v_client_id
    and ta.version_id = v_field.version_id
    and ta.status = 'active';

  if not found then
    raise exception 'active tracker assignment not found';
  end if;

  v_entry_date := private.tracker_period_date(v_client_id, v_assignment.version_id);

  insert into public.tracker_entry_drafts (
    assignment_id,
    field_id,
    version_id,
    field_key,
    field_order,
    field_prompt,
    answer_type,
    field_config,
    answer,
    entry_date
  )
  values (
    v_assignment.id,
    v_field.id,
    v_field.version_id,
    v_field.field_key,
    v_field.field_order,
    v_field.prompt,
    v_field.answer_type,
    v_field.config,
    p_answer,
    v_entry_date
  )
  on conflict on constraint tracker_entry_drafts_assignment_field_period_key do update
    set answer = excluded.answer,
        version_id = excluded.version_id,
        field_key = excluded.field_key,
        field_order = excluded.field_order,
        field_prompt = excluded.field_prompt,
        answer_type = excluded.answer_type,
        field_config = excluded.field_config,
        updated_at = now()
  returning tracker_entry_drafts.id into v_draft_id;

  return query select v_assignment.id, v_draft_id, v_entry_date, 'draft'::text;
end;
$$;

create or replace function public.save_tracker_entry(p_field_id uuid, p_answer jsonb)
returns table (
  assignment_id uuid,
  entry_id uuid,
  entry_date date,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := (select auth.uid());
  v_field public.tracker_fields%rowtype;
  v_assignment public.tracker_assignments%rowtype;
  v_entry_date date;
  v_entry_id uuid;
begin
  if v_client_id is null then
    raise exception 'not authenticated';
  end if;

  select tf.*
  into v_field
  from public.tracker_fields tf
  join public.tracker_config_versions tcv on tcv.id = tf.version_id
  where tf.id = p_field_id
    and tcv.status = 'published'
    and tcv.is_active = true;

  if not found then
    raise exception 'tracker field is not available';
  end if;

  if not private.tracker_answer_matches_config(v_field.config, p_answer) then
    raise exception 'answer does not fit tracker field';
  end if;

  select ta.*
  into v_assignment
  from public.tracker_assignments ta
  where ta.client_id = v_client_id
    and ta.version_id = v_field.version_id
    and ta.status = 'active';

  if not found then
    raise exception 'active tracker assignment not found';
  end if;

  v_entry_date := private.tracker_period_date(v_client_id, v_assignment.version_id);

  insert into public.tracker_entries (
    assignment_id,
    field_id,
    version_id,
    field_key,
    field_order,
    field_prompt,
    answer_type,
    field_config,
    answer,
    entry_date
  )
  values (
    v_assignment.id,
    v_field.id,
    v_field.version_id,
    v_field.field_key,
    v_field.field_order,
    v_field.prompt,
    v_field.answer_type,
    v_field.config,
    p_answer,
    v_entry_date
  )
  on conflict on constraint tracker_entries_assignment_field_period_key do update
    set answer = excluded.answer,
        version_id = excluded.version_id,
        field_key = excluded.field_key,
        field_order = excluded.field_order,
        field_prompt = excluded.field_prompt,
        answer_type = excluded.answer_type,
        field_config = excluded.field_config,
        updated_at = now()
  returning tracker_entries.id into v_entry_id;

  delete from public.tracker_entry_drafts ted
  where ted.assignment_id = v_assignment.id
    and ted.field_id = v_field.id
    and ted.entry_date = v_entry_date;

  return query select v_assignment.id, v_entry_id, v_entry_date, v_assignment.status;
end;
$$;

create or replace function public.get_tracker_progress()
returns table (
  entries_count bigint,
  milestone_id uuid,
  milestone_order integer,
  label text,
  state text,
  current_step_progress integer
)
language sql
security definer
stable
set search_path = ''
as $$
  with active_assignment as (
    select ta.id
    from public.tracker_assignments ta
    where ta.client_id = (select auth.uid())
      and ta.status = 'active'
    limit 1
  ),
  entry_counts as (
    select count(distinct te.entry_date)::bigint as entries_count
    from active_assignment aa
    left join public.tracker_entries te on te.assignment_id = aa.id
  )
  select
    coalesce(ec.entries_count, 0) as entries_count,
    tm.id as milestone_id,
    tm.milestone_order,
    tm.label,
    tm.state,
    tm.current_step_progress
  from active_assignment aa
  cross join entry_counts ec
  join public.tracker_milestones tm on tm.assignment_id = aa.id
  order by tm.milestone_order asc;
$$;

create or replace function public.get_coach_tracker_progress(p_client_id uuid)
returns table (
  entries_count bigint,
  milestone_id uuid,
  milestone_order integer,
  label text,
  state text,
  current_step_progress integer
)
language sql
security definer
stable
set search_path = ''
as $$
  with active_assignment as (
    select ta.id
    from public.tracker_assignments ta
    where ta.client_id = p_client_id
      and ta.status = 'active'
      and private.is_coach_of(ta.client_id)
    limit 1
  ),
  entry_counts as (
    select count(distinct te.entry_date)::bigint as entries_count
    from active_assignment aa
    left join public.tracker_entries te on te.assignment_id = aa.id
  )
  select
    coalesce(ec.entries_count, 0) as entries_count,
    tm.id as milestone_id,
    tm.milestone_order,
    tm.label,
    tm.state,
    tm.current_step_progress
  from active_assignment aa
  cross join entry_counts ec
  join public.tracker_milestones tm on tm.assignment_id = aa.id
  order by tm.milestone_order asc;
$$;

revoke execute on function public.save_tracker_draft(uuid, jsonb) from public;
revoke execute on function public.save_tracker_entry(uuid, jsonb) from public;
revoke execute on function public.get_tracker_progress() from public;
revoke execute on function public.get_coach_tracker_progress(uuid) from public;
grant execute on function public.save_tracker_draft(uuid, jsonb) to authenticated;
grant execute on function public.save_tracker_entry(uuid, jsonb) to authenticated;
grant execute on function public.get_tracker_progress() to authenticated;
grant execute on function public.get_coach_tracker_progress(uuid) to authenticated;

create or replace function public.reject_used_tracker_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.tracker_config_id is not distinct from new.tracker_config_id
      and old.version is not distinct from new.version
      and old.cadence is not distinct from new.cadence
      and old.status is not distinct from new.status
      and old.is_active is not distinct from new.is_active
      and old.published_at is not distinct from new.published_at
    then
      return new;
    end if;
  end if;

  if exists (
    select 1
    from public.tracker_assignments ta
    where ta.version_id = old.id
  ) then
    raise exception 'used tracker versions cannot be changed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger reject_used_tracker_version_mutation
  before update or delete on public.tracker_config_versions
  for each row execute function public.reject_used_tracker_version_mutation();

create or replace function public.reject_used_tracker_field_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.version_id is not distinct from new.version_id
      and old.field_key is not distinct from new.field_key
      and old.field_order is not distinct from new.field_order
      and old.prompt is not distinct from new.prompt
      and old.answer_type is not distinct from new.answer_type
      and old.config is not distinct from new.config
    then
      return new;
    end if;
  end if;

  if exists (
    select 1
    from public.tracker_assignments ta
    where ta.version_id = old.version_id
  ) or exists (
    select 1
    from public.tracker_entries te
    where te.field_id = old.id
  ) or exists (
    select 1
    from public.tracker_entry_drafts ted
    where ted.field_id = old.id
  ) then
    raise exception 'used tracker fields cannot be changed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger reject_used_tracker_field_mutation
  before update or delete on public.tracker_fields
  for each row execute function public.reject_used_tracker_field_mutation();
