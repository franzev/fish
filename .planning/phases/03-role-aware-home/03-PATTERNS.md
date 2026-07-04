# Phase 3: Role-aware home - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 14
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/app/(authenticated)/layout.tsx` | provider (auth guard + shell wrapper) | request-response | `apps/web/app/home/page.tsx` | role-match (page → layout, same `getUser()`+redirect shape) |
| `apps/web/app/(authenticated)/home/page.tsx` (rewrite of `apps/web/app/home/page.tsx`) | component (server page) | CRUD (read) | `apps/web/app/home/page.tsx` (itself, being promoted) | exact |
| `apps/web/app/(authenticated)/coach/page.tsx` | component (server page) | CRUD (read) | `apps/web/app/home/page.tsx` | role-match (auth-gated server page, new list-read logic) |
| `apps/web/app/page.tsx` (rewritten, D-02) | route (pure redirect) | request-response | `apps/web/app/login/page.tsx` (redirect-on-success branch) + current `apps/web/app/home/page.tsx` (`getUser()` shape) | role-match |
| `apps/web/components/shell/app-shell.tsx` | component | request-response | `apps/web/app/home/page.tsx` (Card + LogoutButton composition) | role-match |
| `apps/web/components/shell/app-shell.test.tsx` | test | — | `apps/web/app/home/page.test.tsx` (grep-gate + mock pattern) | exact (pattern to copy) |
| `apps/web/components/home/empty-state.tsx` | component | transform (render) | `apps/web/components/ui/alert.tsx` (icon + tone/copy composition inside a bordered container) | role-match |
| `apps/web/components/home/empty-state.test.tsx` | test | — | `apps/web/components/ui/card.test.tsx` / `alert.test.tsx` (render + text assertions) | role-match |
| `apps/web/components/coach/client-list.tsx` | component | transform (render list) | `apps/web/components/ui/card.tsx` (Card as container) + `apps/web/components/ui/alert.tsx` (typed props/config shape) | role-match |
| `apps/web/components/coach/client-list.test.tsx` | test | — | `apps/web/app/home/page.test.tsx` (render + assertion style) | role-match |
| `apps/web/components/auth/logout-button.tsx` (relocated usage, unchanged file) | component | event-driven (client action) | itself (no change needed, only its call site moves) | exact |
| `packages/supabase/src/auth.ts` (edited — `authRedirects`) | config | transform | itself (existing file, edit in place) | exact |
| `supabase/migrations/0006_client_reads_coach_name.sql` | migration | CRUD (RLS policy) | `supabase/migrations/0004_rls_helpers.sql` | exact |
| `scripts/verify-rls.ts` (extended — new assertion) | test (script) | request-response (live RLS check) | itself (existing `checkCoachBoundary()` / `checkClientBoundary()` functions) | exact |

## Pattern Assignments

### `apps/web/app/(authenticated)/layout.tsx` (provider, request-response)

**Analog:** `apps/web/app/home/page.tsx` (Phase 2's proven `getUser()`-then-redirect precedent — this is the file being generalized into a shared layout)

**Imports pattern** (lines 1-4 of the analog):
```typescript
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
```
New layout swaps `Card`/`LogoutButton` for `AppShell` and adds a `profiles.role` query — no other import shape changes.

**Auth pattern** (lines 13-21 of the analog — copy verbatim, this is the hard rule):
```typescript
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  ...
```
Never `getSession()` — see `apps/web/lib/supabase/server.ts` lines 6-8 for the hard rule comment this project enforces everywhere server-side.

**Core pattern (new — role resolution, per RESEARCH.md Pattern 1):**
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("role, display_name")
  .eq("id", user.id)
  .single();

if (!profile) {
  redirect("/login"); // defensive: a session with no profile row should never happen
}

return <AppShell displayName={profile.display_name}>{children}</AppShell>;
```

**Error handling pattern:** No try/catch in the Server Component precedent — `redirect()` throws internally by design (mirrored by the existing test's mock: `apps/web/app/home/page.test.tsx` lines 8-16, which re-throws `"NEXT_REDIRECT"` from the mocked `redirect`). Do not wrap `getUser()`/the `profiles` query in try/catch; let a genuine network failure surface as a Next.js error boundary rather than silently redirecting to the wrong place.

**Testing pattern** (`apps/web/app/home/page.test.tsx` lines 1-25, copy verbatim structure):
```typescript
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: vi.fn() }),
}));

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({ select: () => ({ eq: () => ({ single: singleMock }) }) }),
  }),
}));
```
Extend the existing mock shape with a chained `.from().select().eq().single()` stub for the new `profiles` read — the analog only mocked `auth.getUser`.

---

### `apps/web/app/(authenticated)/home/page.tsx` (component, CRUD-read)

**Analog:** `apps/web/app/home/page.tsx` (the exact file being promoted — read it fully before rewriting, not just skimmed)

**Current shape to replace** (lines 13-36 — the placeholder body: `"You're signed in"` heading, static reassurance paragraph, `LogoutButton` inside a `Card`). The new file removes the `getUser()`/redirect block (now owned by the layout) and instead:
1. Reads `role`/`display_name` (passed down from the layout, or re-queried per Pattern 1's discretion note) for the "wrong door" guard: `if (role === "coach") redirect("/coach")` (D-03).
2. Queries whether a `coach_clients` row exists for the signed-in client, and if so, reads the coach's `display_name` via the new `0006` policy.
3. Renders `<h1>Welcome back, {firstName}</h1>` (D-19) followed by either the assigned or unassigned `EmptyState`.

**Core CRUD-read pattern (new, per RESEARCH.md Pitfall 2 + Pattern 2):**
```typescript
const { data: assignment } = await supabase
  .from("coach_clients")
  .select("coach_id")
  .eq("client_id", user.id)
  .maybeSingle();

let coachName: string | null = null;
if (assignment) {
  const { data: coach } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", assignment.coach_id)
    .single();
  coachName = coach?.display_name ?? null;
}
```
No manual coach-id `.eq()` filtering beyond the client's own `client_id` — RLS (new `0006` policy) is the actual boundary for reading the coach's row, per AGENTS.md's API rule and the existing `checkCoachBoundary()`/`checkClientBoundary()` precedent in `scripts/verify-rls.ts`.

---

### `apps/web/app/(authenticated)/coach/page.tsx` (component, CRUD-read)

**Analog:** `apps/web/app/home/page.tsx` for the auth-gate shape; `scripts/verify-rls.ts`'s `checkCoachBoundary()` (lines ~70-82) for the **trust-RLS, no manual filter** query discipline.

**Core CRUD pattern** (mirrors the already-proven, tested query shape):
```typescript
// scripts/verify-rls.ts checkCoachBoundary() — the exact call already proven
// to return "own row plus 3 assigned clients" with zero manual filtering:
const { data, error } = await supabase.from("profiles").select("*");
```
RESEARCH.md's Open Question 3 recommends querying `coach_clients` (already scoped by the `"coach reads own assignments"` policy in `0004_rls_helpers.sql` line 47) joined to `profiles`, instead of querying `profiles` directly and excluding the coach's own row with `.neq("id", user.id)` — resolve this before writing the file; either is compatible with this pattern map, but the join avoids the self-row edge case entirely.

**Error handling / empty state:** `clients.length === 0` renders `EmptyState` (D-16/D-17/D-18 shape shared with the client home); non-empty renders `ClientList` (D-12..15).

---

### `apps/web/app/page.tsx` (route, request-response — D-02 pure redirect)

**Analog:** RESEARCH.md's own worked example (Code Examples section, "The `/` pure-redirect page") is itself already a concrete, ready-to-copy composition of two proven in-repo patterns: `apps/web/app/home/page.tsx`'s `getUser()` shape + `apps/web/app/login/page.tsx`'s `router.push("/home")` destination-resolution idea (lines 47-51), generalized to a role check.

**Full pattern to copy (already validated against this repo's conventions):**
```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { authRedirects } from "@fish/supabase/auth";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(authRedirects.signedOut);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(
    profile?.role === "coach" ? authRedirects.coachHome : authRedirects.clientHome
  );
}
```
**Note:** This file renders nothing — every branch calls `redirect()`. The existing stale showcase currently at this path (color swatches, Button/Input/Card gallery — see current `apps/web/app/page.tsx`) is deleted wholesale, not merged.

---

### `apps/web/components/shell/app-shell.tsx` (component, request-response)

**Analog:** `apps/web/app/home/page.tsx`'s composition of `Card` + `LogoutButton` (lines 23-35) — the shell generalizes this exact "wrap authenticated content, put logout somewhere reachable" idea into a persistent top bar.

**Core pattern (new component, composed from existing primitives only — no hand-rolled button/nav):**
```typescript
import { LogoutButton } from "@/components/auth/logout-button";

interface AppShellProps {
  displayName: string;
  children: React.ReactNode;
}

/* D-08/D-09: slim top bar — logo, quiet name, ghost logout. Content sits in
   one narrow centered column below (D-10), same 440px-family width as the
   auth cards. The bar never carries page titles (D-11) — each page owns
   its own Fraunces heading in the content column. */
export function AppShell({ displayName, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        {/* logo — reuse the existing <Image src="/logo.svg" .../> pattern from apps/web/app/page.tsx lines 22-28 */}
        <span className="text-[14px] text-muted">{displayName}</span>
        <LogoutButton />
      </header>
      <main className="mx-auto w-full max-w-[640px] flex-1 px-5 py-12">
        {children}
      </main>
    </div>
  );
}
```
**Important:** `LogoutButton` is `variant="primary"` (see its own file, line 26) — this is the shell's one interactive element. SHEL-01's grep-gate test (see below) must count it as the screen's single primary action; do not add a second primary anywhere in a page that composes `AppShell`.

**Testing pattern** (extends the exact grep-gate already proven in `apps/web/app/home/page.test.tsx` lines 60-71):
```typescript
it('the shell + its one client island together contain exactly one variant="primary" usage', () => {
  const shellSource = readFileSync(resolve(__dirname, "./app-shell.tsx"), "utf-8");
  const logoutButtonSource = readFileSync(
    resolve(__dirname, "../auth/logout-button.tsx"),
    "utf-8"
  );
  const matches =
    (shellSource.match(/variant="primary"/g) ?? []).length +
    (logoutButtonSource.match(/variant="primary"/g) ?? []).length;
  expect(matches).toBe(1);
});
```

---

### `apps/web/components/home/empty-state.tsx` (component, transform/render)

**Analog:** `apps/web/components/ui/alert.tsx` — same shape (icon + calm copy inside a bordered/surfaced container, config-driven variant), but `EmptyState` drops Alert's tone-color branching (D-17 wants pure quiet/muted, no warning/error/success hues) and wraps in `Card` rather than Alert's own bespoke container.

**Imports pattern** (mirrors `alert.tsx` lines 1-8, trimmed to one icon prop instead of a tone-keyed config):
```typescript
import { Card } from "@/components/ui/card";
import type { Icon } from "@tabler/icons-react";
```

**Core pattern** (RESEARCH.md's own worked example, directly usable):
```typescript
interface EmptyStateProps {
  Icon: Icon;
  children: React.ReactNode;
}

/** D-17/D-18: one quiet icon + calm copy, zero actions — reassurance only. */
export function EmptyState({ Icon, children }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <Icon size={32} stroke={1.5} aria-hidden="true" className="text-muted" />
      <div className="text-body">{children}</div>
    </Card>
  );
}
```
Icon sizing/stroke convention (`size={20-32}`, `stroke={1.5-2}`, always `aria-hidden="true"`) copied from `alert.tsx` lines 72-77 and `kit/page.tsx` line 104 — this is the established icon-rendering convention project-wide; do not invent new size/stroke values.

**Icon import constraint (hard test gate):** Only `@tabler/icons-react` may be imported for icons anywhere in `apps/web` — enforced by `apps/web/tests/icon-source.test.ts`, which bans `react-icons`, `@heroicons/react`, `lucide-react` via a repo-wide grep. Any empty-state icon choice must come from this package.

---

### `apps/web/components/coach/client-list.tsx` (component, transform/render list)

**Analog:** `apps/web/components/ui/card.tsx` (container) — RESEARCH.md's own worked Pattern 4 example is directly usable and already matches this repo's typed-props + inline-map convention seen in `alert.tsx`'s `toneConfig` and `apps/web/app/page.tsx`'s `swatches.map()` (lines 42-53).

**Core pattern (copy directly, per RESEARCH.md Pattern 4 — only the data source may change per Open Question 3):**
```typescript
import { Card } from "@/components/ui/card";

interface Client {
  id: string;
  displayName: string;
  email: string;
}

/** D-12..15: one calm Card, hairline dividers, alphabetical, inert rows —
 *  nothing here is tappable yet (no destination exists this milestone). */
export function ClientList({ clients }: { clients: Client[] }) {
  const sorted = [...clients].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

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
**D-14 hard constraint (test-enforceable):** no `hover:`/`cursor-pointer` class anywhere in this file — a grep-style test analogous to the SHEL-01 primary-button gate should assert this (`expect(source).not.toMatch(/cursor-pointer|hover:/)`), since D-14 is an explicit locked decision, not discretion.

**Email data-source caveat (Pitfall 3 — resolve before writing this file):** `profiles` has no `email` column today (`supabase/migrations/0001_profiles.sql`'s full column list is `id, role, display_name, created_at, updated_at`). The `Client` interface's `email` field cannot be populated from a bare `profiles` select until either (a) `email` is added to `profiles` via `handle_new_user()` (see `supabase/migrations/0002_handle_new_user.sql`, not read in full this pass but confirmed to be the trigger RESEARCH.md references), or (b) an admin-API read is added. Do not let this component silently render `undefined` — confirm the data-source decision (RESEARCH.md's recommendation is option (a)) before wiring the page that feeds this component.

---

### `packages/supabase/src/auth.ts` (config, transform — edit in place)

**Analog:** itself. This is a 15-line file being edited, not replaced. Full current contents:
```typescript
import type { UserRole } from "@fish/core/roles";

export interface FishAuthClaims {
  sub: string;
  role: UserRole;
}

export const authRedirects = {
  signedOut: "/",
  // Interim authenticated landing this phase; Phase 3 owns role-based redirects.
  home: "/home",
  clientHome: "/chat",
  coachHome: "/coach",
} as const;
```
**Required edits (D-01, D-07):**
- `signedOut: "/"` → `signedOut: "/login"` (D-07: logout lands on plain `/login`)
- `clientHome: "/chat"` → `clientHome: "/home"` (D-01)
- `coachHome: "/coach"` stays unchanged
- Drop or repurpose the `home` key and its stale comment — nothing in the codebase should reference an "interim" landing after this phase; grep all call sites of `authRedirects.home`/`authRedirects.clientHome`/`authRedirects.signedOut` before renaming any key (found via `Grep("authRedirects", type: "ts")` — call sites include `apps/web/app/login/page.tsx` line 51's `router.push("/home")`, which is a **literal string**, not yet wired to `authRedirects` — confirm whether this phase also wires that call site to the constant, since CONTEXT.md's D-01 implies the constant is the single source of truth going forward).

---

### `supabase/migrations/0006_client_reads_coach_name.sql` (migration, CRUD/RLS)

**Analog:** `supabase/migrations/0004_rls_helpers.sql` (the `is_coach_of()` helper + "coach reads assigned clients" policy — same shape, mirrored in reverse direction).

**Full pattern to copy** (mirrors `0004`'s exact structure: `security definer stable set search_path = ''`, never bare-SELECT the protected table from inside its own policy — Pitfall 2's hard recursion-safety rule, carried forward):
```sql
create or replace function private.is_client_of(coach_uuid uuid)
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
      where cc.coach_id = coach_uuid
        and cc.client_id = (select auth.uid())
    );
$$;

-- profiles: a client can read their own assigned coach's row (D-16).
create policy "client reads own coach"
  on public.profiles
  for select
  to authenticated
  using (private.is_client_of(id));
```
**Deviation from the `0004` analog, and why (already resolved by RESEARCH.md Pattern 2):** `is_coach_of()` (the analog) has an extra `and (select role from public.profiles where id = (select auth.uid())) = 'coach'` clause (see `0004_rls_helpers.sql` line 23) that `is_client_of()` deliberately omits — the `enforce_coach_client_roles` trigger (`0003_coach_clients.sql` lines 22-33) already guarantees `coach_clients.client_id` only ever references a client-role profile, so the caller being the referenced `client_id` is sufficient without a redundant role re-check. Do not "fix" this by copying the extra clause verbatim — it would be inert but inconsistent with the documented reasoning (Assumption A3 in RESEARCH.md flags this as a review checkpoint, not a bug).

**Grant check:** No new `grant` statement needed — `0001_profiles.sql` line 15 (`grant select, update on public.profiles to authenticated`) already covers the table-level privilege; only the RLS policy is new.

---

### `scripts/verify-rls.ts` (test/script, request-response — extend, not new file)

**Analog:** itself — `checkClientBoundary()` and `checkCoachBoundary()` (existing functions in the same file) are the direct template for the new `checkClientReadsCoachName()` assertion.

**Pattern to copy** (function shape, `signInAs()` helper reuse, `report()`/`checkNoRecursion()` calls):
```typescript
async function checkClientReadsCoachName(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", /* seeded coach's id, or resolved via coach_clients join */);
  checkNoRecursion("D-16 client reads coach name", error);
  if (error) {
    report("D-16 client reads coach name: select succeeds", false, error.message);
    return;
  }
  report(
    "D-16 client reads coach name: returns the assigned coach's row",
    (data ?? []).length === 1,
    `got ${(data ?? []).length} rows`
  );
}
```
Call this new function alongside the existing `checkClientBoundary()`/`checkCoachBoundary()`/`checkEscalationRejected()` invocations at the bottom of the script (not read in this pass, but the existing three functions' call pattern is the template — add the new call adjacent to them).

---

## Shared Patterns

### Server-side auth read (`getUser()` only, never `getSession()`)
**Source:** `apps/web/lib/supabase/server.ts` lines 6-8 (doc comment) + `apps/web/app/home/page.tsx` lines 13-21 (usage)
**Apply to:** `(authenticated)/layout.tsx`, `(authenticated)/home/page.tsx`, `(authenticated)/coach/page.tsx`, root `page.tsx`
```typescript
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  redirect("/login");
}
```

### RLS as the security boundary, never manual `.eq(coach_id, ...)` filtering
**Source:** `scripts/verify-rls.ts`'s `checkCoachBoundary()`/`checkClientBoundary()` + `supabase/migrations/0004_rls_helpers.sql`
**Apply to:** `(authenticated)/coach/page.tsx`, `(authenticated)/home/page.tsx`'s coach-name read
```typescript
// Trust RLS. No manual coach_id/client_id filter beyond the caller's own id.
const { data } = await supabase.from("profiles").select("*");
```

### Icon usage convention (size/stroke/aria)
**Source:** `apps/web/components/ui/alert.tsx` lines 72-77, `apps/web/app/kit/page.tsx` line 104
**Apply to:** `empty-state.tsx`
```typescript
<Icon size={20 /* or 32 for empty states per RESEARCH.md Pattern 3 */} stroke={1.5} aria-hidden="true" className="text-muted" />
```

### One-primary-action grep-gate test
**Source:** `apps/web/app/home/page.test.tsx` lines 60-71
**Apply to:** `app-shell.test.tsx`, and any new page composing `AppShell` + a page-level action
```typescript
const matches = (source.match(/variant="primary"/g) ?? []).length;
expect(matches).toBe(1); // or 0 for the empty-state-only pages (D-18)
```

### RLS helper hardening (`security definer stable set search_path = ''`, never bare-SELECT the protected table)
**Source:** `supabase/migrations/0004_rls_helpers.sql` lines 9-24
**Apply to:** `0006_client_reads_coach_name.sql`'s `is_client_of()`

### Named exports, `forwardRef` + `displayName` on focusable controls
**Source:** `apps/web/components/ui/button.tsx` line 97 (`Button.displayName = "Button"`)
**Apply to:** N/A this phase — none of the new components (`AppShell`, `EmptyState`, `ClientList`) are focusable/interactive themselves (D-14 keeps rows inert; the shell's only focusable child is the existing `LogoutButton`, already `forwardRef`-free by its own established pattern since it wraps `Button` rather than being a raw control itself — no new `forwardRef` needed for any Phase 3 component).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/app/(authenticated)/layout.tsx` (as a *layout*, specifically) | provider | request-response | No existing `layout.tsx` in this codebase does an auth+role guard — only `apps/web/app/layout.tsx` exists today and is purely fonts/metadata (no auth logic at all). The pattern is synthesized from the `/home` page's proven `getUser()` shape rather than copied from another layout. |
| Route-group folder structure `(authenticated)/` | route | — | No existing route group exists in `apps/web/app/` (all current routes are flat: `login/`, `signup/`, `home/`, etc.). This is a structural first for the project — RESEARCH.md's Assumption A1 flags this as the one mechanism not independently re-verified this session beyond official docs; the flat-structure alternative (each page calling a shared `requireRole()` helper) is the fallback if the planner wants zero new folder-naming concepts. |

## Metadata

**Analog search scope:** `apps/web/app/`, `apps/web/components/`, `apps/web/lib/supabase/`, `packages/supabase/src/`, `packages/core/src/`, `supabase/migrations/`, `scripts/`
**Files scanned:** ~20 (all existing pages, all `components/ui/*`, `components/auth/logout-button.tsx`, all 5 migrations, `packages/supabase/src/auth.ts`, `packages/core/src/roles.ts`, `scripts/verify-rls.ts`, `apps/web/proxy.ts`, `apps/web/lib/supabase/{server,client,proxy}.ts`, `apps/web/app/layout.tsx`, `apps/web/app/kit/page.tsx` excerpt, `apps/web/tests/icon-source.test.ts`)
**Pattern extraction date:** 2026-07-04

## Conventions

Convention derivation via the shared `gsd-tools.cjs verify conventions --derive` module could not run this session — the GSD plugin's `bin/gsd-tools.cjs` was not found on this machine (`$CLAUDE_PLUGIN_ROOT` unset, no cached plugin install under `~/.claude/plugins/cache/gsd-plugin/gsd/`). Convention derivation skipped (tooling unavailable in this environment); the qualitative conventions below are drawn directly from the files read during pattern mapping (Step 4) and from the project's own documented conventions in `.claude/CLAUDE.md`, not from the deterministic derive tool.

| Axis | Dominant | Notes |
|------|----------|-------|
| File-name casing | lowercase-with-hyphens | `logout-button.tsx`, `client-list.tsx` (new), `app-shell.tsx` (new), `empty-state.tsx` (new), `card.tsx`, `button.tsx` — no camelCase or PascalCase filenames observed anywhere in `apps/web/components/` or `apps/web/app/` |
| Identifier casing | PascalCase (components/types), camelCase (functions/vars/instances) | `AppShell`, `ClientList`, `EmptyState`, `ButtonProps` vs. `createClient`, `authRedirects`, `isUserRole` |
| Export style | named exports only | Every component in `apps/web/components/ui/` and `apps/web/components/auth/` uses `export function X` / `export const X = forwardRef(...)` — zero `export default` in components; only page-level files (`apps/web/app/**/page.tsx`, e.g. `LoginPage`) use `export default`, matching Next.js's App Router requirement, not a style choice |
| Import style | `@/*` path alias (web app), bare package name (workspace packages) | `@/components/ui/card`, `@/lib/supabase/server` inside `apps/web`; `@fish/core/roles`, `@fish/supabase/auth` for cross-package imports; no relative `../../` chains observed crossing the `apps/web` boundary |

**Contested hotspots (author's choice):** None identified within the scope of this phase's new files — the four axes above are uncontested (100% consistent) across every file read during this mapping pass. For repo-wide context (not scoped to this phase): the project's own architecture notes a deliberate **CJS↔SDK dual resolver** split elsewhere in the monorepo tooling (`bin/lib/**` as CJS `module.exports`/`require` vs. `sdk/src/**` as ESM `export`/`import`) — not touched by this phase's files, but the prototype case for "each half is internally consistent per-directory, contested only repo-wide; match the directory's local style" if a future phase touches that boundary.
