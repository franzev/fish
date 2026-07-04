# Phase 4: Client Profiles - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 14 (2 migrations-worth combined into 1 file, 2 script extensions, 10 new app files)
**Analogs found:** 14 / 14 (all have at least a role-match; two flagged as net-new mechanisms with no direct analog — Server Action + persisted a11y prefs — per RESEARCH.md's own correction)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/0007_client_profiles.sql` | migration | CRUD + event-driven (triggers) | `supabase/migrations/0001_profiles.sql` (table+grants+policy shape) + `0005_role_guard.sql` (freeze trigger shape) + `0004_rls_helpers.sql` (`is_coach_of` reuse) + `0003_coach_clients.sql` (role-integrity trigger shape) | exact (this repo has shipped this exact shape three times already) |
| `scripts/verify-rls.ts` (extend, 6 new fns) | test / utility | request-response (live HTTP assertions) | same file — `checkClientBoundary()`, `checkEscalationRejected()`, `checkClientReadsCoachName()` | exact (same file, same conventions, additive) |
| `scripts/seed.ts` (extend) | utility / batch | batch (idempotent upsert) | same file — `assignClient()`, `promoteToCoach()` | exact |
| `apps/web/app/(authenticated)/profile/page.tsx` | route (Server Component) | request-response (read) | `apps/web/app/(authenticated)/home/page.tsx` | exact |
| `apps/web/app/(authenticated)/profile/edit/page.tsx` | route (Server Component) | request-response (read, prefill) | `apps/web/app/(authenticated)/home/page.tsx` (guard shape) — no direct prefill-a-form analog exists | role-match |
| `apps/web/app/(authenticated)/profile/edit/actions.ts` | service (Server Action) | request-response (command/write) | **none — net-new mechanism.** Closest conceptual analog: `apps/web/lib/services/supabase/core.ts`'s `ServiceResult`-returning repository methods (error-shape convention only) | no analog (net-new pattern; use RESEARCH.md Pattern 2 skeleton verbatim) |
| `apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx` | component (form, client) | request-response | `apps/web/app/login/login-form.tsx` + `apps/web/app/signup/signup-form.tsx` (structure/tone only — they are `onSubmit`+`useState`, not `useActionState`) | role-match (form conventions transfer; the state-management primitive does not) |
| `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` | route (Server Component) | request-response (read-only) | `apps/web/app/(authenticated)/coach/page.tsx` | exact |
| `apps/web/lib/auth/server.ts` (extend with `getClientProfileData`/`getCoachClientDetailData`) | service (server-side data access) | request-response | same file — `getClientHomeData()`, `getCoachHomeData()`, `getCurrentProfile()` | exact |
| `apps/web/lib/services/supabase/core.ts` (extend with `ClientProfileRepository`) | service (repository) | CRUD | same file — `SupabaseProfileRepository`, `SupabaseCoachClientRepository` | exact |
| `apps/web/components/profile/coach-card.tsx` | component | request-response (render) | `apps/web/components/coach/client-list.tsx` (Card + rows) + `apps/web/components/chat/avatar/avatar.tsx` (monogram) | role-match |
| `apps/web/components/profile/settings-row.tsx` | component | request-response (render) | `apps/web/components/kit/theme-toggle.tsx` (control row shape, 56px) + `apps/web/components/coach/client-list.tsx` (row-in-Card shape) | role-match |
| `apps/web/components/profile/a11y-prefs.tsx` | component (client, instant-apply) | event-driven (DOM attribute) + request-response (persist) | `apps/web/components/kit/theme-toggle.tsx` | role-match (mechanism reused; persistence is net-new) |
| `apps/web/lib/prefs/apply-theme.ts` | utility | transform (side-effecting DOM write) | `apps/web/components/kit/theme-toggle.tsx`'s inline `useEffect` (same technique, not yet extracted to a utility) | role-match |
| `apps/web/lib/validation/profile.ts` (zod schema) | utility (validation) | transform | **none in this codebase — zero existing zod schemas.** Use RESEARCH.md Pattern 2's `editProfileSchema` skeleton | no analog (net-new dep; first zod usage in repo) |

## Pattern Assignments

### `supabase/migrations/0007_client_profiles.sql` (migration, CRUD + event-driven)

**Analogs:** `supabase/migrations/0001_profiles.sql`, `0003_coach_clients.sql`, `0004_rls_helpers.sql`, `0005_role_guard.sql`

**Table + grants pattern** (mirror `0001_profiles.sql` lines 1-20 — table first, RLS enabled, then table-scoped grants BEFORE any policy, with the explicit "grants precede RLS" comment convention):
```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'coach')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Table-level grants (Postgres privilege layer, evaluated BEFORE row level security):
-- a fresh table has no privileges for authenticated/service_role until granted. Without
-- these, every policy above is unreachable -- PostgREST/the Supabase client would get
-- "permission denied for table profiles" regardless of RLS.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
```
For `client_profiles`, this becomes column-scoped per D-08 (RESEARCH.md Pattern 1, live-verified this session — copy verbatim, only adjust the column list to the migration's final naming):
```sql
grant select on public.client_profiles to authenticated;
grant update (
  goal, locale, timezone,
  theme_pref, text_size_pref, reduced_motion_pref,
  consented, consented_at, consent_version
) on public.client_profiles to authenticated;
grant select, insert, update, delete on public.client_profiles to service_role;
```

**Self-read + self-update RLS policy pattern** (mirror `0001_profiles.sql` lines 25-29 for self-read, `0006_client_reads_coach_name.sql` lines 38-43-equivalent for self-update — both use the `id = (select auth.uid())` shape, never manual joins):
```sql
create policy "client reads own client_profile"
  on public.client_profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "client updates own safe fields"
  on public.client_profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
```

**Coach-read policy — reuse `private.is_coach_of` verbatim** (from `0004_rls_helpers.sql` lines 9-24; do not write a new helper):
```sql
-- 0004_rls_helpers.sql — copy this function AS-IS, it already exists after migration 0004 runs.
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

-- New policy on client_profiles reusing the helper:
create policy "coach reads assigned client's client_profile"
  on public.client_profiles
  for select
  to authenticated
  using (private.is_coach_of(id));
```

**Freeze-trigger pattern — mirror `0005_role_guard.sql` lines 1-23 exactly** (same `security definer`, `set search_path=''`, `is distinct from`, and the `WHEN (auth.role() = 'authenticated')` service-role bypass):
```sql
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed by this caller';
  end if;
  return new;
end;
$$;

create trigger prevent_role_change
  before update on public.profiles
  for each row
  when (auth.role() = 'authenticated') -- service_role calls bypass this WHEN clause
  execute function public.prevent_role_self_escalation();
```
→ For `level`, rename to `prevent_level_self_escalation()` / `prevent_level_change`, same shape, comparing `new.level is distinct from old.level`. RESEARCH.md Pattern 1 has the ready-to-copy adapted DDL — use it verbatim (it was live-verified against the real stack this session, five cases, including the grant-atomicity and trigger-independence proofs).

**Role-integrity / auto-provision trigger pattern** — mirror `0003_coach_clients.sql` lines 23-42 (`security definer`, raises a plain-language exception, `before insert or update`) for the *shape*, but RESEARCH.md's Pattern 3 recommends **Option B: a separate `AFTER INSERT ON public.profiles` trigger**, not touching `handle_new_user()` (0002, hardened, do not add unrelated logic — Pitfall 6):
```sql
create or replace function public.provision_client_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'client' then
    insert into public.client_profiles (id) values (new.id)
    on conflict (id) do nothing; -- idempotent, mirrors handle_new_user's own idempotency
  end if;
  return new;
end;
$$;

create trigger provision_client_profile_trigger
  after insert on public.profiles
  for each row execute function public.provision_client_profile();
```

**Migration-comment convention** (every migration in this repo opens with a WHY-focused top comment naming the decision IDs it satisfies, e.g. `0006`'s "Three things in one migration (Phase 3 Plan 1)" or `0005`'s "Role self-escalation guard (DB-04)"). Follow the same convention: open `0007` with a comment naming D-01/D-02/D-08 etc.

---

### `scripts/verify-rls.ts` (test harness, extend with 6 assertion functions)

**Analog:** same file — reuse `signInAs()`, `report()`, `checkNoRecursion()` unchanged; add new `async function checkX(): Promise<void>` functions modeled directly on the existing three.

**Signin + resolve-own-id pattern** (lines 30-38, 47-54 — copy verbatim for every new assertion needing the client's own id):
```typescript
async function signInAs(email: string, password: string) {
  const supabase = createClient(supabaseUrl!, publishableKey!, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword(${email}) failed: ${error.message}`);
  return supabase;
}
```

**Positive-assertion pattern (self-read / safe-update succeeds)** — mirror `checkEscalationRejected()`'s safe-field branch (lines 122-127):
```typescript
const { error: safeUpdateError } = await supabase
  .from("profiles")
  .update({ display_name: "Alex Rivera" })
  .eq("id", ownId);
checkNoRecursion("DB-04 safe-field update", safeUpdateError);
report("DB-04 safe-field update (display_name) succeeds", !safeUpdateError, safeUpdateError?.message);
```
→ New `checkClientProfileSelfRead()` / `checkClientProfileSafeUpdateSucceeds()` follow this exact shape against `client_profiles` instead of `profiles`.

**Negative-assertion pattern (rejection expected)** — mirror `checkEscalationRejected()`'s escalation branch (lines 109-120), which is also the direct template for the **protected-field-freeze** assertion (PROF-05/D-09) and Pitfall 4's warning ("the assertion must attempt the write and check the response"):
```typescript
async function checkEscalationRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("DB-04 escalation: resolve own user id", false, userError?.message);
    return;
  }
  const ownId = userData.user.id;

  const { error: escalationError } = await supabase.from("profiles").update({ role: "coach" }).eq("id", ownId);
  checkNoRecursion("DB-04 escalation attempt", escalationError);
  report("DB-04 escalation: self-promotion to coach is rejected", !!escalationError, escalationError ? escalationError.message : "update succeeded (should have failed)");
  // ...
}
```
→ New `checkLevelFreezeRejected()`: same shape, `.from("client_profiles").update({ level: <higher value> }).eq("id", ownId)`, expect a truthy error (either `42501` grant-layer or `P0001` trigger-layer per RESEARCH.md Pattern 1's live-verified table — either is a pass, this assertion should not assert on the specific code, just that it failed).

**Cross-client / unassigned-coach denial pattern** — mirror `checkClientReadsCoachName()`'s "exactly one row, RLS scopes it" idiom (lines 152-169), which is the template for **`checkCoachReadsAssignedClientProfile()`** (positive) and **`checkUnassignedCoachDenied()`** / **`checkCrossClientDenied()`** (both should assert `rows.length === 0`, RLS default-deny returning zero rows rather than an error — per RESEARCH.md's Security Domain table, "no cross-client leak... the read simply returns nothing under RLS", not an error response):
```typescript
const { data, error } = await supabase
  .from("profiles")
  .select("display_name")
  .eq("id", assignment.coach_id);
checkNoRecursion("D-16 client reads coach name", error);
if (error) {
  report("D-16 client reads coach name: select succeeds", false, error.message);
  return;
}
const rows = data ?? [];
const exactlyOne = rows.length === 1;
report("D-16 client reads coach name: returns exactly the assigned coach's row", exactlyOne, `got ${rows.length} rows`);
```

**Wiring into `main()`** (lines 176-184) — append new calls in the same flat sequential-await style, no test framework:
```typescript
async function main(): Promise<void> {
  await checkClientBoundary();
  await checkCoachBoundary();
  await checkEscalationRejected();
  await checkClientReadsCoachName();
  // + 6 new calls here
  console.log(`\n${failures === 0 ? "All assertions passed." : `${failures} assertion(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}
```

---

### `scripts/seed.ts` (extend with client_profiles backfill + seeded level)

**Analog:** same file — `assignClient()` (lines 82-88) is the direct template for an idempotent upsert:
```typescript
/** Assigns a client to the coach — idempotent replace (D-12: reassignment replaces). */
async function assignClient(coachId: string, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("coach_clients")
    .upsert({ coach_id: coachId, client_id: clientId }, { onConflict: "client_id" });
  if (error) throw error;
}
```
→ New `backfillClientProfile(clientId: string, level: string): Promise<void>` follows the identical shape: `.from("client_profiles").upsert({ id: clientId, level }, { onConflict: "id" })`. Call it from `main()`'s existing `for (const client of clients)` loop (lines 98-103), alongside the existing `assignClient(coachId, clientId)` call — same loop, same ordering discipline comment style ("ORDER MATTERS", lines 93-95) if a level-before-something-else ordering constraint applies.

**Service-role client + fixed dev credentials convention** (lines 18-34) — no changes needed, reuse as-is; new backfill runs through the same already-instantiated `supabase` service-role client.

---

### `apps/web/app/(authenticated)/profile/page.tsx` (route, Server Component, request-response read)

**Analog:** `apps/web/app/(authenticated)/home/page.tsx` (full file, 37 lines) — copy the wrong-door-guard + data-fetch + render shape verbatim, changing only the data source and body:
```typescript
import { EmptyState } from "@/components/home/empty-state";
import { authRedirects } from "@/lib/auth/redirects";
import { getClientHomeData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";

/* Server Component (NOT "use client") — the (authenticated) layout already
   ran getUser(), redirected signed-out visitors, and resolved role/shell.
   This page re-reads getUser() for the user id: Server Components re-execute
   per navigation, so re-reading here is correct, not redundant caching. */
export default async function ClientHomePage() {
  const data = await getClientHomeData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  return ( /* ... */ );
}
```
→ `/profile/page.tsx` follows the identical guard shape (`getUser()` re-check, wrong-door redirect if `role === "coach"`), calling a new `getProfileData()` in `lib/auth/server.ts` instead of `getClientHomeData()`. Per D-06/sketch 003 winner A: NO primary button on this screen — render essentials (monogram, display name in Fraunces, "Learning English", coach card, settings rows) with no `<Button variant="primary">` anywhere.

---

### `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` (route, Server Component, read-only)

**Analog:** `apps/web/app/(authenticated)/coach/page.tsx` (full file, 39 lines) — same guard shape, but this is a **dynamic segment** reading `params.id`, and RLS (not app code) is the sole authz boundary (RESEARCH.md's explicit "no manual id filtering" convention + the Security Domain's "unassigned coach guesses UUID" row):
```typescript
import { ClientList } from "@/components/coach/client-list";
import { EmptyState } from "@/components/home/empty-state";
import { authRedirects } from "@/lib/auth/redirects";
import { getCoachHomeData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { IconUsers } from "@tabler/icons-react";

export default async function CoachHomePage() {
  const data = await getCoachHomeData();
  if (!data) redirect(authRedirects.signedOut);
  if (data.role === "client") redirect(authRedirects.clientHome);
  return ( /* ... */ );
}
```
→ `/coach/clients/[id]/page.tsx` mirrors the guard (`getUser()` + `role === "coach"` re-check, wrong-door redirect to `/home` if a client somehow reaches it) then calls a new `getCoachClientDetailData(clientId)` which performs the RLS-gated `SELECT client_profiles WHERE id = params.id` — an unassigned coach's query returns zero rows (RLS default-deny), which the page renders as a calm not-found state (Alert `tone="notice"`, never an error), NOT a thrown error or a distinguishable 403 — this avoids the enumeration side-channel RESEARCH.md's Security Domain calls out.

**Client-list-becomes-links wiring** — `apps/web/components/coach/client-list.tsx` currently renders inert `<div>` rows (its own comment: "nothing here is tappable yet — no destination exists this milestone"); this phase resolves that comment. Wrap each row in a `next/link` `<Link href={`/coach/clients/${client.id}`}>`, keeping the exact Card+divide-y+row shape:
```tsx
import { Card } from "@/components/ui/card";

export function ClientList({ clients }: { clients: Client[] }) {
  const sorted = [...clients].sort((a, b) => a.displayName.localeCompare(b.displayName));
  return (
    <Card className="divide-y divide-border p-0">
      {sorted.map((client) => (
        <div key={client.id} className="flex flex-col gap-0.5 p-4">
          <span className="text-foreground">{client.displayName}</span>
          <span className="text-[14px] text-muted">{client.email}</span>
        </div>
      ))}
    </Card>
  );
}
```

---

### `apps/web/lib/auth/server.ts` (extend with `getProfileData` / `getCoachClientDetailData`)

**Analog:** same file — `getClientHomeData()` (lines 80-110) and `getCoachHomeData()` (lines 112-129) are the direct templates. Both follow: resolve `getCurrentProfile(services)` first (throws `ServiceError` on any DB failure, returns `null` on no session), then perform additional repository reads, unwrapping each `ServiceResult` with the same `if (!result.ok) throw result.error;` idiom:
```typescript
export async function getClientHomeData(): Promise<ClientHomeData | null> {
  const services = await createServerSupabaseServices();
  const profile = await getCurrentProfile(services);
  if (!profile) return null;

  let coachName: string | null = null;
  const assignmentResult = await services.database.coachClients.findAssignmentForClient(profile.userId);
  if (!assignmentResult.ok) throw assignmentResult.error;

  if (assignmentResult.data) {
    const coachResult = await services.database.profiles.findDisplayNameById(assignmentResult.data.coach_id);
    if (!coachResult.ok) throw coachResult.error;
    coachName = coachResult.data?.display_name ?? null;
  }

  return { role: profile.role, firstName: profile.displayName.split(" ")[0] ?? "", coachName };
}
```
→ New `getProfileData()` follows this shape: resolve `getCurrentProfile`, then call a new `services.database.clientProfiles.findById(profile.userId)` repository method, throw on failure, return a typed DTO. New `getCoachClientDetailData(clientId: string)` follows the same shape but calls `services.database.clientProfiles.findByIdForCoach(clientId)` (RLS-gated via `is_coach_of`) — a `null` result here means "not assigned," which the page renders as the calm not-found state, not an error.

---

### `apps/web/lib/services/supabase/core.ts` (extend with `ClientProfileRepository`)

**Analog:** same file — `SupabaseProfileRepository` (lines 207-282) is the direct template for a new `SupabaseClientProfileRepository`: constructor takes `client: AppSupabaseClient`, every method wraps its Supabase call in `safely(operation, async () => {...})`, uses `.maybeSingle()` for single-row reads, and returns via `serviceSuccess`/`serviceFailure` + `mapSupabaseError`:
```typescript
class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async findById(id: string): Promise<ServiceResult<ProfileRow | null>> {
    return safely("profiles.findById", async () => {
      const { data, error } = (await this.client
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle()) as SupabaseResponse<ProfileRow>;

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load the profile.",
            operation: "profiles.findById",
            recoverable: true,
          })
        );
      }
      return serviceSuccess(data);
    });
  }
}
```
→ New `SupabaseClientProfileRepository` needs `findById(id)` (own row, self-read policy), `findByIdForCoach(id)` (relies on the coach-read policy — same query shape, RLS does the scoping, no different query logic needed since RLS already filters), and `updateSafeFields(id, fields)` for the write (never includes `level` in the update payload — Pitfall 3's defense-in-depth-at-the-app-layer-too point). Also register it in `SupabaseDatabaseServiceImpl`'s constructor (lines 359-367) alongside `this.profiles` / `this.coachClients`, and add the corresponding interface to `apps/web/lib/services/supabase/types.ts` (not read this session, but same file `ProfileRepository`/`CoachClientRepository` interfaces already live there per the imports at the top of `core.ts`).

---

### `apps/web/app/(authenticated)/profile/edit/actions.ts` (Server Action — NET-NEW mechanism, no analog)

**No analog exists.** RESEARCH.md flags this explicitly: "this repo currently has zero Server Actions." Use the RESEARCH.md Pattern 2 skeleton verbatim (cited from `nextjs.org/docs/app/guides/forms`, version-matched to this repo's `next@16.2.9`):
```typescript
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createServerSupabaseServices } from "@/lib/services/supabase/server";

const editProfileSchema = z.object({
  displayName: z.string().trim().min(1, { error: "Add a name so your coach knows who they're talking to." }),
  goal: z.string().trim().max(2000).optional().default(""),
  locale: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
});

export interface EditProfileState {
  errors?: Record<string, string[]>;
  values: { displayName: string; goal: string; locale: string; timezone: string };
  notice?: string;
}

export async function updateProfileAction(
  prevState: EditProfileState,
  formData: FormData
): Promise<EditProfileState> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();
  const rawValues = {
    displayName: String(formData.get("displayName") ?? ""),
    goal: String(formData.get("goal") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  };

  if (!userResult.ok || !userResult.data) {
    return { values: rawValues, notice: "Your session expired. Sign in again to save." };
  }

  const parsed = editProfileSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: rawValues };
  }

  const userId = userResult.data.id;
  const { error: profileError } = await services.client
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", userId);

  const { error: clientProfileError } = await services.client
    .from("client_profiles")
    .update({ goal: parsed.data.goal, locale: parsed.data.locale, timezone: parsed.data.timezone })
    .eq("id", userId);

  if (profileError || clientProfileError) {
    return { values: rawValues, notice: "Couldn't save just now. Your text is still here — try again?" };
  }

  redirect("/profile");
}
```
**Adaptation notes for consistency with this repo's OWN conventions** (RESEARCH.md's skeleton is a good starting point but is not itself codebase-derived, so cross-check against `core.ts`'s conventions):
- The `services.client.from(...)` direct-Supabase-call style in the skeleton bypasses this repo's `ServiceResult`/repository DI convention. Prefer routing the two writes through the new `ClientProfileRepository.updateSafeFields()` (and a `ProfileRepository.updateDisplayName()` if one doesn't exist) so error handling matches `mapSupabaseError`'s shape, per the "Don't Hand-Roll" table's own guidance to keep error-code branching consistent (`apps/web/lib/services/errors.ts`, `ServiceErrorCode` union).
- Auth re-check via `services.auth.getCurrentUser()` (returns `ServiceResult<User | null>`) matches this repo's `SupabaseAuthServiceImpl.getCurrentUser()` (core.ts lines 47-63) exactly — reuse that, not a raw `client.auth.getUser()` call.
- `zod`'s v4 error param is `error`, not `message` (State of the Art table) — the skeleton above already uses the correct v4 syntax.

---

### `apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx` ("use client" form)

**Analog:** `apps/web/app/login/login-form.tsx` and `apps/web/app/signup/signup-form.tsx` for **tone/structure only** — the state-management primitive differs (these use `onSubmit` + `useState`; the new form uses `useActionState` per D-07, RESEARCH.md Pattern 2). What DOES transfer directly:

**Card + form + space-y-1 shell** (both existing forms, e.g. `signup-form.tsx` lines 77-124):
```tsx
<Card className="w-full max-w-[440px]">
  <h2 className="text-xl">Create your account</h2>
  <form className="mt-6 space-y-1" onSubmit={handleSubmit}>
    <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
    {/* ... */}
    <Button type="submit" variant="primary" fullWidth={true} loading={loading}>
      Create account
    </Button>
  </form>
</Card>
```

**Calm-notice-never-red convention** — `login-form.tsx` line 86 passes failures to `Input`'s `notice` prop (soft tone), never `error` for a session/transport-class failure; `signup-form.tsx` uses `<Alert tone="error">` only for genuine form-wide failures with semibold copy. Per D-07 ("failed save shows a calm notice, never red"), the edit form's save-failure path should use `Input`'s `notice` prop or a form-level `<Alert tone="notice">` (NOT `tone="error"`), reserving `error` tone for zod field-validation failures only if that reads as more urgent than intended — planner's copy discretion, but the mechanism (notice vs error prop) is what to match.

**`useActionState` skeleton** (RESEARCH.md Pattern 2, net-new primitive, no in-repo analog — copy this shape):
```tsx
"use client";

import { useActionState } from "react";
import { updateProfileAction, type EditProfileState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function EditProfileForm({ initial }: { initial: EditProfileState["values"] }) {
  const initialState: EditProfileState = { values: initial };
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-1">
      <Input
        label="Display name"
        name="displayName"
        defaultValue={state.values.displayName}
        error={state.errors?.displayName?.[0]}
        required
      />
      {state.notice && <p className="text-notice text-[14px]">{state.notice}</p>}
      <Button type="submit" variant="primary" fullWidth loading={pending}>
        Save
      </Button>
    </form>
  );
}
```
Use `defaultValue` (uncontrolled), not `value` — see RESEARCH.md's explicit rationale (a full server round-trip already replaces props on each submit; no manual `useEffect` syncing needed). This is also what gives D-07's "mid-edit refresh reverts to last-saved" for free — no special code, the Server Component re-fetches on every navigation.

**Browser-native locale/timezone read (no picker)** — new code, no analog, cite RESEARCH.md's Code Examples section directly:
```typescript
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "America/New_York"
const locale = navigator.language; // e.g. "en-US"
```

---

### `apps/web/components/profile/coach-card.tsx`

**Analogs:** `apps/web/components/chat/avatar/avatar.tsx` (monogram rendering, full file — reuse `Avatar` directly, do not re-derive initials logic) + `apps/web/components/coach/client-list.tsx` (Card-with-rows shape):
```tsx
// Avatar — reuse as-is, it already handles image → initials → placeholder fallback.
<Avatar name={coachDisplayName} size="md" />
```
Per D-10/sketch 003: coach card shows avatar + presence dot + "Your English coach" label + chevron (a link-like row, not a button) — `client-list.tsx`'s `Card className="divide-y divide-border p-0"` + `<div className="flex ... p-4">` row shape is the direct structural template; RESEARCH.md flags the "presence dot" exact rendering as Assumption A3 — deferred to the `profile-and-progress.md` skill reference rather than reverse-engineered here.

---

### `apps/web/components/profile/settings-row.tsx`

**Analogs:** `apps/web/components/kit/theme-toggle.tsx` (control-in-a-row, 56px `min-h-[var(--size-control)]` sizing convention) + `apps/web/components/coach/client-list.tsx` (row-in-Card pattern). Every settings row (Appearance, Text size, Reduced motion, Your agreement, Sign out) needs ≥56px height — reuse the exact token already used by `Button`/`Input`:
```tsx
// button.tsx line 11 / input.tsx line 9 — the repo's one canonical 56px token:
"min-h-[var(--size-control)]"
```

---

### `apps/web/components/profile/a11y-prefs.tsx` + `apps/web/lib/prefs/apply-theme.ts`

**Analog:** `apps/web/components/kit/theme-toggle.tsx` (full file, 49 lines) — this is the ONLY precedent for the `data-*`-attribute + Lightning CSS `light-dark()` technique in this repo, but per RESEARCH.md's correction it is **dev-only and non-persisted**; only the *mechanism* transfers, under a **new, distinctly-named attribute** (`data-theme`, not `data-kit-theme`, so a `/kit` session and a real product session never collide):
```tsx
"use client";
import { useEffect, useState } from "react";

type ThemeOverride = "system" | "light" | "dark";

export function KitThemeToggle() {
  const [mode, setMode] = useState<ThemeOverride>("system");

  useEffect(() => {
    // Flip a data attribute, not an inline style: globals.css carries
    // html[data-kit-theme] color-scheme rules that the build pipeline
    // (Lightning CSS) compiles into its light-dark() polyfill-variable
    // flips. An inline style.colorScheme mutation is invisible to that
    // polyfill, so tokens would never re-resolve (the reported /kit bug).
    if (mode === "system") {
      delete document.documentElement.dataset.kitTheme;
    } else {
      document.documentElement.dataset.kitTheme = mode;
    }
  }, [mode]);
  // ...
}
```
**Extracted, product-facing, persisted version** (RESEARCH.md Pattern 4 — the "one piece of the existing dev tool worth copying verbatim" is the null-means-delete-the-attribute branch):
```typescript
// apps/web/lib/prefs/apply-theme.ts
export function applyThemePref(pref: "light" | "dark" | null): void {
  if (pref === null) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = pref;
  }
}
```
**CSS pitfall (Pitfall 5, load-bearing):** new theme/text-size/reduced-motion rules MUST be authored as `html[data-attribute="value"] { ... }` stylesheet rules in `globals.css`, never as inline `.style.*` mutations — the build pipeline's `light-dark()` polyfill only re-resolves from stylesheet-level rules computed at build time. This was a real, previously-hit bug in this exact codebase (`KitThemeToggle`'s own code comment references it).

---

### `apps/web/lib/validation/profile.ts` (zod schema — NET-NEW, no analog)

**No analog** — first zod usage in the repo (confirmed: `grep zod apps/web/package.json` returns nothing). Use the schema embedded in RESEARCH.md Pattern 2 (reproduced above in the Server Action section) as the starting point, extracted to its own file so both `actions.ts` and any client-side pre-check can import it:
```typescript
import { z } from "zod";

export const editProfileSchema = z.object({
  displayName: z.string().trim().min(1, { error: "Add a name so your coach knows who they're talking to." }),
  goal: z.string().trim().max(2000).optional().default(""),
  locale: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
});
```
**zod v4 syntax note (State of the Art table):** error-message param is `{ error: "..." }`, not v3's `{ message: "..." }` — `message` still works but is deprecated; do not copy v3-style examples from memory or older tutorials.
**Never in `packages/core`** (D-16/XC-02 explicit) — this schema belongs in `apps/web` only.

---

## Shared Patterns

### Grants-precede-RLS (every new table)
**Source:** `supabase/migrations/0001_profiles.sql` lines 13-20 (comment + grants), reinforced by Pitfall 2 (schema `USAGE` — not applicable here since `client_profiles` lives in `public`, already granted).
**Apply to:** `0007_client_profiles.sql` — grants must be written before any `create policy` statement, exactly matching the existing three migrations' ordering.

### Freeze-trigger shape (`security definer`, `set search_path=''`, `WHEN (auth.role() = 'authenticated')`)
**Source:** `supabase/migrations/0005_role_guard.sql` (full file).
**Apply to:** the new `level` freeze trigger in `0007` — copy the shape exactly, only the column name and function/trigger names change.

### RLS-is-the-sole-authz-boundary (no manual id filtering in app code)
**Source:** `supabase/migrations/0004_rls_helpers.sql`'s `private.is_coach_of`, `0006_client_reads_coach_name.sql`'s `private.is_client_of` — both `security definer stable set search_path=''`, never bare-SELECT the table they protect (recursion safety).
**Apply to:** every new Server Component data read (`/profile`, `/profile/edit`, `/coach/clients/[id]`) — query with a plain `.eq("id", ...)`/no filter at all where RLS already scopes it; never add an app-code `WHERE coach_id = ...` guard as a substitute for RLS.

### `getUser()`, never `getSession()`
**Source:** `apps/web/lib/services/supabase/server.ts` docstring + every existing page (`home/page.tsx`, `coach/page.tsx`) re-calling `getCurrentProfile()`/`getUser()` per navigation, and `apps/web/lib/auth/server.ts`'s `getCurrentProfile()` (lines 24-61) which is the canonical wrapper.
**Apply to:** the new Server Action (`updateProfileAction`) MUST independently re-verify `getUser()` — Server Actions are directly POST-reachable and must never trust that the calling page already gated on auth (RESEARCH.md's Security Domain V13 row, official Next.js guidance).

### `ServiceResult<T>` / `ServiceError` — uniform error shape
**Source:** `apps/web/lib/services/errors.ts` (full file) + every repository method in `apps/web/lib/services/supabase/core.ts` (`safely()` wrapper, `mapSupabaseError()`).
**Apply to:** the new `ClientProfileRepository` methods and, ideally, the Server Action's writes (route through the repository rather than a raw `services.client.from(...)` call, per the Pattern Assignments note above).

### Calm/never-red notice convention
**Source:** `Input`'s `notice` prop (`apps/web/components/ui/input/input.tsx` lines 33-34, 74-79) — structural weight only (border-strong), soft `text-notice` color, `IconInfoCircle`; contrasted with `error` (heavier border, `IconAlertCircle`, semibold).
**Apply to:** every new form/notice in `/profile/edit` and the a11y-prefs save-failure path — a failed save is `notice`, not `error` (D-07 explicit).

### 56px control-height token
**Source:** `--size-control` used identically in `Button` (`button.tsx` line 11), `Input` (`input.tsx` line 9), and every new settings row must match.
**Apply to:** `settings-row.tsx`, `a11y-prefs.tsx` controls, any tappable element on `/profile`.

### Named exports, `forwardRef` + `displayName` for focusable controls, `cn()` for class merging
**Source:** every UI-kit component (`Button`, `Input`, `Alert`, `Card`, `Avatar`) — `export const X = forwardRef(...); X.displayName = "X";` for anything focusable, plain `export function X(...)` for non-focusable presentational components (`Card`, `Alert`).
**Apply to:** all new profile components — `coach-card.tsx`/`settings-row.tsx` (non-focusable, plain function) vs. any new focusable control if one is introduced (forwardRef required).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/app/(authenticated)/profile/edit/actions.ts` | service (Server Action) | request-response | Zero existing Server Actions in this codebase (RESEARCH.md explicit finding) — use the RESEARCH.md Pattern 2 skeleton (Next.js official docs, live-verified version match), adapted to route writes through the existing `ServiceResult`/repository convention rather than a raw Supabase call |
| `apps/web/lib/validation/profile.ts` | utility (validation) | transform | Zero existing zod schemas — `zod` is this phase's one net-new dependency (confirmed absent from `apps/web/package.json`); use RESEARCH.md's `editProfileSchema` skeleton, mind the v4 `{ error }` param (not v3 `{ message }`) |
| Persisted a11y-prefs mechanism (`apply-theme.ts` beyond the attribute-flip technique) | utility | event-driven + request-response | `KitThemeToggle` is dev-only/non-persisted (RESEARCH.md's explicit correction to CONTEXT.md's framing) — only the `data-*`-attribute + build-time `light-dark()` polyfill *technique* is reusable; the persistence-to-DB + cross-device-rehydration behavior must be built new, wired through the same Server Action as the other safe fields |

## Metadata

**Analog search scope:** `supabase/migrations/`, `scripts/`, `apps/web/app/(authenticated)/`, `apps/web/app/login/`, `apps/web/app/signup/`, `apps/web/components/{ui,coach,chat/avatar,shell,auth,kit,home}/`, `apps/web/lib/{auth,services/supabase}/`
**Files scanned:** 24 read directly this session (6 migrations, 2 scripts, 4 app pages, 2 auth forms, 8 components, 4 lib files) plus `.claude/skills/sketch-findings-fish/references/profile-and-progress.md` for design-side grounding
**Pattern extraction date:** 2026-07-04

## Conventions

Convention derivation via the shared `gsd-tools.cjs verify conventions --derive` module could not run in this environment (`gsd-tools.cjs` not present under any resolvable `CLAUDE_PLUGIN_ROOT` or `~/.claude/plugins/cache` path — tool unavailable, not a data failure). Per the never-throws contract, this is a skip, not a blocking error: convention derivation skipped (tool binary not found in this environment). The table below is derived manually from direct codebase reads (this session's own file listing + targeted `grep`/`find` counts across `apps/web/{components,lib,app}`, 97 non-story/non-test TypeScript files), not the deterministic tool — treat the entropy/share numbers as directly-observed counts, not the tool's own statistical output.

| Axis | Dominant | Share | Entropy | Status |
|---|---|---|---|---|
| File-name casing | kebab-case (`app-shell.tsx`, `client-list.tsx`, `login-form.tsx`) | 97/97 (100%) | none observed | named contract |
| Identifier casing | camelCase (vars/functions), PascalCase (components/types/interfaces) | consistent across every file read this session | low | named contract |
| Export style | named exports (`export const`/`export function`/`export interface`) | 52 files with named exports vs. 13 with a `export default` — the 13 are overwhelmingly Next.js route `page.tsx`/`layout.tsx` files, which Next.js's App Router itself requires as default exports (a framework constraint, not a style choice) | low once route-file defaults are excluded | named contract |
| Import style | ES module `import`/`import type`, path alias `@/*` for intra-app, bare package name (`@fish/core`, `@fish/supabase`) for workspace packages | 27 `import type` occurrences observed across the same file set; zero `require()`/CJS usage anywhere in `apps/web` | low | named contract |

**Contested hotspots (author's choice):** None found within `apps/web`'s own scope this session — all four axes were strongly dominant (near-100%) with no genuinely contested split observed in the files read. For reference, this repository's prototype intentional-contested-split pattern (documented for future GSD conventions work, not applicable to this phase's `apps/web`-only file set) is the **CJS↔SDK dual resolver**: `bin/lib/**` is CJS (`module.exports`/`require`) while `sdk/src/**` is ESM (`export`/`import`) — each half is internally consistent per-directory and contested only when compared repo-wide across that boundary. None of Phase 4's files touch `bin/lib/**` or `sdk/src/**`, so this split does not apply here; reviewers/planners should simply match `apps/web`'s own near-unanimous ESM/named-export/kebab-case convention throughout.
