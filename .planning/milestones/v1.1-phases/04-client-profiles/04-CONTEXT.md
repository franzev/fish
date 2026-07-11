# Phase 4: Client Profiles - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the client-profile domain on top of the shipped v1.0 foundation:

- A `client_profiles` schema (1:1 with `profiles`) holding client-only data: goal/role-context, locale, timezone, coach-owned English level, accessibility preferences, and consent metadata.
- A client **view** of their own profile and a **safe-edit** flow (display name, goal/role-context, locale, timezone) — locale/timezone auto-filled from the browser, never a picker.
- A minimal set of accessibility preferences (theme, text-size step, optional reduced-motion override) that default to the system setting.
- Required consent recorded as **fields only** (boolean + timestamp + version) — no export/delete/retention tooling.
- **DB-enforced protected-field freeze**: a client cannot self-escalate `role` (on `profiles`) or the coach-owned `level` — rejected at the database, not just app code. This is the safe/protected write-safety discipline every later v1.1 phase reuses.
- A coach **read-only** detail view of an assigned client, reached from the coach client list; unassigned coaches default-denied.
- Extended `pnpm verify:rls` assertions and a green `pnpm build`.

**Not in this phase:** the full Home/Progress/Messages/Profile bottom-nav shell; the Progress tab / any metrics UI; assignment UI (seed-only); privacy tooling (export/delete/retention); coach editing of level (seed-owned).
</domain>

<decisions>
## Implementation Decisions

### Schema topology
- **D-01:** New fields live in a **separate `client_profiles` table**, 1:1 with `profiles` (PK = `id` references `public.profiles(id)` on delete cascade). Keeps coach rows lean, gives the field-freeze its own clean surface, and matches the success-criteria naming. `display_name` **stays on `profiles`** (existing column + existing own-profile RLS update policy); the edit flow writes display name to `profiles` and the rest to `client_profiles`.
- **D-02:** `client_profiles` is **auto-provisioned for clients** so a client always has a row to read/edit (extend the `handle_new_user` path / add an on-insert trigger for `role = 'client'`, plus backfill in the seed). The exact trigger vs. seed-backfill split is a planner detail; the guarantee is "no client is ever missing their row."
- **D-03:** **Goal/role-context is one freeform field** (a single gentle prompt, one text column) — least typing, calmest for the ADHD audience. Not two structured fields.
- **D-04:** Accessibility prefs are **nullable columns on `client_profiles`** (`theme_pref`, `text_size_pref`, `reduced_motion_pref`). **NULL = follow the system setting**; a non-null value is an explicit override. Consent is fields on the same table (`consented` boolean, `consented_at` timestamptz, `consent_version` text).

### Edit flow & entry point
- **D-05:** **Minimal `/profile` route this phase** — a quiet link from the client home reaches it; the full validated bottom-nav shell (Home/Progress/Messages/Profile) is deferred to its own phase (no dead Progress/Messages tabs shipped now).
- **D-06:** **Dedicated edit screen** at `/profile/edit`. The profile view stays a calm, read-only essentials + coach-card + settings surface with **no primary button** (per sketch 003 winner A); the edit screen carries the **single Save primary action**.
- **D-07:** Save is a **Next.js Server Action** writing through the existing own-profile RLS update policy (`profiles`) and the new safe-column grant (`client_profiles`), then returns to `/profile`. The form **prefills from the DB** on load; a **failed save keeps the typed text** and shows a calm `notice` (never red); a mid-edit refresh reverts to last-saved values — the same honest model as the v1.0 auth forms. No client-side optimistic path this phase (optimistic lifecycle belongs to chat, Phase 8).

### Protected-field freeze (the reused write-safety discipline)
- **D-08:** **Defense-in-depth, two layers.** (1) **Column-scoped UPDATE grant** — `GRANT UPDATE (goal, locale, timezone, theme_pref, text_size_pref, reduced_motion_pref, consented, consented_at, consent_version) ON public.client_profiles TO authenticated`; `level` is **never** granted to `authenticated`, so a client update touching it is denied at the Postgres privilege layer. (2) A **BEFORE-UPDATE trigger** that raises if a protected column (`level`) is changed by an `authenticated` caller (WHEN `auth.role() = 'authenticated'`, so `service_role` seed writes pass) — mirrors the shipped `prevent_role_self_escalation` trigger (0005) for a consistent, testable, centralized pattern with a clear error. `role` remains protected by the existing 0005 trigger on `profiles`.
- **D-09:** `verify:rls` must assert the freeze from the client's perspective (a client's attempt to change `level` is rejected at the DB) — see the RLS assertion set below.

### Coach read-only view
- **D-10:** The coach sees **identity (display name) + goal/role-context + level** on the client detail. **Accessibility prefs and consent status are hidden** — they're the client's personal settings, not coach-relevant this phase. Level is shown **as data, never a grade**.
- **D-11:** Route `/coach/clients/[id]`; the currently-inert coach **client-list rows become links** to it. Access is **RLS-gated by `is_coach_of`** (default-deny); an unassigned coach gets a calm not-found/denied state with **no cross-client leak** (the read simply returns nothing under RLS).

### Consent & accessibility preferences
- **D-12:** **One combined terms + privacy consent** (not granular), recorded as versioned fields (`consented` / `consented_at` / `consent_version`). Acknowledged **on the profile** (a calm "your agreement" affordance recording the current version via the same Server Action). **Non-blocking this phase** — no hard gate that competes with the Phase 5 onboarding first-run; the requirement is "record consent as fields," which this satisfies.
- **D-13:** **Three text-size steps** (e.g. Default / Large / Larger) mapping to a root font-size scale; default = system/browser. Small, calm, big tap targets — no settings buffet (PROF-03 cap of three prefs total: theme, text-size, reduced-motion).
- **D-14:** Preferences **apply instantly** (client-side, like the existing v1.0 theme toggle) **and persist to `client_profiles`** so they rehydrate on load across devices. Theme resolves through the existing `light-dark()` ladder; reduced-motion composes with `prefers-reduced-motion`; text-size default follows the browser. Stored value is an override; absence follows the system.

### Cross-cutting (woven per XC-01/02/03)
- **D-15:** **RLS assertions to add to `verify:rls`** for `client_profiles`: self-read, self-safe-update (succeeds), assigned-coach-read (succeeds), unassigned-coach-denial, cross-client-denial, protected-field-freeze (client `level` update rejected). `pnpm build` green (XC-01).
- **D-16:** `zod` v4 validation applies to the **profile edit payload** in `apps/web` and (where a command path exists) the Server Action — never in `packages/core` (XC-02). No `pg_jsonschema` config backstop needed here (profile columns are fixed, not data-driven config — that backstop lands in Phases 5/6).
- **D-17:** Every client-facing screen holds the **design line** — one primary action, assigned-never-chosen, 56px targets, monochrome, calm non-scolding copy, no lost work on refresh; the `sketch-findings-fish` skill is loaded before building any client UI (XC-03).

### Claude's Discretion
- Exact provisioning mechanism for `client_profiles` rows (trigger extension vs on-insert trigger vs seed-backfill) — planner/researcher decides, guarantee in D-02 holds.
- Column names/types, migration numbering (continues from `0006`), and how the edit Server Action splits the two-table write.
- Copy strings (calm, sentence case, soft `notice` tone), monogram/avatar rendering, and the precise "your agreement" affordance styling — apply the design line and sketch findings.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 4: Client Profiles" — goal, depends-on, success criteria (the scope anchor).
- `.planning/REQUIREMENTS.md` — PROF-01…PROF-06 and cross-cutting XC-01/XC-02/XC-03.
- `.planning/PROJECT.md` §"Key Decisions", §"Constraints" — locked stack/design/security decisions.
- `.planning/STATE.md` §"v1.1 roadmap decisions" — assignment seed-only, consent-fields-only, zod v4 as the one net-new dep.

### Design rules (non-negotiable — client UI)
- `AGENTS.md` §"Design rules" and §"Design tokens" — one primary action, assigned-never-chosen, 56px, visual-not-grade, calm copy, monochrome tokens.
- `docs/ui-ux-agent-guidelines.md` — consolidated PDF-derived UI/UX review reference (read before designing any screen).
- `.claude/skills/sketch-findings-fish/SKILL.md` and `references/profile-and-progress.md` — validated profile = **essentials only** (identity + coach card + settings, no primary button); Progress metrics live in a **separate** tab (out of this phase). Load the `sketch-findings-fish` skill before building the client UI.

### Existing schema/patterns this phase extends
- `supabase/migrations/0001_profiles.sql` — `profiles` table, self-read policy, table-grant pattern (why grants are needed before RLS).
- `supabase/migrations/0003_coach_clients.sql` — `coach_clients` relationship + role-integrity trigger.
- `supabase/migrations/0004_rls_helpers.sql` — `private.is_coach_of` / self-safe-update policy (the coach-read + own-update templates to reuse).
- `supabase/migrations/0005_role_guard.sql` — `prevent_role_self_escalation` trigger — the exact freeze pattern D-08 mirrors for `level`.
- `scripts/verify-rls.ts` — the live-assertion harness to extend per D-15.
- `scripts/seed.ts` — seed to backfill `client_profiles` rows and set a seeded `level`.
- `apps/web/app/(authenticated)/coach/page.tsx` + `apps/web/components/coach/client-list.tsx` — coach client list to wire to `/coach/clients/[id]`.
- `apps/web/app/(authenticated)/home/page.tsx` — client home to add the quiet `/profile` link.
- `apps/web/components/ui/` (Button, Input, Card, Progress, Alert) — reuse the kit; extend, don't hand-roll.
- `apps/web/lib/auth/` (`redirects.ts`, `server.ts`) — `authRedirects` single source of truth; server-side `getUser()` + role re-check pattern for the new routes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **UI kit** (`apps/web/components/ui/`): Button (single primary), Input (with `hint`/`notice`), Card, Alert (calm tones) — the edit form and profile surface build from these.
- **RLS helper `private.is_coach_of`** (0004): reuse verbatim for the coach client-detail read policy on `client_profiles`.
- **Trigger pattern `prevent_role_self_escalation`** (0005): copy the shape for the `level` freeze trigger (WHEN `auth.role() = 'authenticated'`, `security definer`, `set search_path = ''`).
- **`getCoachHomeData` / server auth helpers** (`apps/web/lib/auth/server.ts`): the server-side getUser + role pattern for `/profile`, `/profile/edit`, `/coach/clients/[id]`.
- **`verify-rls.ts` harness + `pnpm verify:rls`**: the release gate to extend with the six `client_profiles` assertions.
- **Existing theme toggle** (v1.0): the client-side apply-instantly pattern the a11y prefs extend; must be verified against served/compiled CSS (`light-dark()` polyfill), not authored CSS.

### Established Patterns
- **Table grants precede RLS** — every new table needs explicit `grant`s for `authenticated`/`service_role` (0001 comment), and column-scoped `GRANT UPDATE (...)` is the field-freeze layer 1.
- **Trigger-based freeze with `service_role` bypass** via the `WHEN (auth.role() = 'authenticated')` clause (seed writes pass).
- **RLS is the sole read-authz boundary** — no manual id filtering; coach detail relies on `is_coach_of` returning nothing for outsiders.
- **Server Components re-check role server-side per navigation** (`getUser()` + `profiles.role`); wrong-door guards + `authRedirects`.
- **Layout-stability contract** — no control resizes on state change; failed-save notice is out-of-flow / reserved.

### Integration Points
- Client home (`/home`) → quiet link → `/profile` → `/profile/edit`.
- Coach home (`/coach`) client-list rows → `/coach/clients/[id]`.
- New migration `0007+` on the existing local Supabase stack; seed + `verify:rls` extended.
- Root layout / theme apply-instantly hook for a11y prefs; persisted values loaded server-side on profile load.

</code_context>

<specifics>
## Specific Ideas

- Profile view mirrors sketch 003 **winner A · Essentials**: monogram avatar, display name in Fraunces, "Learning English", the assigned-coach card (avatar + presence dot + "Your English coach"), then settings rows (Appearance/theme, text size, reduced motion, your agreement, sign out) — each row ≥56px, no primary button.
- Level is displayed calmly as data (e.g. a quiet label), **never** a grade/score/percentage.
- Edit screen is deliberately small: display name, one "What are you working toward with your English?" text area, and the auto-filled locale/timezone shown as confirmed (not pickers) — single Save.
- Copy never scolds: a failed save reads like guidance in soft `notice` tone.

</specifics>

<deferred>
## Deferred Ideas

- **Full bottom-nav shell** (Home/Progress/Messages/Profile) — validated in the sketches but its own phase; only a minimal `/profile` route ships now.
- **Progress tab / milestone-journey UI** — separate tab, not this phase (metrics never live on the profile).
- **Coach editing of `level`** and any assignment/reassignment UI — assignment stays seed-only (deferred: ASGN-01 trigger = volume outgrows seed).
- **Full privacy tooling** (export/delete/retention/audit) — v1.1 captures consent *fields* only; the privacy milestone precedes public launch.
- **Granular / multi-document consent** and consent as a hard first-run gate — one combined versioned acknowledgement now; a gated first-run flow can pair with Phase 5 onboarding if a coach validates the need.

None of these block Phase 4 — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Client Profiles*
*Context gathered: 2026-07-04*
