-- Data-driven onboarding: versioned question bank, pinned attempts, answer snapshots,
-- RLS-scoped client writes, and assigned-coach read-only review.
create extension if not exists pg_jsonschema with schema extensions;

create table public.onboarding_assessments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_assessment_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.onboarding_assessments (id) on delete cascade,
  version integer not null,
  status text not null check (status in ('draft', 'published', 'retired')),
  is_active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, version),
  constraint onboarding_active_version_is_published check (not is_active or status = 'published')
);

create unique index onboarding_one_active_version
  on public.onboarding_assessment_versions (assessment_id)
  where is_active;

create table public.onboarding_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.onboarding_assessment_versions (id) on delete cascade,
  question_key text not null,
  question_order integer not null check (question_order > 0),
  prompt text not null,
  answer_type text not null check (
    answer_type in ('single_select', 'multi_select', 'scale', 'short_text', 'long_text', 'boolean')
  ),
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, question_key),
  unique (version_id, question_order),
  constraint onboarding_question_config_type_matches check ((config ->> 'type') = answer_type),
  constraint onboarding_question_config_schema check (
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

create table public.onboarding_attempts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  version_id uuid not null references public.onboarding_assessment_versions (id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  current_question_id uuid references public.onboarding_questions (id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint onboarding_attempt_unique_client_version unique (client_id, version_id),
  constraint onboarding_submitted_has_timestamp check (status <> 'submitted' or submitted_at is not null)
);

create table public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.onboarding_attempts (id) on delete cascade,
  question_id uuid not null references public.onboarding_questions (id) on delete restrict,
  assessment_version_id uuid not null references public.onboarding_assessment_versions (id) on delete restrict,
  question_key text not null,
  question_order integer not null,
  question_prompt text not null,
  answer_type text not null check (
    answer_type in ('single_select', 'multi_select', 'scale', 'short_text', 'long_text', 'boolean')
  ),
  question_config jsonb not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_answers_attempt_question_key unique (attempt_id, question_id)
);

alter table public.onboarding_assessments enable row level security;
alter table public.onboarding_assessment_versions enable row level security;
alter table public.onboarding_questions enable row level security;
alter table public.onboarding_attempts enable row level security;
alter table public.onboarding_answers enable row level security;

grant select on public.onboarding_assessments to authenticated;
grant select on public.onboarding_assessment_versions to authenticated;
grant select on public.onboarding_questions to authenticated;
grant select on public.onboarding_attempts to authenticated;
grant select on public.onboarding_answers to authenticated;
grant select, insert, update, delete on public.onboarding_assessments to service_role;
grant select, insert, update, delete on public.onboarding_assessment_versions to service_role;
grant select, insert, update, delete on public.onboarding_questions to service_role;
grant select, insert, update, delete on public.onboarding_attempts to service_role;
grant select, insert, update, delete on public.onboarding_answers to service_role;

create policy "authenticated reads onboarding assessments"
  on public.onboarding_assessments
  for select
  to authenticated
  using (true);

create policy "authenticated reads published onboarding versions"
  on public.onboarding_assessment_versions
  for select
  to authenticated
  using (
    status = 'published'
    or exists (
      select 1
      from public.onboarding_attempts oa
      where oa.version_id = onboarding_assessment_versions.id
        and (oa.client_id = (select auth.uid()) or private.is_coach_of(oa.client_id))
    )
  );

create policy "authenticated reads visible onboarding questions"
  on public.onboarding_questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.onboarding_assessment_versions oav
      where oav.id = onboarding_questions.version_id
        and oav.status = 'published'
    )
    or exists (
      select 1
      from public.onboarding_attempts oa
      where oa.version_id = onboarding_questions.version_id
        and (oa.client_id = (select auth.uid()) or private.is_coach_of(oa.client_id))
    )
  );

create policy "client reads own onboarding attempts"
  on public.onboarding_attempts
  for select
  to authenticated
  using (client_id = (select auth.uid()));

create policy "coach reads assigned onboarding attempts"
  on public.onboarding_attempts
  for select
  to authenticated
  using (private.is_coach_of(client_id));

create policy "client reads own onboarding answers"
  on public.onboarding_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.onboarding_attempts oa
      where oa.id = onboarding_answers.attempt_id
        and oa.client_id = (select auth.uid())
    )
  );

create policy "coach reads assigned onboarding answers"
  on public.onboarding_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.onboarding_attempts oa
      where oa.id = onboarding_answers.attempt_id
        and private.is_coach_of(oa.client_id)
    )
  );

create or replace function public.save_onboarding_answer(p_question_id uuid, p_answer jsonb)
returns table (
  attempt_id uuid,
  answer_id uuid,
  current_question_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := (select auth.uid());
  v_question public.onboarding_questions%rowtype;
  v_attempt public.onboarding_attempts%rowtype;
  v_next_question_id uuid;
  v_answer_id uuid;
begin
  if v_client_id is null then
    raise exception 'not authenticated';
  end if;

  select q.*
  into v_question
  from public.onboarding_questions q
  join public.onboarding_assessment_versions v on v.id = q.version_id
  where q.id = p_question_id
    and v.status = 'published'
    and v.is_active = true;

  if not found then
    raise exception 'onboarding question is not available';
  end if;

  insert into public.onboarding_attempts (client_id, version_id, current_question_id)
  values (v_client_id, v_question.version_id, p_question_id)
  on conflict on constraint onboarding_attempt_unique_client_version do update
    set updated_at = now()
  returning * into v_attempt;

  if v_attempt.status = 'submitted' then
    raise exception 'onboarding attempt has already been shared';
  end if;

  select q.id
  into v_next_question_id
  from public.onboarding_questions q
  where q.version_id = v_question.version_id
    and q.question_order > v_question.question_order
  order by q.question_order asc
  limit 1;

  insert into public.onboarding_answers (
    attempt_id,
    question_id,
    assessment_version_id,
    question_key,
    question_order,
    question_prompt,
    answer_type,
    question_config,
    answer
  )
  values (
    v_attempt.id,
    v_question.id,
    v_question.version_id,
    v_question.question_key,
    v_question.question_order,
    v_question.prompt,
    v_question.answer_type,
    v_question.config,
    p_answer
  )
  on conflict on constraint onboarding_answers_attempt_question_key do update
    set answer = excluded.answer,
        assessment_version_id = excluded.assessment_version_id,
        question_key = excluded.question_key,
        question_order = excluded.question_order,
        question_prompt = excluded.question_prompt,
        answer_type = excluded.answer_type,
        question_config = excluded.question_config,
        updated_at = now()
  returning id into v_answer_id;

  update public.onboarding_attempts
  set current_question_id = v_next_question_id,
      updated_at = now()
  where id = v_attempt.id
  returning * into v_attempt;

  return query select v_attempt.id, v_answer_id, v_attempt.current_question_id, v_attempt.status;
end;
$$;

create or replace function public.finalize_onboarding_attempt()
returns table (
  attempt_id uuid,
  status text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := (select auth.uid());
  v_attempt public.onboarding_attempts%rowtype;
begin
  if v_client_id is null then
    raise exception 'not authenticated';
  end if;

  select oa.*
  into v_attempt
  from public.onboarding_attempts oa
  join public.onboarding_assessment_versions v on v.id = oa.version_id
  where oa.client_id = v_client_id
    and v.status = 'published'
    and v.is_active = true;

  if not found then
    raise exception 'onboarding attempt not found';
  end if;

  update public.onboarding_attempts as oa
  set status = 'submitted',
      submitted_at = coalesce(oa.submitted_at, now()),
      current_question_id = null,
      updated_at = now()
  where oa.id = v_attempt.id
  returning * into v_attempt;

  return query select v_attempt.id, v_attempt.status, v_attempt.submitted_at;
end;
$$;

revoke execute on function public.save_onboarding_answer(uuid, jsonb) from public;
revoke execute on function public.finalize_onboarding_attempt() from public;
grant execute on function public.save_onboarding_answer(uuid, jsonb) to authenticated;
grant execute on function public.finalize_onboarding_attempt() to authenticated;

create or replace function public.reject_used_onboarding_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.onboarding_attempts oa
    where oa.version_id = old.id
  ) then
    raise exception 'used onboarding versions cannot be changed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger reject_used_onboarding_version_mutation
  before update or delete on public.onboarding_assessment_versions
  for each row execute function public.reject_used_onboarding_version_mutation();

create or replace function public.reject_used_onboarding_question_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.onboarding_attempts oa
    where oa.version_id = old.version_id
  ) then
    raise exception 'used onboarding questions cannot be changed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger reject_used_onboarding_question_mutation
  before update or delete on public.onboarding_questions
  for each row execute function public.reject_used_onboarding_question_mutation();
