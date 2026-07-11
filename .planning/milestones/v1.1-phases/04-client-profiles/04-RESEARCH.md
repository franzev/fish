# Phase 4: Client Profiles - Research

**Researched:** 2026-07-04
**Domain:** Postgres/Supabase column-privilege + RLS defense-in-depth; Next.js 16 App Router Server Actions; client-side-instant + server-persisted accessibility preferences
**Confidence:** HIGH (core DDL/grant behavior live-verified against the running local stack; Next.js/zod claims verified against current official docs; UI/theme claims grounded directly in this repo's own code)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema topology**
- **D-01:** New fields live in a **separate `client_profiles` table**, 1:1 with `profiles` (PK = `id` references `public.profiles(id)` on delete cascade). Keeps coach rows lean, gives the field-freeze its own clean surface, and matches the success-criteria naming. `display_name` **stays on `profiles`** (existing column + existing own-profile RLS update policy); the edit flow writes display name to `profiles` and the rest to `client_profiles`.
- **D-02:** `client_profiles` is **auto-provisioned for clients** so a client always has a row to read/edit (extend the `handle_new_user` path / add an on-insert trigger for `role = 'client'`, plus backfill in the seed). The exact trigger vs. seed-backfill split is a planner detail; the guarantee is "no client is ever missing their row."
- **D-03:** **Goal/role-context is one freeform field** (a single gentle prompt, one text column) — least typing, calmest for the ADHD audience. Not two structured fields.
- **D-04:** Accessibility prefs are **nullable columns on `client_profiles`** (`theme_pref`, `text_size_pref`, `reduced_motion_pref`). **NULL = follow the system setting**; a non-null value is an explicit override. Consent is fields on the same table (`consented` boolean, `consented_at` timestamptz, `consent_version` text).

**Edit flow & entry point**
- **D-05:** **Minimal `/profile` route this phase** — a quiet link from the client home reaches it; the full validated bottom-nav shell (Home/Progress/Messages/Profile) is deferred to its own phase (no dead Progress/Messages tabs shipped now).
- **D-06:** **Dedicated edit screen** at `/profile/edit`. The profile view stays a calm, read-only essentials + coach-card + settings surface with **no primary button** (per sketch 003 winner A); the edit screen carries the **single Save primary action**.
- **D-07:** Save is a **Next.js Server Action** writing through the existing own-profile RLS update policy (`profiles`) and the new safe-column grant (`client_profiles`), then returns to `/profile`. The form **prefills from the DB** on load; a **failed save keeps the typed text** and shows a calm `notice` (never red); a mid-edit refresh reverts to last-saved values — the same honest model as the v1.0 auth forms. No client-side optimistic path this phase (optimistic lifecycle belongs to chat, Phase 8).

**Protected-field freeze (the reused write-safety discipline)**
- **D-08:** **Defense-in-depth, two layers.** (1) **Column-scoped UPDATE grant** — `GRANT UPDATE (goal, locale, timezone, theme_pref, text_size_pref, reduced_motion_pref, consented, consented_at, consent_version) ON public.client_profiles TO authenticated`; `level` is **never** granted to `authenticated`, so a client update touching it is denied at the Postgres privilege layer. (2) A **BEFORE-UPDATE trigger** that raises if a protected column (`level`) is changed by an `authenticated` caller (WHEN `auth.role() = 'authenticated'`, so `service_role` seed writes pass) — mirrors the shipped `prevent_role_self_escalation` trigger (0005) for a consistent, testable, centralized pattern with a clear error. `role` remains protected by the existing 0005 trigger on `profiles`.
- **D-09:** `verify:rls` must assert the freeze from the client's perspective (a client's attempt to change `level` is rejected at the DB) — see the RLS assertion set below.

**Coach read-only view**
- **D-10:** The coach sees **identity (display name) + goal/role-context + level** on the client detail. **Accessibility prefs and consent status are hidden** — they're the client's personal settings, not coach-relevant this phase. Level is shown **as data, never a grade**.
- **D-11:** Route `/coach/clients/[id]`; the currently-inert coach **client-list rows become links** to it. Access is **RLS-gated by `is_coach_of`** (default-deny); an unassigned coach gets a calm not-found/denied state with **no cross-client leak** (the read simply returns nothing under RLS).

**Consent & accessibility preferences**
- **D-12:** **One combined terms + privacy consent** (not granular), recorded as versioned fields (`consented` / `consented_at` / `consent_version`). Acknowledged **on the profile** (a calm "your agreement" affordance recording the current version via the same Server Action). **Non-blocking this phase** — no hard gate that competes with the Phase 5 onboarding first-run; the requirement is "record consent as fields," which this satisfies.
- **D-13:** **Three text-size steps** (e.g. Default / Large / Larger) mapping to a root font-size scale; default = system/browser. Small, calm, big tap targets — no settings buffet (PROF-03 cap of three prefs total: theme, text-size, reduced-motion).
- **D-14:** Preferences **apply instantly** (client-side, like the existing v1.0 theme toggle) **and persist to `client_profiles`** so they rehydrate on load across devices. Theme resolves through the existing `light-dark()` ladder; reduced-motion composes with `prefers-reduced-motion`; text-size default follows the browser. Stored value is an override; absence follows the system.
  - **Research correction:** see Summary/Pattern 4 below — "the existing v1.0 theme toggle" (`KitThemeToggle`) is dev-only and non-persisted; this decision's *intent* (instant-apply, persisted, following-system-by-default) is unaffected, but the implementation must build the persistence mechanism new, reusing only the `data-*`-attribute + Lightning CSS technique `KitThemeToggle` demonstrates.

**Cross-cutting (woven per XC-01/02/03)**
- **D-15:** **RLS assertions to add to `verify:rls`** for `client_profiles`: self-read, self-safe-update (succeeds), assigned-coach-read (succeeds), unassigned-coach-denial, cross-client-denial, protected-field-freeze (client `level` update rejected). `pnpm build` green (XC-01).
- **D-16:** `zod` v4 validation applies to the **profile edit payload** in `apps/web` and (where a command path exists) the Server Action — never in `packages/core` (XC-02). No `pg_jsonschema` config backstop needed here (profile columns are fixed, not data-driven config — that backstop lands in Phases 5/6).
- **D-17:** Every client-facing screen holds the **design line** — one primary action, assigned-never-chosen, 56px targets, monochrome, calm non-scolding copy, no lost work on refresh; the `sketch-findings-fish` skill is loaded before building any client UI (XC-03).

### Claude's Discretion
- Exact provisioning mechanism for `client_profiles` rows (trigger extension vs on-insert trigger vs seed-backfill) — planner/researcher decides, guarantee in D-02 holds. **Research recommendation: Option B, a separate `AFTER INSERT ON public.profiles` trigger** — see Pattern 3.
- Column names/types, migration numbering (continues from `0006`), and how the edit Server Action splits the two-table write.
- Copy strings (calm, sentence case, soft `notice` tone), monogram/avatar rendering, and the precise "your agreement" affordance styling — apply the design line and sketch findings.

### Deferred Ideas (OUT OF SCOPE)
- **Full bottom-nav shell** (Home/Progress/Messages/Profile) — validated in the sketches but its own phase; only a minimal `/profile` route ships now.
- **Progress tab / milestone-journey UI** — separate tab, not this phase (metrics never live on the profile).
- **Coach editing of `level`** and any assignment/reassignment UI — assignment stays seed-only (deferred: ASGN-01 trigger = volume outgrows seed).
- **Full privacy tooling** (export/delete/retention/audit) — v1.1 captures consent *fields* only; the privacy milestone precedes public launch.
- **Granular / multi-document consent** and consent as a hard first-run gate — one combined versioned acknowledgement now; a gated first-run flow can pair with Phase 5 onboarding if a coach validates the need.

None of these block Phase 4 — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | A client can view their own profile | Pattern 1 (RLS self-read policy, reusing the `profiles` self-read shape from 0001); Architecture Diagram's client read path |
| PROF-02 | A client can edit their own safe fields — display name, goal/role-context, locale, timezone (locale/timezone prefilled from the browser, never a picker) | Pattern 2 (Server Action + `useActionState`, split two-table write); Code Examples' browser-native `Intl.DateTimeFormat`/`navigator.language` snippet |
| PROF-03 | A client can set ≤3 accessibility preferences (theme, text-size, optional reduced-motion), defaulting to system | Pattern 4 (instant-apply + persisted a11y prefs, corrected from CONTEXT.md's "existing toggle" framing); Pitfall 5 (stylesheet-rule-not-inline-style requirement) |
| PROF-04 | A client records required consent as fields only (boolean + timestamp + version) | D-12 reuses the same Server Action write path as Pattern 2 — no new mechanism, just additional columns in the same `client_profiles` UPDATE |
| PROF-05 | A client cannot alter protected fields (role, coach-owned level) — enforced at the database | Pattern 1 — live-verified five-case DDL/grant/trigger interaction table; Pitfalls 1/3/4 (testing methodology + grant-atomicity + `information_schema` reporting gotchas) |
| PROF-06 | A coach can open an assigned client's profile as a read-only detail view; unassigned coaches denied | Pattern 1's RLS policy set (reusing `private.is_coach_of` from 0004 verbatim); Architecture Diagram's coach path; Security Domain's "unassigned coach guesses UUID" threat row |
</phase_requirements>

## Summary

This phase extends four already-shipped patterns (table-scoped grants, the `is_coach_of`/`is_client_of` RLS helper pair, the `prevent_role_self_escalation` freeze-trigger shape, and the `ServiceResult`/repository DI layer) rather than inventing new architecture. The one genuinely new mechanism is the **column-scoped `GRANT UPDATE (...)`** for the `level` freeze (D-08) — this was live-tested against the actual running local Postgres 17.6 + PostgREST stack in this session (not assumed from docs), and the grant layer behaves exactly as D-08 expects: an `UPDATE` naming the ungranted `level` column is rejected **before the trigger fires**, with a distinct Postgres error code (`42501`, HTTP 403) from the trigger's own error (`P0001`, HTTP 400). Both layers were independently verified to fire in the correct order, are mutually reinforcing (removing one still leaves the other), and the `service_role` bypass path was verified to work correctly for seed writes.

The second genuinely new mechanism is the **Server Action + `useActionState` form pattern** — this repo currently has zero Server Actions; every existing form (`login-form.tsx`, `signup-form.tsx`) is a `"use client"` component with `useState` + `onSubmit` calling Supabase browser methods directly. Phase 4 is the first phase to introduce the Next.js 16 canonical Server Action form pattern, which this research verified against the current (2026-06-23-dated) official Next.js docs.

The third finding worth flagging up front: the CONTEXT.md's characterization of "the existing theme toggle" as a reusable, persisted mechanism is **not accurate as written** — the only theme-toggle code in the repo (`KitThemeToggle`) is an explicitly dev-only, non-persisted, in-memory `data-kit-theme` attribute flip used solely on `/kit` to let both themes be visually judged, with a code comment stating "clients never choose themes." Phase 4 is the first phase to build a real, product-facing, persisted theme override — it can and should reuse the *mechanism* (the `html[data-*]` attribute + Lightning CSS `light-dark()` polyfill approach), but there is no existing persisted user-preference plumbing to extend; it must be built new, under a new attribute name.

**Primary recommendation:** Mirror 0005's trigger shape exactly for the `level` freeze, add the column-scoped grant as instructed by D-08, verify the interaction via the six `verify-rls.ts` assertions using the **anon-key sign-in pattern already established** in that harness (never a service-role/`SET ROLE` sandbox test — this session's own sandbox testing hit a false-pass specifically because of Postgres table-ownership semantics when testing via `SET ROLE` from the `postgres` connection role; only a genuine separate-role HTTP-level test through PostgREST is trustworthy).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Profile read (own + coach-assigned-client) | Database / Storage (RLS) | API (Server Component read) | RLS is the sole authz boundary per this repo's established convention; the Server Component just re-reads `getUser()` and queries through it |
| Profile safe-field write (display_name, goal, locale, timezone, a11y prefs, consent) | API / Backend (Server Action) | Database / Storage (grant + RLS `WITH CHECK`) | The Server Action is the single write path; the DB grant + RLS are the enforcement, not the Action's own logic |
| Protected-field freeze (`level`, `role`) | Database / Storage (grant + trigger) | — | Must be un-bypassable by any client-reachable code path — DB is the only tier that can guarantee this |
| Coach read-only client detail | Database / Storage (RLS via `is_coach_of`) | API (Server Component) | Same RLS-is-the-boundary discipline as client read |
| Accessibility prefs apply-instantly | Browser / Client (CSS attribute + `useEffect`) | API (Server Action persists on Save) | Instant apply is client-tier by nature (no round-trip); persistence needs the server write path so it rehydrates cross-device |
| Locale/timezone auto-fill | Browser / Client (`Intl.DateTimeFormat().resolvedOptions()`, `navigator.language`) | API (Server Action stores the read value) | Browser is the only tier that knows the visitor's actual locale/timezone; server only stores what the browser reports |
| `client_profiles` row auto-provisioning | Database / Storage (trigger or seed) | — | Must guarantee "no client ever missing a row" independent of any app-tier code path (client-side navigation could race an app-tier provisioning call) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 4.4.3 `[VERIFIED: npm registry]` | Edit-payload validation in `apps/web` (XC-02) | Locked by STATE.md as the one net-new runtime dep this milestone; official Next.js forms guide uses zod as its own canonical server-validation example `[CITED: nextjs.org/docs/app/guides/forms]` |
| `@supabase/ssr` | 0.12.0 (already installed, matches npm `latest`) `[VERIFIED: npm registry]` | Server Action's Supabase client (cookie-based session) | Already the repo's server-client mechanism (`apps/web/lib/services/supabase/server.ts`) — reuse verbatim, do not hand-roll a second client factory |
| `@supabase/supabase-js` | 2.110.0 (already installed) `[VERIFIED: npm registry]` | Underlying typed client | Already pinned repo-wide |

### Supporting (already installed, reuse — no new packages)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | ^0.7.1 | Variant classes for any new component (e.g. a settings-row component) | Every existing UI-kit component (`Button`, `Input`, `Alert`) uses this — match the pattern |
| `@tabler/icons-react` | ^3.44.0 | Icons for coach card, settings rows, chevrons | Single icon set per AGENTS.md; `IconUser` already used in `Avatar` |
| `colorjs.io` | ^0.6.1 | Only if a new theme token needs contrast verification | Already used by `tests/contrast.test.ts` — do not add a second color library |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Column-scoped `GRANT UPDATE (...)` for the freeze | RLS `WITH CHECK` clause comparing `new.level = old.level` | D-08 already locks the two-layer grant+trigger approach; a `WITH CHECK` clause is a *third* possible layer but is redundant with the trigger and was not requested — do not add it, it increases policy complexity without new protection |
| `useActionState` Server Action | Client-side `onSubmit` (matching every existing form) | D-07 explicitly locks the Server Action approach as this phase's discipline-setting pattern; the existing client-side pattern remains for auth forms only |
| New `data-profile-theme` attribute for persisted theme | Reusing `data-kit-theme` | `data-kit-theme` is dev-only-named and scoped to `/kit`'s preview toggle; reusing the literal attribute name would conflate a throwaway dev tool with a real user preference — use a distinctly named attribute (e.g. `data-theme`) so the two never collide if `/kit` and a real session are open in the same browser during development |

**Installation:**
```bash
pnpm --filter @fish/web add zod
```

**Version verification:** `npm view zod version` → `4.4.3` (current `latest` dist-tag, checked live this session). `npm view @supabase/ssr version` → `0.12.0`, matching the version already pinned in `apps/web/package.json` — no upgrade needed.

## Package Legitimacy Audit

Only one external package is newly introduced this phase: `zod`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `zod` | npm | ~6 yrs (long-established) | very high (foundational validation library, used directly in Next.js's own official forms guide) | `github.com/colinhacks/zod` | `[OK]` (live-checked this session via `slopcheck install zod --ecosystem npm`) | Approved |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

No `postinstall` script on `zod` (`npm view zod scripts.postinstall` returned empty) — no suspicious install-time behavior. `slopcheck` was installed and run live this session (`pip3 install slopcheck`, then `slopcheck install zod --ecosystem npm` from `apps/web/`); it attempted a real `npm install zod` as part of its check, which failed harmlessly on this pnpm workspace's `workspace:*` protocol dependencies (expected — pnpm is this repo's only package manager) and left no stray `package-lock.json` or modified `package.json`. Verified via `git status --porcelain` immediately after.

## Architecture Patterns

### System Architecture Diagram

```text
Browser (client role)
  │
  │ navigates to /profile
  ▼
Server Component (/profile/page.tsx)
  │  1. getUser() [never getSession()] via createServerSupabaseServices()
  │  2. re-check role === "client" (wrong-door guard, matches /home, /coach)
  │  3. SELECT profiles.display_name + client_profiles.* (own row, RLS self-read)
  │  4. SELECT coach_clients → profiles (assigned coach display_name, RLS "client reads own coach")
  ▼
Renders: essentials-only profile (identity, coach card, settings rows) — NO primary button
  │
  │ taps "Edit" (a settings-row link, or an edit affordance — NOT a primary button
  │  per D-06; the profile view itself carries none)
  ▼
Server Component (/profile/edit/page.tsx)
  │  same getUser()+role guard; prefills form fields from the SAME two-table read
  ▼
Client Component (edit form, "use client")
  │  useActionState(updateProfileAction, initialState)
  │  <form action={formAction}> — Enter always submits (existing form convention)
  ▼
Server Action (updateProfileAction, "use server")
  │  1. re-verify getUser() — Server Actions are directly POST-reachable, never trust
  │     the caller only rendered the authenticated page (Next.js official warning)
  │  2. zod .safeParse() the FormData → typed payload
  │  3. on failure: return { errors, values: rawFormData } so the client re-renders
  │     the SAME typed values, no fields cleared (D-07 "failed save keeps typed text")
  │  4. split write: UPDATE profiles SET display_name (existing own-profile RLS policy)
  │                  UPDATE client_profiles SET goal, locale, timezone, ... (new safe-column grant + RLS)
  │  5. on success: redirect("/profile") (revalidates via Server Component re-fetch)
  ▼
Postgres (evaluated in this order for the client_profiles UPDATE):
  1. Table-level GRANT UPDATE check — is the role authenticated at all? (already granted)
  2. Column-level GRANT UPDATE check — does the UPDATE name ONLY granted columns?
     NAMES level? → 42501 permission denied, REJECTED HERE, trigger never runs.
  3. RLS UPDATE policy USING/WITH CHECK — is id = auth.uid()? (own-row only)
  4. BEFORE UPDATE trigger (prevent_level_change, WHEN auth.role()='authenticated')
     — second independent layer; catches level changes even if grants are
     ever accidentally widened in a future migration (verified live this session)
  5. Row written.

Coach path (parallel, read-only):
Browser (coach role) → /coach → clicks a (now-linked) client row
  → /coach/clients/[id] → Server Component → getUser() + role==="coach" guard
  → SELECT client_profiles WHERE is_coach_of(id) — RLS-gated; unassigned coach's
    SELECT returns zero rows (default-deny), rendered as a calm not-found state,
    never a cross-client leak.
```

### Recommended Project Structure
```
supabase/migrations/
├── 0007_client_profiles.sql       # table + grants + RLS policies + auto-provision trigger
└── 0008_level_freeze.sql          # (or combined into 0007) column grant narrowing + freeze trigger

apps/web/
├── app/(authenticated)/
│   ├── profile/
│   │   ├── page.tsx               # read-only essentials view (Server Component)
│   │   └── edit/
│   │       ├── page.tsx           # Server Component: prefetch + render the client form
│   │       ├── edit-profile-form.tsx   # "use client": useActionState + form fields
│   │       └── actions.ts         # "use server": updateProfileAction
│   └── coach/
│       └── clients/
│           └── [id]/
│               └── page.tsx       # coach read-only detail (Server Component)
├── components/
│   └── profile/
│       ├── coach-card.tsx         # reuses existing Avatar component
│       ├── settings-row.tsx       # new: ≥56px row, label + control/chevron
│       └── a11y-prefs.tsx         # theme/text-size/reduced-motion controls, "use client"
├── lib/
│   ├── services/supabase/
│   │   └── (extend core.ts): ClientProfileRepository (findById, updateSafeFields)
│   └── prefs/
│       └── apply-theme.ts         # client-side instant-apply helper (data-theme attribute)
└── lib/validation/
    └── profile.ts                 # zod schema for the edit payload (apps/web only, never packages/core per D-16)
```

### Pattern 1: Column-Scoped Freeze (D-08), Live-Verified

**What:** A table grants `UPDATE` to `authenticated` only on the explicit safe-column list; the protected column is never named in that grant. A `BEFORE UPDATE` trigger independently re-checks the same protected column, exempting `service_role` via its `WHEN` clause.

**When to use:** Any column that must survive even a future accidental grant-widening (defense-in-depth), which is exactly D-08's stated intent ("consistent, testable, centralized pattern").

**Verified DDL** (mirrors `0001_profiles.sql`'s grant-ordering comment and `0005_role_guard.sql`'s trigger shape exactly):
```sql
-- Migration 0007 (or split 0007/0008) — apply to the NEW client_profiles table.

-- Table grants FIRST (Postgres privilege layer, evaluated before RLS) — see
-- 0001_profiles.sql's comment for why. SELECT is table-wide (RLS narrows rows);
-- UPDATE is column-scoped to the explicit safe list. `level` is never named here.
grant select on public.client_profiles to authenticated;
grant update (
  goal, locale, timezone,
  theme_pref, text_size_pref, reduced_motion_pref,
  consented, consented_at, consent_version
) on public.client_profiles to authenticated;
grant select, insert, update, delete on public.client_profiles to service_role;

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

create policy "coach reads assigned client's client_profile"
  on public.client_profiles
  for select
  to authenticated
  using (private.is_coach_of(id)); -- reuse 0004's helper verbatim

-- Second, independent layer: mirrors 0005_role_guard.sql's shape exactly.
create or replace function public.prevent_level_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.level is distinct from old.level then
    raise exception 'level cannot be changed by this caller';
  end if;
  return new;
end;
$$;

create trigger prevent_level_change
  before update on public.client_profiles
  for each row
  when (auth.role() = 'authenticated') -- service_role (seed) bypasses this WHEN clause
  execute function public.prevent_level_self_escalation();
```

**Live-verified behavior** (tested this session against the actual running local stack — Postgres 17.6.1.140, PostgREST v14.14 — via real HTTP calls with a minted `authenticated`-role JWT, not a `SET ROLE` sandbox, for the reason explained in Pitfall 1 below):

| Case | Request | Result | Mechanism |
|------|---------|--------|-----------|
| 1 | `authenticated` PATCHes only a granted column (`safe_field`/`goal`-equivalent) | `200 OK`, row updated | Grant + RLS pass normally |
| 2 | `authenticated` PATCHes only `level` | `403 Forbidden`, `{"code":"42501","message":"permission denied for table ..."}` | **Grant layer** — trigger never runs |
| 3 | `authenticated` PATCHes a granted column AND `level` in the same request | `403 Forbidden`, same `42501` — the ENTIRE statement is rejected, no partial write | Grant layer rejects atomically if the statement names ANY ungranted column |
| 4 | `service_role` PATCHes `level` directly (the seed path) | `200 OK`, row updated | `WHEN (auth.role() = 'authenticated')` correctly exempts service-role callers |
| 5 (defense-in-depth check) | `level` is *deliberately* also granted to `authenticated` (simulating a future accidental widening), then `authenticated` PATCHes `level` | `400 Bad Request`, `{"code":"P0001","message":"level cannot be changed by this caller"}` | **Trigger layer** independently catches it — proves the two layers are genuinely independent, not one masking a dead second layer |

This directly answers targeted question 1: **grants ARE evaluated before RLS/the trigger** — case 2/3 never reach the trigger (no `P0001`, only `42501`). The trigger is not dead code: case 5 proves it fires independently if the grant layer is ever weakened.

### Pattern 2: Next.js 16 Server Action + `useActionState`, Split Two-Table Write

**What:** A `"use server"` action receiving `(prevState, formData)`, validated with zod, split into two `UPDATE` statements against the session-scoped Supabase server client.

**Source:** `[CITED: nextjs.org/docs/app/guides/forms, version 16.2.10, lastUpdated 2026-06-23]` — matches this repo's installed `next@16.2.9` almost exactly (patch-level behind; no relevant behavior change between .9 and .10 for this pattern).

```typescript
// apps/web/app/(authenticated)/profile/edit/actions.ts
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
  // Next.js's own guidance: Server Actions are directly POST-reachable, so
  // re-verify auth here even though the page that renders this form already
  // gated on getUser() (mirrors this repo's existing per-page wrong-door
  // guard discipline, not a new pattern).
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
    // D-07: failed validation returns the SAME typed values — nothing is cleared.
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
    // Calm, soft-notice tone — never scolds (AGENTS.md rule 6).
    return { values: rawValues, notice: "Couldn't save just now. Your text is still here — try again?" };
  }

  redirect("/profile");
}
```

```tsx
// apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx
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
      {/* goal, locale (read-only confirmed value), timezone (read-only confirmed value) */}
      {state.notice && <p className="text-notice text-[14px]">{state.notice}</p>}
      <Button type="submit" variant="primary" fullWidth loading={pending}>
        Save
      </Button>
    </form>
  )
}
```

**Why `defaultValue` (uncontrolled), not `value`:** The official pattern keeps the form uncontrolled between renders — `useActionState` re-renders with `state.values` as `defaultValue` only on the initial mount of a fresh state object (i.e., after a server round-trip). Because a full server round-trip already replaces the component tree's props, `defaultValue` correctly reflects the post-submit values without needing manual `useEffect` syncing.

**Mid-edit refresh reverts to last-saved (D-07):** This falls out for free from Server Components: a hard refresh re-runs `/profile/edit`'s Server Component, which re-fetches from the DB (not from any client-side cache), so unsaved typed text is gone and the DB's last-saved values reappear. No special code needed — this is the "same honest model as the v1.0 auth forms" the CONTEXT.md references, because those forms also have no client-side persistence across a hard navigation.

### Pattern 3: Auto-Provisioning `client_profiles` (D-02, Claude's Discretion)

Three options were evaluated:

| Option | Mechanism | Tradeoff |
|--------|-----------|----------|
| A. Extend `handle_new_user()` | One `INSERT` into `client_profiles` inside the existing 0002/0006-hardened trigger, gated `if new-role would be client` | Simplest; but `handle_new_user()` fires on `auth.users` insert, BEFORE `profiles.role` is settled by the same function body (role is hard-coded `'client'` in the same INSERT) — actually straightforward since role is always `'client'` at signup (AUTH-01), so this is safe: every signup is a client, so every signup gets a `client_profiles` row unconditionally |
| B. Separate `AFTER INSERT ON profiles` trigger | `WHEN (new.role = 'client')`, inserts into `client_profiles` | Decouples from the auth-hardening surface entirely; slightly more indirection (two functions to read together) but avoids ever touching the already-hardened, security-critical `handle_new_user()` body again |
| C. Seed-only backfill | `scripts/seed.ts` inserts client_profiles rows for the 3 dev clients | Does NOT satisfy D-02's "no client is ever missing their row" guarantee for **real signups** — a hosted-launch client created through the real signup flow (not the seed script) would have no `client_profiles` row, and `/profile` would 404/error on first load |

**Recommendation: Option B** (separate `AFTER INSERT ON public.profiles` trigger, `WHEN (new.role = 'client')`). Rationale: `handle_new_user()` is explicitly called out in its own code comment as hardened with "all four hardening elements... mandatory, not a subset" — touching that function again to add unrelated business logic (a second table's row provisioning) increases the blast radius of any future edit to the auth-critical path for no benefit, since a clean second trigger on `profiles` achieves the identical guarantee with full isolation. Because every profile is created via that same `on_auth_user_created` trigger, an `AFTER INSERT ON profiles` trigger fires in the same transaction and provides the identical "never missing" guarantee. Seed script (Option C) is **additionally required regardless** as a backfill safety net for any already-existing seeded accounts from before this migration runs (belt-and-suspenders, not instead-of).

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

Plus a `scripts/seed.ts` backfill (`upsert`/`insert ... on conflict do nothing`) for the three existing dev clients seeded before this migration runs, so `pnpm seed` remains idempotent for both fresh and previously-seeded local databases.

### Pattern 4: Instant-Apply + Persisted Accessibility Preferences

**Correction to CONTEXT.md's framing:** There is no existing persisted theme mechanism to extend (see Summary). The correct approach is to **replicate the mechanism** the existing `KitThemeToggle` demonstrates (a `data-*` attribute the Lightning CSS build compiles `light-dark()` polyfill rules against — verified live in the compiled `storybook-static/assets/iframe-*.css` output: `html[data-kit-theme=dark]{--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}`), under a **new, distinctly-named attribute** so a product session and an open `/kit` tab never collide, plus add a genuine persistence layer that does not exist today.

```css
/* apps/web/app/globals.css — NEW rules, added alongside (not replacing) the
   existing html[data-kit-theme] rules. Must be authored as stylesheet rules,
   not applied via inline style, for the same Lightning CSS compile-time
   reason documented in the existing data-kit-theme comment (Pitfall 5 below). */
html[data-theme="light"] { color-scheme: light; }
html[data-theme="dark"]  { color-scheme: dark; }

/* text-size steps (D-13): three steps scaling the root, so all rem-based
   spacing/type scales with it. Values are illustrative — pick real numbers
   during planning; the MECHANISM (a root-level CSS custom property switched
   by a data attribute) is the verified part. */
html[data-text-size="large"]  { font-size: 112.5%; } /* e.g. 18px effective base */
html[data-text-size="larger"] { font-size: 125%; }    /* e.g. 20px effective base */
/* default/unset = 100% = the existing 17px body base, untouched */
```

```typescript
// apps/web/lib/prefs/apply-theme.ts — instant client-side apply, "use client" caller.
// NULL/absent stored pref = follow system (delete the attribute, same as
// KitThemeToggle's mode==="system" branch — this IS the one piece of the
// existing dev tool worth copying verbatim).
export function applyThemePref(pref: "light" | "dark" | null): void {
  if (pref === null) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = pref;
  }
}
```

Persistence: the Server Action (Pattern 2) writes `theme_pref`/`text_size_pref`/`reduced_motion_pref` to `client_profiles` on Save, exactly like the other safe fields. On load, the Server Component reads the stored value and the settings-row Client Component calls `applyThemePref(...)`/equivalent in a `useEffect` on mount (matching `KitThemeToggle`'s own `useEffect` pattern) so the preference is visually applied before the user touches anything, without introducing a flash-of-wrong-theme (the existing `color-scheme: light dark` base rule already prevents FOUC for the *system* default; an explicit override necessarily has a brief hydration-timing window, same tradeoff `KitThemeToggle` already accepts).

**Reduced-motion composition:** The existing global rule is `@media (prefers-reduced-motion: reduce) { ... }`. A stored `reduced_motion_pref = true` override needs an *additional* rule that doesn't depend on the media query, e.g. `html[data-reduced-motion="true"] { ...same declarations... }`, so an explicit opt-in works even on an OS that hasn't set the system-level flag. `reduced_motion_pref = false` (explicit opt-out while the OS has reduce-motion on) is a real edge case PROF-03 implies is possible ("optional reduced-motion override") — the CSS would need `html[data-reduced-motion="false"] { animation-duration: revert !important; ... }` to override the media query, which is unusual but achievable with equal specificity via the same attribute-selector approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column write-privilege narrowing | App-code "only allow these keys" object filtering before the Supabase call | Postgres `GRANT UPDATE (columns...)` | App-code filtering is bypassable by any direct API/curl call with a valid JWT; the DB grant is not — this is the whole point of PROF-05's "enforced at the database" requirement |
| Role/level self-escalation prevention | A single check in the Server Action ("if body contains level, reject") | The existing trigger pattern (mirror 0005) + grant | Server Action code is app-tier and does not protect against a client calling the Supabase REST API directly, bypassing the web app entirely |
| Auth client (cookies, session) | A new fetch-based Supabase wrapper | `createServerSupabaseServices()` / `createServerSupabaseClient()` (already exists in `apps/web/lib/services/supabase/server.ts`) | Already handles the `getUser()`-not-`getSession()` discipline, cookie write-suppression for Server Components, and DI testability |
| Contrast/token verification for new a11y-related CSS | A manual visual check per theme/text-size combination | Extend `apps/web/tests/contrast.test.ts`'s existing CSS-parsing approach if new tokens are added | The existing test parses `globals.css` directly and is already the single source of truth for AA compliance — a parallel manual process would drift |
| Timezone/locale detection | A geoip lookup or a manual picker | `Intl.DateTimeFormat().resolvedOptions().timeZone` + `navigator.language` (browser-native, zero dependency) | PROF-02 explicitly requires "never a picker"; both APIs are universally supported in evergreen browsers and require no library |
| Server Action error/success state shape | A bespoke ad-hoc return type per action | The existing `ServiceResult<T>`/`ServiceError` shape (`apps/web/lib/services/errors.ts`), or a thin action-specific state object that WRAPS it (as shown in Pattern 2) | Keeps error-code branching (`auth`/`database`/`network`) consistent with every other part of the app; the repositories should return `ServiceResult`, and the action adapts that into the `useActionState` shape |

**Key insight:** Every "don't hand-roll" item above already has a DIRECT precedent in this codebase (0005's trigger, the server-client factory, the contrast test, the `ServiceResult` shape) — this phase is explicitly building the SECOND instance of a pattern the FIRST instance already proved out in Phases 1-3. Deviating from the established shape (e.g., inventing a new error-handling convention for just this phase) would itself be the anti-pattern.

## Runtime State Inventory

Not applicable — this is a greenfield schema addition (`client_profiles` is a brand-new table), not a rename/refactor/migration of existing data. No existing runtime state (stored data, live service config, OS-registered state, secrets, or build artifacts) references anything this phase renames or moves.

## Common Pitfalls

### Pitfall 1: `SET ROLE`/service-role sandbox testing produces false passes for grant-boundary tests
**What goes wrong:** Testing a column-grant freeze by connecting as the Supabase local `postgres` role and issuing `SET ROLE authenticated` inside a `DO` block appears to show the trigger (not the grant) as the blocking layer, suggesting the grant check is bypassed.
**Why it happens:** In Supabase's local Postgres setup, `postgres` is a **member of** `authenticated`, `service_role`, `anon`, etc. (verified live this session via `pg_auth_members`), AND `postgres` (or whichever role created the table) is the table's **owner**. Table owners implicitly bypass all privilege checks in Postgres, regardless of an in-session `SET ROLE`. This produces test output that looks like the grant layer "passed through" and the trigger caught it — a false signal about which layer is actually enforcing.
**How to avoid:** Never test grant-layer behavior via a `SET ROLE`/`DO` block sandbox from the `postgres` connection. Test through the **real PostgREST HTTP path** with a minted or genuine `authenticated`-role JWT (exactly what `scripts/verify-rls.ts` already does by signing in via `signInWithPassword` with the anon/publishable key) — this session's live verification against real PostgREST (not a SQL sandbox) is what produced the trustworthy `42501` vs `P0001` distinction documented in Pattern 1.
**Warning signs:** Any test methodology using `set local role` or `set role` from a superuser-adjacent or table-owning connection to validate a client-facing privilege boundary.

### Pitfall 2: Schema-level `USAGE` grant is a separate, easy-to-forget privilege from table grants
**What goes wrong:** A table gets `GRANT SELECT/UPDATE ... TO authenticated`, but queries against it still fail with "permission denied for schema."
**Why it happens:** Postgres privilege model requires `USAGE` on the containing schema as a prerequisite for any object-level grant to take effect for a role that isn't already a schema owner. This surfaced directly during this session's own sandbox setup (a `permission denied for schema grant_sandbox` error appeared before the grant-vs-trigger test could even run) — not a hypothetical.
**Why it doesn't affect this phase directly:** `client_profiles` lives in `public`, and `authenticated`/`service_role` already have `USAGE` on `public` from the original project setup — so this specific pitfall is a non-issue for this phase's actual migration. It is documented here because it is the kind of error a planner/implementer WILL see if they ever test a genuinely new schema (e.g., a future `private`-schema table) the same way, and the error message is non-obvious about which grant is actually missing.
**How to avoid:** For any FUTURE new schema (not this phase), always pair `CREATE SCHEMA` with an explicit `GRANT USAGE ON SCHEMA ... TO authenticated, service_role` before testing.

### Pitfall 3: An UPDATE naming an ungranted column is rejected wholesale, not column-by-column
**What goes wrong:** An implementer might assume a mixed `UPDATE ... SET safe_field = x, level = y` would apply the `safe_field` change and merely skip `level`.
**Why it happens:** Column-level UPDATE privilege in Postgres is checked per-statement, not per-assignment — if ANY named column lacks the grant, the WHOLE statement is rejected atomically (verified live this session: case 3's `safe_field` value was NOT partially applied; the row was unchanged from before that request).
**How to avoid:** This is actually a safety feature, not a bug to work around — the Server Action should simply never construct an UPDATE statement that includes `level` for an authenticated-session client, and the atomicity means there's no need to worry about a "partial success" state to handle in the UI.
**Warning signs:** None needed for this phase — just don't ever let the edit form's payload include `level`; it isn't one of the safe fields and the Server Action's zod schema should not accept it as an input key at all (defense-in-depth at the validation layer too, even though the DB layer is what's load-bearing).

### Pitfall 4: `information_schema.table_privileges` reports UPDATE as granted even when only ONE column has it
**What goes wrong:** A developer checks `select * from information_schema.table_privileges where table_name = 'client_profiles'` to confirm the freeze, sees `authenticated | UPDATE` present, and mistakenly concludes the whole table (including `level`) is updatable.
**Why it happens:** `table_privileges` reports a privilege type as present if the role has it on ANY column of the table — it does not distinguish "table-wide" from "column-scoped." This was directly observed in this session's own diagnostic query.
**How to avoid:** To verify column-scoped grants, always query `information_schema.column_privileges` (filtered to the specific column), or use `has_column_privilege('public.client_profiles', 'level', 'UPDATE')` for a specific role — never trust `table_privileges` alone for this kind of check.
**Warning signs:** A `verify-rls.ts` assertion or manual check that only inspects `table_privileges` and declares the freeze "verified" without ever attempting an actual `level`-touching UPDATE request is NOT a real verification of PROF-05 — the assertion must attempt the write and check the response, exactly as D-15/the existing `checkEscalationRejected()` function already does for `role`.

### Pitfall 5: Theme/text-size/reduced-motion CSS must be authored as stylesheet rules, not applied via inline styles
**What goes wrong:** A React `useEffect` sets `document.documentElement.style.colorScheme = 'dark'` (or similar inline style) expecting `light-dark()` tokens to re-resolve.
**Why it happens:** This repo's build pipeline (Lightning CSS, invoked by Tailwind v4's PostCSS plugin) downlevels `light-dark()` calls into a `prefers-color-scheme`-media-query-based polyfill using `--lightningcss-light`/`--lightningcss-dark` custom properties, computed entirely at BUILD time from stylesheet rules present in the source CSS. An inline style mutation at runtime is invisible to this polyfill — the existing `KitThemeToggle` component's own code comment explicitly documents this as "the reported /kit bug" that was already hit and fixed once in this codebase.
**How to avoid:** Any new preference-driven CSS (theme override, text-size step, reduced-motion override) MUST be authored as `html[data-attribute="value"] { ... }` rules directly in `globals.css`, with the JS side only ever toggling the `data-*` attribute (via `dataset`), never touching `style` properties for these tokens.
**Warning signs:** Any code path calling `.style.colorScheme`, `.style.fontSize` on `documentElement`, or similar direct style mutation for a preference that's supposed to compose with `light-dark()`/media-query-based tokens.

### Pitfall 6: `handle_new_user()` is a security-hardened function — resist the urge to add unrelated logic to it
**What goes wrong:** Adding the `client_profiles` provisioning INSERT directly inside `handle_new_user()`'s existing body (Option A from Pattern 3) seems like the most "efficient" single-trigger approach.
**Why it's a trap for this phase specifically:** The function's own code comment states all four of its hardening elements (`security definer`, `set search_path=''`, `coalesce(...)`, `on conflict do nothing`) are "mandatory, not a subset" — this is a function the team has explicitly marked as sensitive and minimal-by-design. Every future edit to it (even a benign additive one) re-opens the auth-critical path to review scrutiny and risk.
**How to avoid:** Use the separate `AFTER INSERT ON public.profiles` trigger (Pattern 3, Option B) instead — it achieves the identical "no client ever missing a row" guarantee via the SAME underlying signup transaction, with zero edits to the already-hardened function.

## Code Examples

### Live-verified freeze DDL and its runtime behavior
See Pattern 1 above — the full DDL and the five-case verification table are the canonical reference; do not re-derive the grant syntax from first principles, copy it directly (adjusting column names to the final migration's naming).

### Server Action + `useActionState` skeleton
See Pattern 2 above, sourced from `[CITED: nextjs.org/docs/app/guides/forms]`.

### Browser-native locale/timezone read (no picker, per PROF-02)
```typescript
// Client Component, read once on mount — never re-derived server-side
// (the server has no reliable access to the visitor's actual locale/tz).
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "America/New_York"
const locale = navigator.language; // e.g. "en-US"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Client-side `onSubmit` + `useState` for every form (this repo's own pattern through Phases 1-3) | Server Action + `useActionState` for the Save flow | This phase (D-07 explicitly locks it) | First phase to introduce Server Actions to this codebase — sets precedent for Phases 5/6/8's own save flows |
| Zod v3 `{ message: "..." }` error param | Zod v4 `{ error: "..." }` param (message still works but deprecated) `[CITED: zod.dev/v4]` | zod v4 release | Any code example copied from older zod v3 tutorials needs the param renamed; `.safeParse()`/`.object()`/`.enum()` are otherwise unchanged |

**Deprecated/outdated:** None specific to this phase's scope — the repo's stack (Next.js 16.2.9, React 19.2.7, Supabase 2.110.0, `@supabase/ssr` 0.12.0) is already current per the version checks run this session.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact column names (`goal`, `locale`, `timezone`, `theme_pref`, `text_size_pref`, `reduced_motion_pref`, `consented`, `consented_at`, `consent_version`) match what the planner will finalize | Standard Stack, Pattern 1, Don't Hand-Roll | Low — CONTEXT.md D-01/D-04/D-08 already name these columns explicitly; this research reuses the CONTEXT.md-locked names verbatim, not an independent guess |
| A2 | Text-size CSS percentages (112.5%/125%) are illustrative placeholders, not a locked design decision | Pattern 4 | Low — explicitly flagged inline as "pick real numbers during planning; the MECHANISM is the verified part" |
| A3 | Coach card's "presence dot" rendering approach (from the sketch skill reference) is out of this research's scope to specify precisely | Architecture Patterns | Low — the skill reference (`profile-and-progress.md`) already describes this at the right level of detail for planning; re-deriving pixel-level styling here would duplicate that source |
| A4 | `zod`'s `latest` npm dist-tag (4.4.3) is the version the planner should pin, not a `4.5.0-canary.*` build | Standard Stack | Low — canary builds are pre-release; `latest` is the correct choice for a production dependency and this is a standard npm convention, not project-specific guesswork |

**Note on provenance:** Every claim in this research about the *behavior* of grants/RLS/triggers (Pattern 1's table, Pitfalls 1/3/4) is `[VERIFIED]` via live testing against the actual running local Postgres 17.6.1.140 + PostgREST v14.14 stack this session — not `[ASSUMED]` from training knowledge or docs. The Next.js Server Action pattern (Pattern 2) is `[CITED]` from the official docs fetched live this session (dated 2026-06-23). The zod v4 API surface (State of the Art) is `[CITED]` from `zod.dev/v4` fetched live this session. The `KitThemeToggle`/Lightning CSS behavior (Pitfall 5) is `[VERIFIED: codebase]` — read directly from the compiled Storybook CSS output and the component's own code comments in this repo.

## Open Questions

1. **Should the profile's "Sign out" settings row (per the sketch-findings skill) duplicate the shell's existing top-bar `LogoutButton`, or should the shell's top-bar logout be removed once the profile page ships?**
   - What we know: `AppShell` (`apps/web/components/shell/app-shell.tsx`) already renders a ghost-variant `LogoutButton` in every authenticated page's header, with a code comment explicitly noting "the screen carries ZERO primary actions... includes zero" — this is an established, working pattern.
   - What's unclear: The sketch skill's `profile-and-progress.md` lists "Sign out" as one of the profile's settings rows, implying it should ALSO live there. Two sign-out affordances (header + profile row) is mild redundancy but not necessarily wrong (many apps do this deliberately).
   - Recommendation: Planner's discretion — likely simplest to add a "Sign out" row to the profile that reuses the existing `signOut()` browser helper (not `LogoutButton` directly, since that component is styled for the header bar), and leave the shell's header button as-is; removing the header button is out of this phase's stated scope (not listed as a success criterion) and would be an unrelated shell change.

2. **Exact `text_size_pref` enum values and CSS scale numbers.**
   - What we know: D-13 locks "three text-size steps (e.g. Default / Large / Larger)" as the count and rough naming, and this research verified the MECHANISM (root-level `data-text-size` attribute → CSS custom property scale) works with this codebase's existing Lightning CSS `light-dark()`-adjacent build pipeline.
   - What's unclear: The exact percentage/px values for "Large" and "Larger" aren't specified anywhere upstream — this is a genuine design-token decision, not a technical unknown.
   - Recommendation: Planner picks concrete values (e.g., 112.5% / 125%, or fixed px like 18px/20px root); confirm against `tests/contrast.test.ts`'s existing pattern if any new token is introduced (the existing test only covers colors, not type scale, so no NEW test obligation exists unless the planner wants one).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Local Supabase stack (Postgres, PostgREST, GoTrue, etc.) | ✓ | running, confirmed this session | — |
| Supabase CLI | Migration authoring/apply, type generation, `verify-rls` support tooling | ✓ | 2.109.0 | — |
| Local Supabase stack | All DB/RLS work this phase | ✓ | Postgres 17.6.1.140, PostgREST v14.14 (confirmed via `docker ps` + `supabase status` this session) | — |
| Node.js | `pnpm seed`, `pnpm verify:rls` (both use `--experimental-strip-types`), Next.js dev/build | ✓ (implied — `supabase status`/CLI tooling and this session's own JWT-minting `node -e` calls ran successfully) | not independently version-checked this session | — |
| `zod` | Edit-payload + Server Action validation (XC-02) | ✗ (not yet installed — this phase's one net-new dep) | `4.4.3` available on npm, verified `[OK]` by slopcheck | Install via `pnpm --filter @fish/web add zod` — no fallback needed, this is a routine, low-risk install |
| Hosted/linked Supabase project | NOT required this phase | ✗ (project is deliberately unlinked — `supabase link` was never run) | — | N/A — this phase is 100% local-stack; hosted deploy remains deferred per `docs/deploy-checklist.md` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `zod` — trivial, low-risk install; no blocking concern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 (already configured, `apps/web/vitest.config.ts`) + a standalone Node script harness (`scripts/verify-rls.ts`, run via `node --experimental-strip-types`) for live-DB RLS/grant assertions |
| Config file | `apps/web/vitest.config.ts` (component/unit tests); `scripts/verify-rls.ts` is not Vitest-based — it is a plain async script exiting non-zero on failure |
| Quick run command | `pnpm --filter @fish/web test` (Vitest, component-level) |
| Full suite command | `pnpm build && pnpm verify:rls` (the two release gates named explicitly in the ROADMAP.md success criteria) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | Client reads own profile | RLS live-assertion | `pnpm verify:rls` (extend `scripts/verify-rls.ts` with a `checkClientProfileSelfRead()` function) | ❌ Wave 0 — new function needed |
| PROF-02 | Client edits safe fields, change persists | RLS live-assertion + component test | `pnpm verify:rls` (safe-update-succeeds case) + `pnpm --filter @fish/web test` for the form's client-side rendering | ❌ Wave 0 |
| PROF-03 | ≤3 a11y prefs, default to system | Component test (renders correct control count) + manual/visual (CSS scale correctness is not currently asserted by any automated test — `contrast.test.ts` covers color only) | `pnpm --filter @fish/web test` | ❌ Wave 0 for the component test; no automated CSS-scale test exists or is required by any locked decision |
| PROF-04 | Consent recorded as fields | RLS live-assertion (write succeeds, fields populate) | `pnpm verify:rls` | ❌ Wave 0 |
| PROF-05 | Protected fields rejected at DB | RLS live-assertion (mirrors existing `checkEscalationRejected()` shape) | `pnpm verify:rls` (new `checkLevelFreezeRejected()` function, modeled directly on the existing `role`-escalation check) | ❌ Wave 0 |
| PROF-06 | Coach reads assigned client read-only; unassigned denied | RLS live-assertion (both positive and negative case) | `pnpm verify:rls` (new `checkCoachReadsAssignedClientProfile()` + `checkUnassignedCoachDenied()`) | ❌ Wave 0 |
| XC-01 | `pnpm verify:rls` gate, self/coach/unassigned/cross-client/field-protection assertions | RLS live-assertion suite (six assertions per D-15) | `pnpm verify:rls` | ❌ Wave 0 — six new assertion functions |
| XC-03 | Design line (56px, one action, calm copy, no lost work) | Manual/visual review + existing component conventions (no dedicated automated a11y/design-line test exists in this repo today) | N/A — visual/manual review against `docs/ui-ux-agent-guidelines.md` and the `sketch-findings-fish` skill | N/A — no test infra gap, this is a review discipline, not an automatable assertion in this codebase's current tooling |

### Sampling Rate
- **Per task commit:** `pnpm --filter @fish/web typecheck` + relevant Vitest file (fast, catches type/render regressions immediately)
- **Per wave merge:** `pnpm build` (full build across all workspace packages) + `pnpm verify:rls` (full six-assertion RLS suite against the local stack)
- **Phase gate:** Both `pnpm build` and `pnpm verify:rls` green, per ROADMAP.md's explicit Phase 4 success criterion 5, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/verify-rls.ts` — extend with six new assertion functions (self-read, safe-update-succeeds, assigned-coach-read, unassigned-coach-denial, cross-client-denial, protected-field-freeze) for `client_profiles`, modeled directly on the existing `checkClientBoundary()`/`checkEscalationRejected()`/`checkClientReadsCoachName()` functions already in that file — same `signInAs()` helper, same `report()`/`checkNoRecursion()` conventions, no new test infrastructure needed, only new test bodies.
- [ ] `scripts/seed.ts` — extend `assignClient`-adjacent logic with a `client_profiles` backfill (`upsert`/`insert ... on conflict do nothing`) + a seeded `level` value for the three dev clients, so `pnpm seed` remains idempotent pre- and post-migration.
- [ ] No new Vitest config or test runner setup needed — `apps/web/vitest.config.ts` + `vitest.setup.ts` already cover component-level testing; only new `*.test.tsx` files co-located with new components (matching every existing UI-kit component's convention) are needed.
- [ ] Framework install: `pnpm --filter @fish/web add zod` — the one net-new dependency; no test-framework install needed (Vitest is already present).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (new work) | Reuses existing Supabase Auth session/JWT verification (`getUser()`, never `getSession()`) — no new auth surface this phase |
| V3 Session Management | no (new work) | Reuses the existing `@supabase/ssr` cookie-based server client — no new session mechanism |
| V4 Access Control | yes | RLS policies (`is_coach_of` reuse, new self-row policies) + column-scoped `GRANT UPDATE` for the field-freeze (PROF-05) — this phase's central control |
| V5 Input Validation | yes | `zod` v4 `.safeParse()` on the edit-payload in the Server Action, before any DB write is attempted |
| V6 Cryptography | no | No new cryptographic material this phase (no new secrets, tokens, or hashing) |
| V13 API and Web Service | yes | The Server Action re-verifies `getUser()` itself (does not trust that the calling page already gated on it) — matches the official Next.js guidance that Server Actions are directly POST-reachable and must independently authenticate/authorize |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client sends a well-formed edit payload that includes `level` or `role`, hoping app-code alone filters it | Elevation of Privilege | Column-scoped `GRANT UPDATE` (never grants `level`/`role` to `authenticated`) + the mirrored freeze trigger — DB-enforced, not app-code-enforced (PROF-05's explicit requirement) — live-verified this session (Pattern 1) |
| Client calls the Supabase REST API directly (bypassing the Next.js app entirely) to attempt a cross-client read of another client's `client_profiles` row | Information Disclosure | RLS `using (id = auth.uid())` on the self-read/self-update policies; `is_coach_of(id)` for the coach-read policy — default-deny, no manual ID-based filtering in app code (this repo's established "RLS is the sole authz boundary" convention) |
| An unassigned coach guesses/enumerates a client UUID and requests `/coach/clients/[id]` | Information Disclosure | `private.is_coach_of` returns false for non-assigned relationships, so the RLS-gated `SELECT` returns zero rows — the Server Component renders a calm not-found state, never an error that would confirm/deny the UUID's existence (avoids a user-enumeration side channel) |
| A forged/stale cookie is presented to a Server Component or Server Action | Spoofing | This repo's established `getUser()`-never-`getSession()` rule (documented in `apps/web/lib/supabase/server.ts`'s own comment) — `getSession()` trusts the cookie without re-verification against Supabase Auth; `getUser()` re-verifies server-side on every call, including inside this phase's new Server Action |
| Malformed or oversized `goal` text is submitted to exhaust storage or break rendering | Denial of Service (minor) | `zod` `.max(...)` constraint on the `goal` field in the edit-payload schema, enforced before the DB write (V5 Input Validation) |

## Sources

### Primary (HIGH confidence)
- Live verification against the running local stack this session: `supabase status` (Docker running, Postgres 17.6.1.140 via `docker ps`, PostgREST v14.14), `supabase db query --local` (schema/grant/role introspection), real HTTP calls to `http://127.0.0.1:54321/rest/v1/...` with a minted local-JWT-secret `authenticated`-role token, and `service_role` calls via the local `SERVICE_ROLE_KEY` — all cleaned up (dropped) at the end of this session, verified via a final `pg_tables`/`pg_roles` check.
- This repo's own source files, read directly: `supabase/migrations/0001-0006_*.sql`, `scripts/verify-rls.ts`, `scripts/seed.ts`, `apps/web/lib/services/supabase/{core,server,types}.ts`, `apps/web/lib/auth/{server,redirects}.ts`, `apps/web/lib/supabase/{server,client}.ts`, `apps/web/components/ui/{input,button,alert}/*.tsx`, `apps/web/components/chat/avatar/avatar.tsx`, `apps/web/components/shell/app-shell.tsx`, `apps/web/components/auth/logout-button.tsx`, `apps/web/components/kit/theme-toggle.tsx`, `apps/web/app/globals.css`, `apps/web/tests/contrast.test.ts`, `apps/web/storybook-static/assets/iframe-*.css` (compiled output, confirms the Lightning CSS polyfill mechanism), `packages/supabase/src/*.ts`, `packages/core/src/*.ts`, `docs/deploy-checklist.md`, `docs/ui-ux-agent-guidelines.md`.
- [nextjs.org/docs/app/guides/forms](https://nextjs.org/docs/app/guides/forms) — fetched live this session, version 16.2.10, `lastUpdated: 2026-06-23`.
- [supabase.com/docs/guides/database/postgres/column-level-security](https://supabase.com/docs/guides/database/postgres/column-level-security) — fetched live this session; confirms the `grant update (col1, col2) on table to role` syntax matches this research's DDL.
- [zod.dev/v4](https://zod.dev/v4) — fetched live this session; confirms `.safeParse()`/`.object()`/`.enum()` are unchanged, only the error-message param (`message` → `error`) changed.
- `npm view zod version` (4.4.3), `npm view @supabase/ssr version` (0.12.0), `npm view zod scripts.postinstall` (empty), `npm view zod repository.url` (`colinhacks/zod`) — all run live this session.
- `slopcheck install zod --ecosystem npm` — run live this session (`slopcheck` installed via `pip3 install slopcheck --break-system-packages`), result `[OK]`.

### Secondary (MEDIUM confidence)
- `.claude/skills/sketch-findings-fish/SKILL.md` and `references/profile-and-progress.md`, `references/theme-and-tokens.md` — project-internal design research (validated sketches), treated as authoritative for design decisions per the phase's own canonical_refs, not independently re-verified against external sources (not applicable — this is product/design decision documentation, not a technical claim).

### Tertiary (LOW confidence)
- None — every claim in this research that could be verified via a tool call (live DB test, official docs fetch, npm registry check, or direct codebase read) was verified that way this session. No claim rests on WebSearch-only, unverified sourcing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version number was checked live against the npm registry or the repo's own `package.json` this session, not recalled from training data.
- Architecture (grant/RLS/trigger interaction): HIGH — live-verified against the actual running local Postgres+PostgREST stack via real HTTP requests, including a self-correcting discovery of an invalid initial test methodology (documented as Pitfall 1) that would otherwise have produced a wrong conclusion.
- Architecture (Server Action pattern): HIGH — sourced from the official, dated (2026-06-23), version-matched Next.js documentation, fetched live this session.
- Pitfalls: HIGH — five of six pitfalls were directly observed as real errors/behaviors during this session's own testing (not theoretical); one (schema USAGE grant) is a documented Postgres fundamental encountered directly while building the test sandbox.

**Research date:** 2026-07-04
**Valid until:** 30 days (stable stack — Next.js/Supabase/Postgres versions are pinned in this repo and change on the team's own schedule, not upstream's) for the architecture/pattern claims; the live-DB-behavior claims (grant/RLS/trigger ordering) are Postgres-version-independent fundamentals and do not expire on any particular timeline.
