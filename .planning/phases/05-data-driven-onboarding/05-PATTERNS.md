# Phase 05: Data-Driven Onboarding - Pattern Map

**Mapped:** 2026-07-05  
**Files analyzed:** 24 module families  
**Analogs found:** 24 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0008_onboarding.sql` | migration | CRUD/request-response | `supabase/migrations/0007_client_profiles.sql` + `0004_rls_helpers.sql` | exact |
| `scripts/verify-rls.ts` | test | request-response | `scripts/verify-rls.ts` Phase 4 assertions | exact |
| `scripts/seed.ts` | utility | batch/file-I/O | `scripts/seed.ts` existing auth/profile fixtures | exact |
| `packages/core/src/fields.ts` or `onboarding.ts` | model | transform | `packages/core/src/chat.ts` | role-match |
| `packages/core/src/index.ts` | config | transform | `packages/core/src/index.ts` | exact |
| `packages/supabase/src/database.generated.ts` | model | CRUD | generated Supabase schema | exact |
| `packages/supabase/src/database.types.ts` | model | transform | `packages/supabase/src/database.types.ts` | exact |
| `apps/web/lib/validation/onboarding.ts` | utility | transform | `apps/web/lib/validation/profile.ts` | role-match |
| `apps/web/lib/onboarding/field-config.test.ts` | test | transform | `apps/web/lib/validation/profile.test.ts` | role-match |
| `apps/web/lib/services/supabase/types.ts` | service | CRUD/request-response | existing repository interfaces | exact |
| `apps/web/lib/services/supabase/core.ts` | service | CRUD/request-response | existing `SupabaseClientProfileRepository` | exact |
| `apps/web/lib/auth/server.ts` | service | request-response | `getClientHomeData()` / `getCoachClientDetailData()` | exact |
| `apps/web/app/(authenticated)/home/page.tsx` | route | request-response | existing client home page | exact |
| `apps/web/app/(authenticated)/onboarding/page.tsx` | route | request-response | `home/page.tsx` + coach client detail page | role-match |
| `apps/web/app/(authenticated)/onboarding/actions.ts` | service | request-response/CRUD | `profile/edit/actions.ts` | exact |
| `apps/web/components/onboarding/onboarding-conversation.tsx` | component | event-driven/request-response | chat primitives + `ConsentRow` action state | role-match |
| `apps/web/components/fields/FieldRenderer.tsx` | component | transform/event-driven | `Input`, `Button`, chat `Bubble` conventions | role-match |
| `apps/web/components/fields/AnswerChip.tsx` | component | event-driven | `Button` variant + chat chip/bubble token rules | role-match |
| `apps/web/components/fields/TextAreaField.tsx` | component | event-driven | `Input` feedback-row pattern | role-match |
| `apps/web/components/onboarding/AutosaveStatus.tsx` | component | event-driven | `Input` reserved feedback row + `Alert notice` | partial |
| `apps/web/components/onboarding/CoachOnboardingReview.tsx` | component | request-response | coach client detail `Card` + `Alert` | exact |
| `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` | route | request-response | existing coach client detail page | exact |
| `apps/web/components/fields/field-renderer.test.tsx` | test | event-driven | `components/chat/chat.test.tsx` + UI tests | role-match |
| `apps/web/app/(authenticated)/onboarding/page.test.tsx` | test | request-response | `home/page.test.tsx` + coach detail test | role-match |

## Pattern Assignments

### `supabase/migrations/0008_onboarding.sql` (migration, CRUD/request-response)

**Analog:** `supabase/migrations/0007_client_profiles.sql`, `supabase/migrations/0004_rls_helpers.sql`

**Migration/RLS pattern** (`0007_client_profiles.sql` lines 12-40):
```sql
create table public.client_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_profiles enable row level security;
grant select on public.client_profiles to authenticated;
grant select, insert, update, delete on public.client_profiles to service_role;
```

**Client/coach policy pattern** (`0007_client_profiles.sql` lines 42-60):
```sql
create policy "client reads own client_profile"
  on public.client_profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "coach reads assigned client's client_profile"
  on public.client_profiles
  for select
  to authenticated
  using (private.is_coach_of(id));
```

**Authorization helper pattern** (`0004_rls_helpers.sql` lines 9-24):
```sql
create or replace function private.is_coach_of(client_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.coach_clients cc
    where cc.client_id = client_uuid
      and cc.coach_id = (select auth.uid())
  )
  and (select role from public.profiles where id = (select auth.uid())) = 'coach';
$$;
```

Apply this style to onboarding attempts/answers. Reuse `private.is_coach_of`; do not redefine it. Add `pg_jsonschema` checks and immutability triggers in the same migration, mirroring the security-definer `search_path = ''` trigger/function style from `0007_client_profiles.sql` lines 66-84 and 92-109.

### `scripts/verify-rls.ts` (test, request-response)

**Analog:** `scripts/verify-rls.ts`

**Real auth session pattern** (lines 1-40):
```ts
const supabase = createClient(supabaseUrl!, publishableKey!, {
  auth: { persistSession: false },
});
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw new Error(`signInWithPassword(${email}) failed: ${error.message}`);
```

**Assertion/reporting pattern** (lines 25-48):
```ts
let failures = 0;

function report(label: string, ok: boolean, detail?: string): void {
  const line = `${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`;
  console.log(line);
  if (!ok) failures += 1;
}
```

**Denied-read pattern** (lines 288-319):
```ts
const { data, error } = await supabase.from("client_profiles").select("*").eq("id", client1Id);
checkNoRecursion("PROF-06 unassigned coach denied", error);
if (error) {
  report("PROF-06 unassigned coach denied: select does not error", false, error.message);
  return;
}
report("PROF-06 unassigned coach denied: zero rows returned (no error, no leak)", (data ?? []).length === 0);
```

Extend with client self save/read, assigned coach read, unassigned coach zero rows, cross-client zero rows, invalid config rejection, and used-version immutability. Keep all checks under anon/publishable authenticated sessions, never service-role.

### `scripts/seed.ts` (utility, batch/file-I/O)

**Analog:** `scripts/seed.ts`

**Service-role seed client** (lines 18-21):
```ts
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

**Idempotent upsert pattern** (lines 91-110):
```ts
async function assignClient(coachId: string, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("coach_clients")
    .upsert({ coach_id: coachId, client_id: clientId }, { onConflict: "client_id" });
  if (error) throw error;
}
```

Seed one active published onboarding assessment and neutral questions with the same idempotent helper shape. Keep service-role use inside seed/migration work only.

### `packages/core/src/fields.ts` and `packages/core/src/index.ts` (model/config, transform)

**Analog:** `packages/core/src/chat.ts`, `packages/core/src/index.ts`

**Structural contract pattern** (`chat.ts` lines 3-42):
```ts
export type ConversationId = string;
export type MessageId = string;

export interface ChatMessage {
  id: MessageId;
  conversationId: ConversationId;
  body: string;
  createdAt: string;
}

export const chatLimits = {
  messageBodyMaxLength: 4000,
} as const;
```

**Barrel export pattern** (`index.ts` lines 1-2):
```ts
export * from "./chat";
export * from "./roles";
```

Add structural TypeScript types for `FieldConfig` and `FieldAnswer` only. Do not import zod in `packages/core`; export the new file from `packages/core/src/index.ts`.

### `packages/supabase/src/database.types.ts` (model, transform)

**Analog:** `packages/supabase/src/database.types.ts`

**Generated type alias pattern** (lines 1-15):
```ts
import type { Database as GeneratedDatabase, Json } from "./database.generated";

export type { Json };
export type Database = GeneratedDatabase;
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ClientProfileRow = Database["public"]["Tables"]["client_profiles"]["Row"];
```

After generating types, add aliases such as `OnboardingAssessmentVersionRow`, `OnboardingQuestionRow`, `OnboardingAttemptRow`, and `OnboardingAnswerRow`. Keep hand-written future contracts out of `Database`.

### `apps/web/lib/validation/onboarding.ts` (utility, transform)

**Analog:** `apps/web/lib/validation/profile.ts`

**zod-in-web pattern** (lines 1-17):
```ts
import { z } from "zod";

export const editProfileSchema = z.object({
  displayName: z.string().trim().min(1, { error: "Add a name so your coach knows who they're talking to." }),
  goal: z.string().trim().max(2000).optional().default(""),
});

export type EditProfileInput = z.infer<typeof editProfileSchema>;
```

Use zod v4 discriminated unions for the six answer types. Keep calm validation messages and add tests like `profile.test.ts` lines 4-64 for invalid config, accepted payloads, and ignored forbidden keys.

### `apps/web/lib/services/supabase/types.ts` and `core.ts` (service, CRUD/request-response)

**Analog:** `apps/web/lib/services/supabase/types.ts`, `apps/web/lib/services/supabase/core.ts`

**Repository interface pattern** (`types.ts` lines 74-101):
```ts
export interface ClientProfileRepository {
  findById(id: string): Promise<ServiceResult<ClientProfileRow | null>>;
  findByIdForCoach(id: string): Promise<ServiceResult<ClientProfileRow | null>>;
  updateSafeFields(id: string, fields: ClientProfileSafeFields): Promise<ServiceResult<void>>;
}

export interface SupabaseDatabaseService {
  readonly client: AppSupabaseClient;
  readonly profiles: ProfileRepository;
  readonly coachClients: CoachClientRepository;
  readonly clientProfiles: ClientProfileRepository;
}
```

**Repository implementation pattern** (`core.ts` lines 326-403):
```ts
class SupabaseClientProfileRepository implements ClientProfileRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async findById(id: string): Promise<ServiceResult<ClientProfileRow | null>> {
    return safely("clientProfiles.findById", async () => {
      const { data, error } = await this.client
        .from("client_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) return serviceFailure(mapSupabaseError(error, { code: "database", fallbackMessage: "Could not load the profile details.", operation: "clientProfiles.findById", recoverable: true }));
      return serviceSuccess(data);
    });
  }
}
```

Add an `OnboardingRepository` for active version reads, attempt/answer reads, coach review reads, and RPC command calls. Register it in `SupabaseDatabaseServiceImpl` like `core.ts` lines 481-490.

### `apps/web/lib/auth/server.ts` (service, request-response)

**Analog:** `apps/web/lib/auth/server.ts`

**Role/session guard pattern** (lines 79-116):
```ts
const userResult = await services.auth.getCurrentUser();
if (!userResult.ok) throw userResult.error;
if (!userResult.data) return null;
const profileResult = await services.database.profiles.findById(userResult.data.id);
if (!profileResult.ok) throw profileResult.error;
```

**Client home data pattern** (lines 163-193):
```ts
export async function getClientHomeData(): Promise<ClientHomeData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);
  if (!profile) return null;
  return { role: profile.role, firstName: profile.displayName.split(" ")[0] ?? "", coachName };
}
```

**Coach detail not-found pattern** (lines 269-330):
```ts
if (!UUID_RE.test(clientId)) {
  return { role: profile.role, client: null };
}
const clientProfileResult = await services.database.clientProfiles.findByIdForCoach(clientId);
if (!clientProfileResult.data) {
  return { role: profile.role, client: null };
}
```

Add `getClientOnboardingData()` and `getCoachClientOnboardingReviewData(clientId)` here. Keep the same null means signed-out vs calm unavailable contract. Let RLS do coach/client scoping.

### `apps/web/app/(authenticated)/onboarding/page.tsx` and `home/page.tsx` (route, request-response)

**Analog:** `apps/web/app/(authenticated)/home/page.tsx`

**Server Component wrong-door pattern** (lines 15-24):
```tsx
const data = await getClientHomeData();
if (!data) redirect(authRedirects.signedOut);
if (data.role === "coach") redirect(authRedirects.coachHome);
```

**Home route primary-action test pattern** (`home/page.test.tsx` lines 76-80):
```ts
const pageSource = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
const matches = (pageSource.match(/variant="primary"/g) ?? []).length;
expect(matches).toBe(0);
```

For `/onboarding`, render only the assigned/current active assessment. For `/home`, add at most one primary CTA to start/continue onboarding when active data exists; no assessment list or picker.

### `apps/web/app/(authenticated)/onboarding/actions.ts` (service, request-response/CRUD)

**Analog:** `apps/web/app/(authenticated)/profile/edit/actions.ts`

**Server Action discipline** (lines 1-31):
```ts
"use server";

import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import { editProfileSchema } from "@/lib/validation/profile";
```

**Re-authenticate, validate, preserve values** (lines 36-61):
```ts
const services = await createServerSupabaseServices();
const userResult = await services.auth.getCurrentUser();
if (!userResult.ok || !userResult.data) {
  return { values: rawValues, notice: "Your session expired. Sign in again to save." };
}
const parsed = editProfileSchema.safeParse(rawValues);
if (!parsed.success) {
  return { errors: parsed.error.flatten().fieldErrors, values: rawValues };
}
```

**Calm failure pattern** (lines 80-88):
```ts
if (!displayNameResult.ok || !clientProfileResult.ok) {
  return {
    values: rawValues,
    notice: "Couldn't save just now. Your text is still here — try again?",
  };
}
redirect("/profile");
```

Use this for `saveOnboardingAnswerAction` and `finalizeOnboardingAction`: re-check user, zod-parse config/answer, call repository/RPC, return calm notice while preserving draft. Do not accept `client_id` from the client.

### Field and onboarding components (component, event-driven/transform)

**Analogs:** `Button`, `Input`, `Progress`, `Alert`, `Bubble`, `MessageList`, `ChatContainer`, `ConsentRow`

**Button/answer target pattern** (`button.tsx` lines 5-20, 91-112):
```tsx
"relative inline-flex items-center justify-center rounded-control px-6",
"min-h-[var(--size-control)] text-[17px] transition-colors",
"border border-transparent cursor-pointer",
```

**Input feedback pattern** (`input.tsx` lines 45-87):
```tsx
<label htmlFor={inputId} className="mb-2 block text-[15px] font-medium text-foreground">
  {label}
</label>
<input className={cn(inputVariants({ feedback }), className)} />
<div className="mt-1 min-h-[22px]">
  {hint && <p className="text-[14px] text-muted">{hint}</p>}
  {notice && <p className="flex items-center gap-1.5 text-[14px] text-notice">{notice}</p>}
</div>
```

**Progress pattern** (`progress.tsx` lines 10-27):
```tsx
<div className="h-3 w-full overflow-hidden rounded-pill bg-surface-2"
  role="progressbar"
  aria-valuenow={clamped}
  aria-valuemin={0}
  aria-valuemax={100}
>
  <div className="h-full rounded-pill bg-primary transition-[width] duration-500" style={{ width: `${clamped}%` }} />
</div>
```

**Chat bubble pattern** (`bubble.tsx` lines 15-30):
```tsx
<div
  className={cn(
    "animate-message-in inline-block max-w-[85%] rounded-card px-4 py-2.5 text-[15px] break-words",
    mine ? "rounded-br-control bg-primary text-on-primary" : "rounded-bl-control border border-border bg-surface text-body"
  )}
>
  {children}
</div>
```

**Action-state client component pattern** (`consent-row.tsx` lines 22-59):
```tsx
const [pending, setPending] = useState(false);
async function handleAccept() {
  setPending(true);
  await acceptConsentAction(CURRENT_CONSENT_VERSION);
  setAccepted(true);
  setPending(false);
}
```

Implement `FieldRenderer` as a pure discriminant switch over six answer types, not question ids. Use real buttons/inputs/textarea/fieldset semantics, 56px targets, selected states by border/fill/weight, and `Progress` only with orientation labels like `Question 2 of 7`.

### `apps/web/components/onboarding/CoachOnboardingReview.tsx` and coach detail route (component/route, request-response)

**Analog:** `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx`

**Read-only unavailable state** (lines 36-41):
```tsx
if (!data.client) {
  return (
    <Alert tone="notice">
      We couldn&apos;t find that client. They may not be assigned to you.
    </Alert>
  );
}
```

**Read-only card pattern** (lines 44-59):
```tsx
<div className="flex flex-col gap-6">
  <h1 className="text-3xl">{data.client.displayName}</h1>
  <Card className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <span className="text-[14px] text-muted">Working toward</span>
      <p className="text-foreground">{data.client.goal || "No goal recorded yet."}</p>
    </div>
  </Card>
</div>
```

Extend this route/component with ordered onboarding answers. No primary button, no edit affordance, no scoring. Use the same calm unavailable state for unknown and unassigned clients.

### Tests (test, transform/event-driven/request-response)

**Analogs:** `profile.test.ts`, `chat.test.tsx`, `progress.test.tsx`, `home/page.test.tsx`

**Validation tests** (`profile.test.ts` lines 4-64): use `safeParse`, assert calm messages, valid payloads, trimming/normalization, and forbidden keys ignored/rejected.

**Component interaction tests** (`chat.test.tsx` lines 156-176):
```ts
fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
  target: { value: "Hello" },
});
const primaryButtons = screen
  .getAllByRole("button")
  .filter((button) => button.className.includes("bg-primary"));
expect(primaryButtons).toHaveLength(1);
```

**Progress no-judgement test** (`progress.test.tsx` lines 16-19):
```ts
const { queryByText } = render(<Progress value={40} label="Step 2 of 5" />);
expect(queryByText("40%")).toBeNull();
```

Add tests for six field types, keyboard-reachable controls, one-primary rule, save/resume state shaping, no picker/list surface, coach partial/submitted/denied states, and source-grep bans for score/grade/streak/percentage judgement copy.

## Shared Patterns

### Authentication and Role Guards
**Source:** `apps/web/lib/auth/server.ts`, `apps/web/app/(authenticated)/home/page.tsx`  
**Apply to:** onboarding page, coach review extension, Server Actions

Server Components call `getCurrentProfile()` through auth helpers and page-level wrong-door redirects. Server Actions must independently call `services.auth.getCurrentUser()` because they are POST-reachable.

### RLS as Authorization Boundary
**Source:** `supabase/migrations/0004_rls_helpers.sql`, `0007_client_profiles.sql`, `apps/web/lib/auth/server.ts`  
**Apply to:** onboarding attempts/answers, coach review reads

Use `private.is_coach_of(client_id)` for assigned coach reads. Unassigned/unknown should return zero rows and render calm unavailable copy, not differentiated 403/404 behavior.

### ServiceResult Repository Layer
**Source:** `apps/web/lib/services/supabase/core.ts`, `types.ts`  
**Apply to:** onboarding repository and action handlers

Wrap Supabase calls in `safely()`, map errors through `mapSupabaseError`, return `serviceSuccess`/`serviceFailure`, and keep raw `services.client.from(...)` out of routes/actions except where the established repository layer intentionally exposes low-level clients.

### zod Only in Web Runtime
**Source:** `apps/web/lib/validation/profile.ts`, `packages/core/src/chat.ts`  
**Apply to:** onboarding field config/answer validation

Put structural types in `packages/core`; zod schemas and `safeParse` runtime validation stay under `apps/web/lib/validation` or action/service command code.

### UI Token and Accessibility Floor
**Source:** `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, `apps/web/components/ui/*`, `apps/web/components/chat/*`  
**Apply to:** all onboarding and field components

Use token classes, `cn()`, named exports, `forwardRef` for focusable controls, `min-h-[var(--size-control)]`, visible labels, reserved feedback/status rows, and no raw hex. At most one `Button variant="primary"` per view.

## No Analog Found

No hard blocker. The repo has no existing generic `FieldRenderer`, DB command function/RPC wrapper, or `pg_jsonschema` migration. Planner should use the patterns above plus `05-RESEARCH.md` for those new details:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/components/fields/FieldRenderer.tsx` | component | transform/event-driven | New shared renderer family; compose from UI primitives and zod/core contracts. |
| `supabase/migrations/0008_onboarding.sql` command functions | migration/service | request-response/CRUD | Existing migrations show triggers/RLS/grants, but no RPC command function yet. |
| `pg_jsonschema` checks | migration/config | transform | Required by phase, no existing extension usage in repo. |

## Metadata

**Analog search scope:** `supabase/migrations`, `scripts`, `packages/core/src`, `packages/supabase/src`, `apps/web/lib`, `apps/web/app/(authenticated)`, `apps/web/components/ui`, `apps/web/components/chat`, `apps/web/components/profile`  
**Files scanned:** 90+ relevant files via `rg --files` and targeted reads  
**Pattern extraction date:** 2026-07-05
