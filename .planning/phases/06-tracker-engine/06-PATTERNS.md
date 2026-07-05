# Phase 6: Tracker Engine - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 15 (new) + 5 (modified)
**Analogs found:** 18 / 20 (2 have no direct precedent, flagged below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `supabase/migrations/0009_tracker.sql` | migration | CRUD + versioning | `supabase/migrations/0008_onboarding.sql` (+ `0004_rls_helpers.sql`, `0007_client_profiles.sql`) | exact |
| `supabase/functions/assign-tracker/index.ts` | controller (Edge Function) | request-response / command | `supabase/functions/send-message/index.ts` (shape only — negative example for authz) | role-match (authz logic has no analog) |
| `apps/web/lib/validation/tracker.ts` | utility (validation) | transform | `apps/web/lib/validation/onboarding.ts` | exact |
| `packages/supabase/src/database.types.ts` (extend) | model (type aliases) | transform | existing `Onboarding*Row` aliases in same file | exact |
| `apps/web/lib/services/supabase/types.ts` (extend) | model (repository interface) | CRUD | `OnboardingRepository` interface, same file | exact |
| `apps/web/lib/services/supabase/core.ts` (extend) | service | CRUD | `SupabaseOnboardingRepository` class, same file | exact |
| `apps/web/lib/auth/server.ts` (extend) | service (server data access) | request-response | `getClientOnboardingData` / `getCoachClientOnboardingReviewData` | exact |
| `apps/web/app/(authenticated)/tracker/page.tsx` | route (Server Component) | request-response | `apps/web/app/(authenticated)/onboarding/page.tsx` | exact |
| `apps/web/app/(authenticated)/tracker/actions.ts` | controller (Server Action) | request-response | `apps/web/app/(authenticated)/onboarding/actions.ts` | exact |
| `apps/web/app/(authenticated)/tracker/tracker-client-flow.tsx` | component (client) | event-driven | `apps/web/app/(authenticated)/onboarding/onboarding-client-flow.tsx` | exact |
| `apps/web/components/tracker/tracker-entry-flow.tsx` | component | event-driven | `apps/web/components/onboarding/onboarding-conversation.tsx` | exact |
| `apps/web/components/tracker/milestone-progress.tsx` | component | transform (read-only render) | `apps/web/components/ui/progress/progress.tsx` (composition primitive); no direct "milestone path" analog exists | no analog (net-new visual pattern; see below) |
| `apps/web/components/tracker/coach-tracker-review.tsx` | component | request-response (read-only) | `apps/web/components/onboarding/coach-onboarding-review.tsx` | exact |
| `apps/web/components/fields/*` | component | — | **UNCHANGED — reused verbatim, not modified** | exact (zero new files) |
| `packages/core/src/fields.ts` | model | — | **UNCHANGED — reused verbatim** | exact |
| `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` (extend) | route (Server Component) | request-response | same file, existing `CoachOnboardingReview` integration | exact |
| `scripts/verify-rls.ts` (extend) | test | request-response (live RLS assertions) | `checkOnboarding*` functions, same file | exact |
| `scripts/seed.ts` (extend) | utility (seed) | batch | `seedOnboardingAssessment()`, same file | exact |
| `get_tracker_progress()` SQL function (inside 0009 migration) | model (DB function) | CRUD (read-only aggregate) | No existing read-only aggregate SQL function in this codebase — `save_onboarding_answer`/`finalize_onboarding_attempt` are the closest *shape* analogs (same `security definer`/`set search_path = ''` scaffold) but both are writes, not reads | no analog (net-new pattern; see below) |
| `apps/web/components/tracker/*.test.tsx` | test | — | `apps/web/components/onboarding/*.test.tsx` | exact |

## Pattern Assignments

### `supabase/migrations/0009_tracker.sql` (migration, CRUD + versioning)

**Analogs:** `supabase/migrations/0008_onboarding.sql` (primary — table shape, CHECK, RLS, command function, freeze trigger), `supabase/migrations/0004_rls_helpers.sql` (the `is_coach_of` helper), `supabase/migrations/0007_client_profiles.sql` (for the sibling "field-freeze"/column-grant discipline referenced in research, though 0008 is the closer analog for this phase since tracker fields are config-driven JSON, not discrete columns).

**Versioned config table shape** (`0008_onboarding.sql` lines 5-28, rename `onboarding_assessments`→`tracker_configs`, `onboarding_assessment_versions`→`tracker_config_versions`, add `cadence`):
```sql
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
```

**`pg_jsonschema` CHECK backstop** (`0008_onboarding.sql` lines 44-76) — copy byte-for-byte per research Pitfall 3, only renaming the constraint and table:
```sql
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
        "options": { "type": "array", "items": { "type": "object", "required": ["id", "label"], "properties": { "id": { "type": "string", "minLength": 1 }, "label": { "type": "string", "minLength": 1 } }, "additionalProperties": false } },
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
```

**RLS three-branch read policy** (`0008_onboarding.sql` lines 132-144 — published-or-referenced-by-own-attempt):
```sql
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
```

**`is_coach_of` helper** (`0004_rls_helpers.sql` lines 9-24 — reused verbatim for `tracker_assignments`/`tracker_entries` read policies; note the `auth.uid()` dependency called out in Pitfall 1):
```sql
create or replace function private.is_coach_of(client_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.coach_clients cc
      where cc.client_id = client_uuid
        and cc.coach_id = (select auth.uid())
    )
    and (select role from public.profiles where id = (select auth.uid())) = 'coach';
$$;
```

**RPC-only write / command function shape** (`0008_onboarding.sql` lines 203-296, `save_onboarding_answer` → adapt to `save_tracker_entry`; the phase's own RESEARCH.md already drafted the adapted body in its Code Examples section — use that draft verbatim as the migration source, it was written directly against this same analog):
```sql
create or replace function public.save_onboarding_answer(p_question_id uuid, p_answer jsonb)
returns table (attempt_id uuid, answer_id uuid, current_question_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := (select auth.uid());
  v_question public.onboarding_questions%rowtype;
  v_attempt public.onboarding_attempts%rowtype;
begin
  if v_client_id is null then
    raise exception 'not authenticated';
  end if;
  -- ... (full body: lookup question -> upsert attempt -> upsert answer -> advance pointer)
end;
$$;

revoke execute on function public.save_onboarding_answer(uuid, jsonb) from public;
grant execute on function public.save_onboarding_answer(uuid, jsonb) to authenticated;
```

**Freeze-on-use trigger** (`0008_onboarding.sql` lines 345-394, rename to `reject_used_tracker_version_mutation` / `reject_used_tracker_field_mutation`):
```sql
create or replace function public.reject_used_onboarding_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.onboarding_attempts oa where oa.version_id = old.id) then
    raise exception 'used onboarding versions cannot be changed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger reject_used_onboarding_version_mutation
  before update or delete on public.onboarding_assessment_versions
  for each row execute function public.reject_used_onboarding_version_mutation();
```

**Partial unique index pattern** (`0008_onboarding.sql` lines 26-28, the direct structural analog for "exactly one active tracker" — same `where is_active`/`where status = 'active'` shape, just a different scoping column):
```sql
create unique index onboarding_one_active_version
  on public.onboarding_assessment_versions (assessment_id)
  where is_active;
```
Apply the identical shape to `tracker_assignments (client_id) where status = 'active'`.

---

### `supabase/functions/assign-tracker/index.ts` (controller/Edge Function, request-response/command)

**Analog:** `supabase/functions/send-message/index.ts` — for the `Deno.serve`/method-guard/JSON-response shape ONLY. Per RESEARCH.md Pitfall 2 and the explicit anti-pattern note, do NOT copy its authorization logic — `send-message` verifies neither JWT-derived identity nor a relationship; it is validation-only.

**Deno.serve + method guard + JSON response shape to copy** (`send-message/index.ts` lines 1-13, 32-39):
```ts
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Send messages with a post request." },
      { status: 405, headers: jsonHeaders },
    );
  }
  // ... validation ...
  return Response.json(
    { accepted: true, conversationId: command.conversationId },
    { headers: jsonHeaders },
  );
});
```

**No analog for the authorization logic itself.** RESEARCH.md's own Pattern 3 section (lines 354-434 of `06-RESEARCH.md`) is the fully-worked draft implementation (caller-scoped `getUser()` + admin-client membership re-check + service-role insert with `23505`-conflict handling) — treat that draft as the primary source, cross-checked against:
- `supabase/migrations/0004_rls_helpers.sql` lines 9-24 (`is_coach_of` — confirms it reads `auth.uid()` and therefore CANNOT be called from a bare admin/service-role client; this is Pitfall 1, and it is real — verified this session by reading the function body).
- `supabase/config.toml` — confirm `verify_jwt = true` is set the same way for `send-message` before adding the `assign-tracker` entry (not read this session in full, but referenced by RESEARCH.md as `[VERIFIED]`; planner should re-open it during implementation, not assume it applies without checking the new function's name is registered).

**Membership check must use a caller-scoped client** (forward the incoming `Authorization` header), never the admin/service-role client, because `private.is_coach_of` resolves `auth.uid()` from the connection's own session — this is the single most load-bearing fact carried over from RESEARCH.md's Pitfall 1, restated here since it is the crux of the whole file.

---

### `apps/web/lib/validation/tracker.ts` (utility/validation, transform)

**Analog:** `apps/web/lib/validation/onboarding.ts` (full file read this session, 242 lines).

**Discriminated-union config schema pattern** (lines 32-110):
```ts
const singleSelectConfigSchema = z
  .strictObject({
    type: z.literal("single_select"),
    label: nonEmptyString,
    hint: z.string().trim().optional(),
    options: z.array(fieldOptionSchema).min(1, { error: questionConfigError }),
  })
  .superRefine((config, ctx) => addDuplicateOptionIssue(config.options, ctx));

export const fieldConfigSchema = z.discriminatedUnion("type", [
  singleSelectConfigSchema,
  multiSelectConfigSchema,
  scaleConfigSchema,
  shortTextConfigSchema,
  longTextConfigSchema,
  booleanConfigSchema,
]);
```

**Answer schema + validation function pattern** (lines 112-237) — `validateFieldAnswer(configInput, answerInput)` returns a `{ success: true; data } | { success: false; error }` union; reuse this exact function signature and error-message style (`"That answer does not fit this question yet."`) for `tracker.ts`. Per RESEARCH.md's Current Codebase Map, the planner may choose to import `fieldConfigSchema`/`fieldAnswerSchema` directly from `onboarding.ts` (factor into a shared module) rather than duplicate — that is an explicit planner discretion point, not resolved here.

**Top-level input schema pattern** (line 151):
```ts
export const saveOnboardingAnswerSchema = z.strictObject({
  questionId: z.string().uuid({ error: questionConfigError }),
  answer: fieldAnswerSchema,
});
```
Adapt to `saveTrackerEntrySchema = z.strictObject({ fieldId: z.string().uuid(...), answer: fieldAnswerSchema })`.

---

### `packages/supabase/src/database.types.ts` (model, extend)

**Analog:** existing `Onboarding*Row` aliases in the same file (not fully re-read this session beyond RESEARCH.md's confirmation at line 104 of `06-RESEARCH.md`: "Regenerate after migration; add `TrackerConfigRow`, `TrackerConfigVersionRow`, `TrackerFieldRow`, `TrackerAssignmentRow`, `TrackerEntryRow` aliases (mirrors the `Onboarding*Row` list exactly)"). Planner should run the generated-types regen step and add aliases following the exact naming convention already used for onboarding rows.

---

### `apps/web/lib/services/supabase/types.ts` (model/repository interface, extend)

**Analog:** `OnboardingRepository` interface, same file, lines 169-181 (read this session):
```ts
export interface OnboardingRepository {
  getActiveAssessmentForClient(): Promise<ServiceResult<ClientOnboardingData | null>>;
  getClientAttemptState(): Promise<ServiceResult<ClientOnboardingData | null>>;
  getQuestionForAnswerValidation(
    questionId: string
  ): Promise<ServiceResult<OnboardingQuestionForValidation | null>>;
  saveAnswer(
    input: SaveOnboardingAnswerInput
  ): Promise<ServiceResult<OnboardingSaveResult>>;
  finalizeAttempt(): Promise<ServiceResult<OnboardingFinalizeResult>>;
  getCoachReview(
    clientId: string
  ): Promise<ServiceResult<CoachOnboardingReviewData | null>>;
}
```
Add a parallel `TrackerRepository` interface with `getActiveAssignmentForClient()`, `getFieldForAnswerValidation(fieldId)`, `saveEntry(input)`, `getProgress()`, `getCoachReview(clientId)` — same `ServiceResult<T>` wrapper convention throughout, same "one method per Server Action call site" shape.

---

### `apps/web/lib/services/supabase/core.ts` (service, extend)

**Analog:** `SupabaseOnboardingRepository` class, same file, class declared at line 565, methods at lines 568-746 (implementation body not fully re-read this session; RESEARCH.md's Current Codebase Map at line 107 of `06-RESEARCH.md` already confirms the exact mirroring target: `getActiveAssignmentForClient()`, `getEntryQuestionForValidation()`, `saveEntry()`, `getProgress()`, `getCoachReview(clientId)`). Each method follows the same `SupabaseResponse<Row>` cast + `serviceSuccess`/error-wrapping convention visible in the `OnboardingRepository` implementation's imports (lines 12-40: `OnboardingAnswerRow`, `OnboardingAttemptRow`, `OnboardingQuestionRow` from `@fish/supabase`; `FieldAnswer`, `FieldConfig`, `OnboardingReviewAnswer` from `@fish/core`).

---

### `apps/web/lib/auth/server.ts` (service/server data access, extend)

**Analog:** `getClientOnboardingData()` (lines 360-382) and `getCoachClientOnboardingReviewData()` (lines 384-407), both read in full this session.

**Client data-load pattern** (lines 360-382):
```ts
export async function getClientOnboardingData(): Promise<ClientOnboardingPageData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

  if (!profile) {
    return null;
  }

  if (profile.role !== "client") {
    return { role: profile.role, onboarding: null };
  }

  const onboardingResult = await services.database.onboarding.getClientAttemptState();
  if (!onboardingResult.ok) {
    throw onboardingResult.error;
  }

  return { role: profile.role, onboarding: onboardingResult.data };
}
```

**Coach review data-load pattern with UUID short-circuit** (lines 384-407):
```ts
export async function getCoachClientOnboardingReviewData(
  clientId: string
): Promise<CoachClientOnboardingReviewPageData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);

  if (!profile) {
    return null;
  }

  if (profile.role !== "coach" || !UUID_RE.test(clientId)) {
    return { role: profile.role, review: null };
  }

  const reviewResult = await services.database.onboarding.getCoachReview(clientId);
  if (!reviewResult.ok) {
    throw reviewResult.error;
  }

  return { role: profile.role, review: reviewResult.data };
}
```
Add `getClientTrackerData()` and `getCoachClientTrackerReviewData(clientId)` mirroring these two functions exactly — same null-means-signed-out, same role-mismatch-means-empty-payload (never throw/redirect from the data layer), same `UUID_RE` reuse (already defined at line 300-301 in this file, no need to redeclare).

---

### `apps/web/app/(authenticated)/tracker/page.tsx` (route, request-response)

**Analog:** `apps/web/app/(authenticated)/onboarding/page.tsx` (full file, 52 lines):
```tsx
import { EmptyState } from "@/components/chat";
import { authRedirects } from "@/lib/auth/redirects";
import { getClientOnboardingData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { finalizeOnboardingAttemptAction, saveOnboardingAnswerAction } from "./actions";
import { OnboardingClientFlow } from "./onboarding-client-flow";

export default async function OnboardingPage() {
  const data = await getClientOnboardingData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  if (!data.onboarding) {
    return (
      <EmptyState
        title="Nothing to answer yet"
        description="Your coach will add the next step when it is ready."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6">
      <div className="space-y-2">
        <h1 className="font-display text-heading text-foreground">...</h1>
        <p className="text-copy text-body">...</p>
      </div>
      <OnboardingClientFlow onboarding={data.onboarding} saveAction={saveOnboardingAnswerAction} finalizeAction={finalizeOnboardingAttemptAction} />
    </div>
  );
}
```
Copy this Server-Component shape verbatim: null → `redirect(authRedirects.signedOut)`; wrong role → redirect; no assignment → `EmptyState` (per Copywriting Contract: `"Nothing to log yet."` / `"Your coach will add your tracker when it's ready."`); otherwise render `TrackerClientFlow` inside the same `max-w-content` wrapper.

---

### `apps/web/app/(authenticated)/tracker/actions.ts` (controller/Server Action, request-response)

**Analog:** `apps/web/app/(authenticated)/onboarding/actions.ts` (full file, 100 lines):
```ts
"use server";

const saveNotice = "That did not save yet. Keep this open and try again.";

export interface SaveOnboardingAnswerActionState {
  status: "saved" | "notice";
  values: unknown;
  notice?: string;
  result?: OnboardingSaveResult;
}

export async function saveOnboardingAnswerAction(input: unknown): Promise<SaveOnboardingAnswerActionState> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return { status: "notice", values: input, notice: saveNotice };
  }

  const parsed = saveOnboardingAnswerSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: saveNotice };
  }

  const questionResult = await services.database.onboarding.getQuestionForAnswerValidation(parsed.data.questionId);
  if (!questionResult.ok || !questionResult.data) {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  let config;
  try {
    config = parseFieldConfig(questionResult.data.config);
  } catch {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  const validation = validateFieldAnswer(config, parsed.data.answer);
  if (!validation.success) {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  const saveResult = await services.database.onboarding.saveAnswer({ questionId: parsed.data.questionId, answer: validation.data });
  if (!saveResult.ok) {
    return { status: "notice", values: parsed.data, notice: saveNotice };
  }

  return { status: "saved", values: parsed.data, result: saveResult.data };
}
```
This is the **getUser()-re-verify pattern** referenced in the pattern-mapping brief: every Server Action re-checks `services.auth.getCurrentUser()` before touching validated input, never trusts a prior client-side auth state. Copy this exact sequence (auth check → zod parse → fetch-config-for-validation → `validateFieldAnswer` → save → return tagged union) for `saveTrackerEntryAction`. RESEARCH.md's own Code Examples section (`06-RESEARCH.md` lines 542-577) already contains the fully-adapted draft of this action against `tracker`.

---

### `apps/web/app/(authenticated)/tracker/tracker-client-flow.tsx` (component/client, event-driven)

**Analog:** `apps/web/app/(authenticated)/onboarding/onboarding-client-flow.tsx` (full file, 84 lines):
```tsx
"use client";

export function OnboardingClientFlow({ onboarding, saveAction, finalizeAction }: OnboardingClientFlowProps) {
  const router = useRouter();
  const [savedAnswers, setSavedAnswers] = useState(onboarding.savedAnswers);
  const [currentQuestionId, setCurrentQuestionId] = useState(onboarding.currentQuestionId);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatusKind>(
    onboarding.status === "in_progress" && Object.keys(onboarding.savedAnswers).length > 0 ? "resume" : "idle"
  );

  async function handleSaveAnswer(questionId: string, answer: FieldAnswer) {
    setAutosaveStatus("saving");
    const result = await saveAction({ questionId, answer });

    if (result.status !== "saved" || !result.result) {
      setAutosaveStatus("error");
      return;  // draft NOT cleared on failure -- this is the load-bearing line for TRAK-03
    }

    setSavedAnswers((current) => ({ ...current, [questionId]: answer }));
    setAutosaveStatus("saved");
    router.refresh();
  }

  return (
    <OnboardingConversation
      questions={onboarding.questions}
      savedAnswers={savedAnswers}
      currentQuestionId={currentQuestionId}
      autosaveStatus={autosaveStatus}
      onSaveAnswer={handleSaveAnswer}
      onFinalize={handleFinalize}
    />
  );
}
```
**This IS the draft-until-persisted pattern requested in the brief.** The load-bearing detail: on `result.status !== "saved"`, the function returns early WITHOUT clearing any local draft state — the component-scoped React state is the in-memory draft store. Per RESEARCH.md's own Open Question #2, this pattern satisfies SPA-navigation-survival only, not hard-reload survival; if the planner needs the stronger TRAK-03 "survives reload" guarantee, that is flagged as net-new work (a `sessionStorage` mirror), not reuse — no analog exists for that stronger guarantee in this codebase.

---

### `apps/web/components/tracker/tracker-entry-flow.tsx` (component, event-driven)

**Analog:** `apps/web/components/onboarding/onboarding-conversation.tsx` (not fully re-read this session; composition role confirmed via `onboarding-client-flow.tsx`'s usage above and RESEARCH.md's Recommended Project Structure, which explicitly names it "analog of onboarding-conversation.tsx"). Composes `FieldRenderer` (imported unchanged from `apps/web/components/fields/field-renderer.tsx`) per field, `AutosaveStatus` for the save-status row, and one `Button` "Save entry" primary — per UI-SPEC's Assumption A-01, this component renders ALL of the current period's fields in one `<form>`/`Card` (a deliberate deviation from onboarding's one-question-per-screen flow), so its internal structure is a NEW composition even though every piece it composes is reused verbatim.

---

### `apps/web/components/tracker/milestone-progress.tsx` (component, transform/read-only render)

**No direct analog exists in this codebase for a "vertical milestone path" component.** The closest existing building block is `apps/web/components/ui/progress/progress.tsx` (full file, 30 lines), reused only for the current-step's fill bar:
```tsx
export function Progress({ value, label, className, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)} {...props}>
      {label && <p className="mb-2 text-ui-sm text-muted">{label}</p>}
      <div className="h-3 w-full overflow-hidden rounded-pill bg-surface-2" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-pill bg-primary transition-progress duration-progress" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
```
The done/now/up-next dot-and-connector list itself is net-new UI (per UI-SPEC's Component Inventory, `MilestonePath` is explicitly listed under "New Phase 6 components"). Follow the UI-SPEC's Accessibility Contract verbatim (`aria-current="step"` + visually-hidden state word per item) since there is no prior accessible-list-of-states component to copy structurally.

---

### `apps/web/components/tracker/coach-tracker-review.tsx` (component, request-response/read-only)

**Analog:** `apps/web/components/onboarding/coach-onboarding-review.tsx` (full file, 102 lines):
```tsx
export function CoachOnboardingReview({ review }: CoachOnboardingReviewProps) {
  const answers = [...(review?.answers ?? [])].sort((left, right) => left.questionOrder - right.questionOrder);

  if (!review || answers.length === 0) {
    return (
      <Card className="space-y-2">
        <h2 className="font-display text-heading text-foreground">No onboarding answers yet</h2>
        <p className="text-copy text-body">When this client starts, their answers will appear here.</p>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="onboarding-review-heading">
      <div className="space-y-1">
        <h2 id="onboarding-review-heading" className="font-display text-heading text-foreground">Onboarding answers</h2>
        <p className="text-ui text-muted">Read-only context from the assessment this client saw.</p>
      </div>
      {review.status === "in_progress" && (
        <Alert tone="notice">
          <span className="block font-semibold text-foreground">Answers are still in progress</span>
          <span className="block">Review what has been saved so far. Nothing needs action yet.</span>
        </Alert>
      )}
      <div className="space-y-3">
        {answers.map((answer) => (
          <Card key={answer.id} className="space-y-2">
            <h3 className="text-copy font-semibold text-foreground">{answer.questionPrompt}</h3>
            <p className="whitespace-pre-wrap text-copy text-body">{formatAnswer(answer.config, answer.answer)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function formatAnswer(config: FieldConfig, answer: FieldAnswer): string {
  switch (answer.type) {
    case "single_select": return findOptionLabel(config, answer.optionId);
    case "multi_select": return answer.optionIds.length > 0 ? answer.optionIds.map((id) => findOptionLabel(config, id)).join(", ") : "No answer selected";
    case "scale": return findOptionLabel(config, answer.value);
    case "short_text": case "long_text": return answer.value;
    case "boolean": return formatBooleanAnswer(config, answer.value);
  }
}
```
Copy this exact Card-per-item, no-answers empty state, `in_progress` `Alert tone="notice"` banner, and `formatAnswer`/`findOptionLabel` switch-on-`answer.type` structure for `CoachTrackerTimeline`/`coach-tracker-review.tsx` — reorder by `entry_date` descending instead of `questionOrder` ascending (per UI-SPEC's "strict reverse-chronological order"). Per UI-SPEC, reuse/extend this `formatAnswer` helper rather than writing a second formatter if the planner can share it directly.

---

### `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` (route, extend — not replaced)

**Analog:** the file itself, current state (full file, 77 lines) — the integration point, not a separate analog:
```tsx
export default async function CoachClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCoachClientDetailData(id);

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "client") {
    redirect(authRedirects.clientHome);
  }

  if (!data.client) {
    return (
      <Alert tone="notice">
        We couldn&apos;t find that client. They may not be assigned to you.
      </Alert>
    );
  }

  const onboardingData = await getCoachClientOnboardingReviewData(id);
  // ... redirect/role guard repeated identically ...

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl">{data.client.displayName}</h1>
      <Card className="flex flex-col gap-4">{/* identity + goal + level */}</Card>
      <CoachOnboardingReview review={onboardingData.review} />
    </div>
  );
}
```
Append a `getCoachClientTrackerReviewData(id)` call using the identical redirect/role-guard boilerplate already shown twice in this file, then render `<CoachTrackerReview review={trackerData.review} />` directly below `<CoachOnboardingReview .../>` — this is an additive change to an existing file, not a new file, per RESEARCH.md's Current Codebase Map row for "Coach review."

---

### `scripts/verify-rls.ts` (test, extend)

**Analog:** `checkOnboardingUnassignedCoachDenied` / `checkOnboardingCrossClientDenied`, lines 513-563 (read this session):
```ts
async function checkOnboardingUnassignedCoachDenied(): Promise<void> {
  const unassignedCoach = await signInAs(coach2Unassigned.email, coach2Unassigned.password);
  const clientSession = await signInAs(client1.email, client1.password);
  const clientId = await getOwnUserId("ONBD-07 unassigned coach denied", clientSession);
  if (!clientId) return;

  const { data: attempts, error: attemptError } = await unassignedCoach
    .from("onboarding_attempts")
    .select("*")
    .eq("client_id", clientId);
  checkNoRecursion("ONBD-07 unassigned coach denied", attemptError);
  if (attemptError) {
    report("ONBD-07 unassigned coach denied: select does not error", false, attemptError.message);
    return;
  }
  report("ONBD-07 unassigned coach denied: zero attempts returned", (attempts ?? []).length === 0, `got ${(attempts ?? []).length}`);
}
```
This `signInAs(...)` → real-session query → `checkNoRecursion` → `report(label, condition, detail)` sequence is the exact template for all six new `checkTracker*` assertions (self-ownership, active-assignment gate, assigned-coach-read, unassigned-denial, cross-client-denial, self-assign-rejected). The "self-assign-rejected" assertion should additionally invoke the live `assign-tracker` Edge Function (per RESEARCH.md's Pitfall 2 warning that a SQL-only check would miss the authorization-logic gap) — there is no existing "call a live Edge Function from verify-rls.ts" precedent in this file, since `send-message` is validation-only and never previously exercised this way; this is a genuinely new test-harness capability, not a pure copy.

---

### `scripts/seed.ts` (utility/seed, extend)

**Analog:** `seedOnboardingAssessment()`, lines 210-256 (read this session):
```ts
async function seedOnboardingAssessment(): Promise<void> {
  const { data: assessment, error: assessmentError } = await supabase
    .from("onboarding_assessments")
    .upsert({ slug: "initial-client-context", title: "Initial client context" }, { onConflict: "slug" })
    .select("id")
    .single();
  if (assessmentError || !assessment) throw assessmentError;

  const { data: version, error: versionError } = await supabase
    .from("onboarding_assessment_versions")
    .upsert(
      { assessment_id: assessment.id, version: 1, status: "published", is_active: true, published_at: new Date().toISOString() },
      { onConflict: "assessment_id,version" },
    )
    .select("id")
    .single();
  if (versionError || !version) throw versionError;

  for (const question of onboardingQuestions) {
    const { error } = await supabase
      .from("onboarding_questions")
      .upsert({ version_id: version.id, question_key: question.questionKey, question_order: question.questionOrder, prompt: question.prompt, answer_type: question.answerType, config: question.config }, { onConflict: "version_id,question_key" });
    if (error) throw error;
  }
}
```
Copy this `upsert`-with-`onConflict`-idempotent-seed shape verbatim for `seedTrackerConfig()`. The one net-new piece: after seeding the config/fields, the seed script must also call the live `assign-tracker` Edge Function (per RESEARCH.md Pattern 3's closing note, recommended approach: sign in as the real `coach` fixture via `signInAs`-equivalent and call the function exactly like a production coach would) — no existing seed step in this file calls an Edge Function over HTTP, so that specific call site is new, though everything around it (upsert idempotency, `main()` wiring at line 280) is copy-paste.

---

## Shared Patterns

### RLS via `private.is_coach_of` (read boundary)
**Source:** `supabase/migrations/0004_rls_helpers.sql` lines 9-24
**Apply to:** `tracker_assignments`, `tracker_entries` read policies; `assign-tracker`'s membership check (via caller-scoped client, not admin client — Pitfall 1)

### RPC-only write / `security definer` command function
**Source:** `supabase/migrations/0008_onboarding.sql` `save_onboarding_answer` (lines 203-296), `revoke`/`grant execute` lines 340-343
**Apply to:** `save_tracker_entry` — no direct authenticated INSERT/UPDATE grant on `tracker_entries`; all writes go through the RPC, which re-derives `client_id` from `auth.uid()`

### Freeze-on-use trigger
**Source:** `supabase/migrations/0008_onboarding.sql` lines 345-394
**Apply to:** `tracker_config_versions`, `tracker_fields` — reject update/delete once any `tracker_assignments` row references the version

### Server Action `getUser()` re-verify + tagged-union return
**Source:** `apps/web/app/(authenticated)/onboarding/actions.ts` lines 30-80
**Apply to:** `saveTrackerEntryAction` — every Server Action re-checks auth before trusting input, returns `{ status: "saved" | "notice", ... }`, never throws to the client

### Draft-until-persisted local state (no clear-on-failure)
**Source:** `apps/web/app/(authenticated)/onboarding/onboarding-client-flow.tsx` `handleSaveAnswer` (lines 41-55)
**Apply to:** `TrackerClientFlow` — on save failure, set status to `"error"` and return WITHOUT clearing the draft

### Six-type field renderer (verbatim reuse, zero forking)
**Source:** `apps/web/components/fields/field-renderer.tsx` (full file), `packages/core/src/fields.ts` (full file)
**Apply to:** every tracker field-rendering surface — `FieldRenderer`, `AnswerChip`, `TextAreaField` imported unchanged; `FieldConfig`/`FieldAnswer` types imported unchanged from `@fish/core`

### Read-only coach review Card-list + `formatAnswer` switch
**Source:** `apps/web/components/onboarding/coach-onboarding-review.tsx` (full file)
**Apply to:** `CoachTrackerReview`/`coach-tracker-review.tsx` — Card-per-item, sorted-list, no-answers empty state, `in_progress`-style `Alert tone="notice"` banner

### `Progress` component (0-100 visual bar, never a numeric label)
**Source:** `apps/web/components/ui/progress/progress.tsx` (full file)
**Apply to:** the "now" milestone step's fill bar inside `milestone-progress.tsx` — `role="progressbar"`/`aria-valuenow` contract carries over unchanged

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/components/tracker/milestone-progress.tsx` (the `MilestonePath`/done-now-up-next dot list specifically, not the `Progress` bar it composes) | component | transform (read-only render) | No existing "vertical step list with three visual states" component exists in this codebase. `Progress` (visual bar) and `CoachOnboardingReview`'s Card-list (item-per-row) are the nearest structural neighbors but neither is a step/journey list. This is confirmed net-new by UI-SPEC's own Component Inventory, which explicitly lists `MilestonePath` under "New Phase 6 components." Build it directly from the UI-SPEC's Concrete Visual Contract section (done/now/up-next states, `aria-current="step"`, no color-as-judgement) rather than from a codebase analog. |
| `get_tracker_progress()` SQL function (read-only aggregate query, no analog for the *read* shape) | model (DB function) | CRUD (aggregate read) | Every existing SQL function in `0008_onboarding.sql` (`save_onboarding_answer`, `finalize_onboarding_attempt`) is a **write** command function (same `security definer`/`set search_path = ''`/`plpgsql` scaffold, useful for boilerplate) but none is a pure read-only aggregate. The closest structural analog for the *scaffold only* (language, security context, search_path) is `finalize_onboarding_attempt` (lines 298-338); the aggregate-query logic itself (`count(*)`, `/ 5`) has no precedent and is fully specified instead by RESEARCH.md's Pattern 4 (lines 446-464 of `06-RESEARCH.md`), which is HIGH confidence on the "derive at read time, no stored counter" principle and explicitly ASSUMED/planner-discretion on the exact milestone-count threshold. |

## Conventions

Derivation note: the shared deterministic `verify conventions --derive` module (`bin/gsd-tools.cjs`) is not present in this installed plugin version (only `verify` subcommands `plan-structure, phase-completeness, references, commits, artifacts, key-links, schema-drift, codebase-drift` are available; `conventions` is absent) — the automated derive step is unavailable in this environment. Per the never-throws contract, this is a documented skip, not a silent omission. The table below is a manual, evidence-based observation from every file actually read this session (13 web/TS files + 3 SQL migrations), not a substitute for the tool's entropy/majority-vote statistics — treat `Share`/`Entropy` columns as qualitative ("all observed instances agree" / "N/A — tool unavailable"), not computed percentages.

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| File-name casing | kebab-case (`.ts`/`.tsx` filenames: `onboarding-client-flow.tsx`, `coach-onboarding-review.tsx`, `field-renderer.tsx`, `answer-chip.tsx`) | all observed (13/13 non-route files) | N/A (tool unavailable; manual scan only) | named contract |
| Identifier casing | camelCase for functions/variables (`saveOnboardingAnswerAction`, `getClientOnboardingData`), PascalCase for components/types/interfaces (`OnboardingClientFlow`, `FieldConfig`, `ClientOnboardingData`) | all observed | N/A | named contract |
| Export style | named exports only — zero `export default` found except Next.js route/page/layout entry points (`page.tsx`'s `export default async function OnboardingPage`), which Next.js itself requires to be default | all observed | N/A | named contract |
| Import style | `import type { X } from "@fish/core"` / relative `./actions` and `@/`-aliased (`@/components/ui/card`) — type-only imports consistently separated with `import type` | all observed | N/A | named contract |

**Contested hotspots (author's choice):** none observed within the Phase 6 target directories (`apps/web/app/(authenticated)/tracker/`, `apps/web/components/tracker/`, `supabase/migrations/`, `supabase/functions/assign-tracker/`) — every analog read this session was internally consistent on all four axes with no dissenting instance. The one documented repo-wide contested-by-design split noted for planner awareness (not applicable to this phase's files) is the **CJS↔SDK dual resolver**: `bin/lib/**` is CJS (`module.exports`/`require`) while `sdk/src/**` is ESM (`export`/`import`) — each half is internally consistent per-directory and is contested only when compared repo-wide. Phase 6 files live entirely in `apps/web/`, `supabase/migrations/`, and `supabase/functions/`, none of which touch that CJS/SDK boundary, so no directory-local deviation applies here — match the ESM/named-export convention shown in every analog above.

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/functions/`, `apps/web/app/(authenticated)/onboarding/`, `apps/web/app/(authenticated)/coach/clients/[id]/`, `apps/web/components/onboarding/`, `apps/web/components/fields/`, `apps/web/components/ui/progress/`, `apps/web/lib/validation/`, `apps/web/lib/services/supabase/`, `apps/web/lib/auth/`, `packages/core/src/`, `scripts/`
**Files scanned/read in full or targeted-excerpt this session:** `0008_onboarding.sql`, `0004_rls_helpers.sql`, `send-message/index.ts`, `onboarding.ts` (validation), `fields.ts`, `field-renderer.tsx`, `onboarding-client-flow.tsx`, `actions.ts` (onboarding), `page.tsx` (onboarding), `coach-onboarding-review.tsx`, `[id]/page.tsx` (coach), `server.ts` (targeted lines 300-407), `types.ts` (grep + line refs), `core.ts` (grep + line refs), `progress.tsx`, `verify-rls.ts` (targeted lines 513-563), `seed.ts` (targeted lines 210-280) — 17 files total.
**Pattern extraction date:** 2026-07-05

---

## PATTERN MAPPING COMPLETE

**Phase:** 6 - Tracker Engine
**Files classified:** 20 (15 new, 5 modified)
**Analogs found:** 18 / 20

### Coverage
- Files with exact analog: 15
- Files with role-match analog (shape only, not full logic): 3 (`assign-tracker/index.ts`'s Deno.serve shape from `send-message`; the SQL-function scaffold for `get_tracker_progress()` from `finalize_onboarding_attempt`; `tracker-entry-flow.tsx`'s field composition from `onboarding-conversation.tsx`, adapted for multi-field-per-period per UI-SPEC Assumption A-01)
- Files with no analog: 2 (`MilestonePath`/milestone-progress step-list UI; `get_tracker_progress()`'s read-only aggregate query logic — both fully specified by RESEARCH.md/UI-SPEC instead)

### Key Patterns Identified
- The entire versioned-config → RLS → freeze-trigger → RPC-only-write shape from `0008_onboarding.sql` transfers to `0009_tracker.sql` with table/column renames only — this is the single highest-leverage reuse in the phase.
- `assign-tracker` is the first Edge Function in this codebase that must verify identity + re-check a relationship (not just validate payload shape); `send-message` must NOT be copied for its authorization logic, only its Deno.serve/response-shape boilerplate — Pitfall 1 (`is_coach_of` cannot run on a service-role connection) is real and verified from the function body.
- Every client-facing surface reuses `apps/web/components/fields/*` and `packages/core/src/fields.ts` completely unchanged — zero new renderer files is an explicit acceptance criterion, not just a suggestion.
- The milestone-journey progress UI (`MilestonePath`) and the `get_tracker_progress()` read-time derivation are the two genuinely net-new engineering surfaces in this phase; both are already fully specified by RESEARCH.md Pattern 4 and UI-SPEC's Concrete Visual Contract, so "no analog" does not mean "no guidance."

### File Created
`/Users/franz/Work/Personal/fish/.planning/phases/06-tracker-engine/06-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
