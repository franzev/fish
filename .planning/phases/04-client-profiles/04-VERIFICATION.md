---
phase: 04-client-profiles
verified: 2026-07-05T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
human_verification:
  - test: "Walk /profile and /profile/edit in a running dev server, in both light and dark themes"
    expected: "Profile view holds sketch 003 winner A (essentials only, zero primary buttons); edit screen has exactly one Save primary; failed-save notice renders in calm never-red tone; 56px row heights hold; both themes render correctly"
    why_human: "No automated visual/design-line test exists in this repo (XC-03); SUMMARY 04-02 explicitly flags this human_judgment: true"
  - test: "Toggle each of the three a11y prefs (theme, text-size, reduced-motion) in a running browser and confirm instant apply"
    expected: "Each pref applies instantly against the SERVED/compiled CSS (Lightning CSS light-dark() polyfill), not just authored CSS; values persist and rehydrate after reload"
    why_human: "Compiled CSS behavior cannot be verified by static grep — requires a live browser session per the repo's own durable convention (STATE.md)"
  - test: "Walk /coach/clients/[id] in a running dev server, in both themes"
    expected: "Read-only detail (no primary button), level rendered as a quiet data label (never a grade/percentage), a11y prefs and consent absent, calm not-found tone, roster rows keyboard-focusable"
    why_human: "No automated design-line/a11y assertion exists; SUMMARY 04-03 explicitly flags this human_judgment: true (D4)"
---

# Phase 4: Client Profiles Verification Report

**Phase Goal:** A client can view and safe-edit their own profile, a coach can read an assigned client's profile read-only, and protected fields cannot be self-escalated — establishing the safe/protected write-safety discipline the whole milestone reuses. Release gates (ROADMAP SC #5): `pnpm build` green and `pnpm verify:rls` green with self-read / self-safe-update / assigned-coach-read / unassigned-denial / cross-client-denial / protected-field-freeze assertions for `client_profiles`.

**Verified:** 2026-07-05T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A client can read their own `client_profiles` row through RLS (self-read) | VERIFIED | Re-ran `pnpm verify:rls` live against local Supabase — `PASS — PROF-01 client_profiles self-read: exactly one own row (got 1 rows)`. Policy `"client reads own client_profile"` in `supabase/migrations/0007_client_profiles.sql:42-46` gates on `id = (select auth.uid())`. |
| 2 | A client can update their own safe fields through RLS + column grant (safe-update succeeds) | VERIFIED | `PASS — PROF-02/04 client_profiles safe-update (goal + consent fields) succeeds`. `grant update (goal, locale, timezone, theme_pref, text_size_pref, reduced_motion_pref, consented, consented_at, consent_version)` in migration (0007:35-39); write routed through `updateProfileAction`/`updatePrefsAction`/`acceptConsentAction` → `ClientProfileRepository.updateSafeFields`. |
| 3 | A client's attempt to change `level` is rejected at the database (grant 42501 or trigger P0001) | VERIFIED | `PASS — PROF-05 level freeze: client's level update is rejected at the database (permission denied for table client_profiles)`. Grant list never names `level` (freeze layer 1); independent `prevent_level_self_escalation`/`prevent_level_change` BEFORE-UPDATE trigger exists as layer 2 (0007:66-84). `editProfileSchema` and `ClientProfileSafeFields` (a `Pick<>` allowlist, not `Omit<>`) both structurally exclude `level` as defense-in-depth — grepped `actions.ts` for `level`: zero references. |
| 4 | An assigned coach can read their client's row; an unassigned coach reads zero rows | VERIFIED | `PASS — PROF-06 coach reads assigned client_profile: exactly one row` and `PASS — PROF-06 unassigned coach denied: zero rows returned (no error, no leak)`. Policy reuses `private.is_coach_of(id)` verbatim from 0004 (0007:56-60); `findByIdForCoach` in `core.ts` issues the identical query with no app-code `coach_id`/`id` filter (confirmed by source-grep test in `coach/clients/[id]/page.test.tsx`). |
| 5 | A client cannot read another client's row (cross-client returns zero rows) | VERIFIED | `PASS — PROF-05/06 cross-client denied: zero rows returned for another client's row`. Same self-scoped RLS policy as truth #1 naturally denies this. |
| 6 | Every client (seed + real signup) always has a `client_profiles` row (auto-provisioned) | VERIFIED | `provision_client_profile_trigger` (`AFTER INSERT ON public.profiles`, 0007:107-109) inserts idempotently (`on conflict (id) do nothing`); `handle_new_user` (0002) confirmed byte-for-byte unchanged (`git diff` against pre-phase baseline is empty). `scripts/seed.ts` backfills a leveled row per client (`backfillClientProfile`) and a second, unassigned coach (`coach2@fish.dev`) for the negative-path fixtures. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0007_client_profiles.sql` | `client_profiles` table, column-scoped grants, RLS, level freeze, auto-provision | VERIFIED | Table (PK → `profiles(id) on delete cascade`), grants, 3 RLS policies, freeze trigger, provision trigger all present exactly as specified; applied and live on local DB. |
| `scripts/verify-rls.ts` | Six new `client_profiles` assertions wired into `main()` | VERIFIED | All six named functions present (`checkClientProfileSelfRead`, `checkClientProfileSafeUpdateSucceeds`, `checkLevelFreezeRejected`, `checkCoachReadsAssignedClientProfile`, `checkUnassignedCoachDenied`, `checkCrossClientDenied`); all called in `main()`; all sign in via `signInAs()` (real PostgREST, anon key) — zero `SET ROLE` usage. |
| `scripts/seed.ts` | `client_profiles` backfill + seeded level + second unassigned coach | VERIFIED | `backfillClientProfile()` upserts per-client level; `coach2@fish.dev` promoted but never passed to `assignClient()`. |
| `apps/web/app/(authenticated)/profile/page.tsx` | read-only essentials view, no primary button | VERIFIED | Renders identity, `CoachCard`, `A11yPrefs`, `ConsentRow`, sign-out. `grep 'variant="primary"'` → 0 matches. |
| `apps/web/app/(authenticated)/profile/edit/actions.ts` | `updateProfileAction` Server Action (zod-validated split write) | VERIFIED | `"use server"`; re-verifies `getCurrentUser()`; zod-validates via `editProfileSchema`; splits write across `profiles.updateDisplayName` + `clientProfiles.updateSafeFields`; calm notice on failure preserving typed values; `level` never referenced. |
| `apps/web/lib/validation/profile.ts` | `editProfileSchema` (zod v4, apps/web only) | VERIFIED | Present; `level` not a schema key; zod confirmed absent from root `package.json` and `packages/core`. |
| `apps/web/lib/prefs/apply-prefs.ts` | instant-apply DOM helpers via `data-*` attributes | VERIFIED | `applyTheme`/`applyTextSize`/`applyReducedMotion` — dataset flips only; zero `.style.*` mutations in any prefs file. |
| `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` | coach read-only client detail (RLS-gated, calm not-found) | VERIFIED | Shows display name + goal + level only; no primary button; identical `Alert tone="notice"` for both "no such client" and "not your client" (returns `null` client for both paths in `getCoachClientDetailData`). |
| `apps/web/components/coach/client-list.tsx` | client rows wrapped in `next/link` to `/coach/clients/[id]` | VERIFIED | Every row is a `<Link href={`/coach/clients/${client.id}`}>`; "not tappable yet" comment removed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `0007_client_profiles.sql` | `private.is_coach_of` | coach-read RLS policy | WIRED | Policy body is `using (private.is_coach_of(id))` — reused verbatim, not redefined. |
| `verify-rls.ts` | `public.client_profiles` | live PostgREST assertions via `signInAs()` | WIRED | Confirmed by direct re-run: 14/14 PASS, zero recursion errors (42P17 check present on every assertion). |
| `profile/edit/actions.ts` | `client_profiles` + `profiles` | split two-table write via repositories | WIRED | `services.database.profiles.updateDisplayName` + `services.database.clientProfiles.updateSafeFields`, both `ServiceResult`-typed. |
| `home/page.tsx` | `/profile` | quiet text link | WIRED | `<Link href="/profile" className="text-body underline">` present, not a button. |
| `a11y-prefs.tsx` | `document.documentElement.dataset` | instant-apply attribute flip | WIRED | Calls `applyTheme`/`applyTextSize`/`applyReducedMotion` on change and on mount (rehydration). |
| `coach/clients/[id]/page.tsx` | `client_profiles` (RLS `is_coach_of`) | `getCoachClientDetailData` → `findByIdForCoach` | WIRED | No app-code `coach_id=`/`id=` filter substituting for RLS — confirmed both by manual read and by a dedicated source-grep test in `page.test.tsx`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `/profile/page.tsx` | `data` (from `getProfileData()`) | `clientProfiles.findById` + `coachClients.findAssignmentForClient` + `profiles.findDisplayNameById`, all real Supabase queries | Yes | FLOWING |
| `/profile/edit/edit-profile-form.tsx` | `state.values` (from `useActionState`) | Server Action round-trip → DB write → redirect → Server Component re-fetch | Yes | FLOWING |
| `/coach/clients/[id]/page.tsx` | `data.client` | `getCoachClientDetailData` → `clientProfiles.findByIdForCoach` (RLS-scoped) + `profiles.findDisplayNameById` | Yes | FLOWING |
| `a11y-prefs.tsx` | `themePref`/`textSizePref`/`reducedMotionPref` props | `getProfileData()` → DB columns, narrowed via `toThemePref`/`toTextSizePref` | Yes | FLOWING |

No hollow props or static-empty-return patterns found in any Level-4-checked artifact.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `pnpm verify:rls` — all 14 assertions (8 pre-existing + 6 new) pass against live local Postgres/PostgREST | `pnpm verify:rls` | 14/14 PASS, exit 0 | PASS |
| `pnpm build` produces the expected new routes | `pnpm build` | 17 routes incl. `/profile`, `/profile/edit`, `/coach/clients/[id]` (all `ƒ` dynamic) | PASS |
| `pnpm lint` clean | `pnpm lint` | 0 errors | PASS |
| `pnpm typecheck` clean across all 3 workspace projects | `pnpm typecheck` | 0 errors | PASS |
| Full web test suite | `pnpm --filter @fish/web test -- --run` | 245/245 tests pass (35 files) | PASS |
| Zero primary buttons on `/profile` | `grep -c 'variant="primary"' profile/page.tsx` | 0 | PASS |
| Exactly one primary button on `/profile/edit` | `grep -c 'variant="primary"' edit-profile-form.tsx` | 1 | PASS |
| Zero primary buttons on coach detail | `grep -c 'variant="primary"' coach/clients/[id]/page.tsx` | 0 | PASS |
| `level` never referenced in the edit Server Action | `grep 'level' actions.ts` | no matches | PASS |
| Migration 0002 (`handle_new_user`) byte-for-byte unchanged | `git diff <pre-phase-baseline> -- 0002_handle_new_user.sql` | empty diff | PASS |
| zod installed in `apps/web` only | `node -e ...` on both `package.json` files | zod `^4.4.3` in `apps/web`; absent from root and `packages/core` | PASS |

All spot-checks re-run directly by the verifier against the live local Supabase stack (not taken from SUMMARY claims).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROF-01 | 04-01, 04-02 | A client can view their own profile | SATISFIED | `client_profiles` self-read RLS + `/profile` view render identity, coach card, settings; live `verify:rls` PASS. |
| PROF-02 | 04-02 | Client edits safe fields; locale/timezone auto-filled, never a picker | SATISFIED | `editProfileSchema` + `updateProfileAction`; `useSyncExternalStore` reads `navigator.language`/`Intl.DateTimeFormat` and renders as confirmed hidden-input values, no picker UI. |
| PROF-03 | 04-02 | At most 3 a11y prefs, defaulting to system | SATISFIED | `A11yPrefs` renders exactly 3 `role="group"` controls (test-asserted); `theme_pref`/`text_size_pref`/`reduced_motion_pref` all nullable, NULL = system default. |
| PROF-04 | 04-01, 04-02 | Consent recorded as fields only (boolean+timestamp+version) | SATISFIED | `consented`/`consented_at`/`consent_version` columns in the safe-grant list; `ConsentRow` + `acceptConsentAction` write through the same `updateSafeFields` path; live `verify:rls` PASS for the combined write. |
| PROF-05 | 04-01 | Protected fields (role, level) rejected at the DB, not just app code | SATISFIED | Two-layer freeze (column grant + BEFORE-UPDATE trigger) proven live via a real UPDATE attempt through PostgREST — DB-layer rejection confirmed (`permission denied for table client_profiles`), not merely app-level validation. |
| PROF-06 | 04-01, 04-03 | Coach reads assigned client read-only; unassigned denied | SATISFIED | `/coach/clients/[id]` + `getCoachClientDetailData` RLS-gated via `is_coach_of`; live `verify:rls` PASS for both the positive and negative (zero-rows, no-leak) cases; roster rows now link to the route. |

No orphaned requirement IDs: PLAN frontmatter across 04-01/02/03 declares exactly PROF-01..06, matching REQUIREMENTS.md's full Phase 4 traceability row set (all six marked "Complete").

### Anti-Patterns Found

None. Scanned all 19 phase-modified files for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented"/etc. — zero matches. No hardcoded empty-return stubs, no inline `.style.*` mutation bypassing the authored CSS rules, no app-code authorization filters substituting for RLS.

### Human Verification Required

#### 1. Visual design-line review of `/profile` and `/profile/edit` (XC-03)

**Test:** Walk both routes in a running dev server, in both light and dark themes.
**Expected:** `/profile` holds sketch 003 winner A (essentials only, zero primary buttons, 56px rows); `/profile/edit` has exactly one Save primary action; a failed save shows a calm never-red notice; both themes render correctly with no layout shift.
**Why human:** No automated visual/design-line test exists in this repo. SUMMARY 04-02 explicitly flags this `human_judgment: true` and states it is outstanding.

#### 2. Instant-apply a11y preferences against served CSS

**Test:** Toggle theme, text-size, and reduced-motion in a running browser session.
**Expected:** Each preference applies instantly against the compiled/served CSS (Lightning CSS `light-dark()` polyfill), not just the authored stylesheet; values persist to the DB and rehydrate correctly on reload/another session.
**Why human:** Compiled CSS behavior cannot be confirmed via static grep of source files; the repo's own durable convention requires a live-browser check for this class of change.

#### 3. Visual design-line review of `/coach/clients/[id]` (XC-03)

**Test:** Walk the coach detail route and the linked roster in a running dev server, in both themes.
**Expected:** Read-only detail with no primary button; level rendered as a quiet data label (never a grade/percentage); a11y prefs and consent absent from the coach's view; calm not-found tone for denied/missing clients; roster rows are visibly keyboard-focusable.
**Why human:** No automated design-line/a11y assertion exists for this view. SUMMARY 04-03 explicitly flags this `human_judgment: true` (item D4) as the one remaining sign-off item.

### Gaps Summary

No blocking or minor gaps. All 6 must-have observable truths are VERIFIED against live code and a live re-run of the DB-layer proof (`pnpm verify:rls`, 14/14), not merely SUMMARY claims. All required artifacts exist, are substantive, and are wired correctly with no orphaned or hollow paths. Requirements PROF-01 through PROF-06 are all satisfied with concrete evidence. The only open items are the three XC-03/design-line visual checks that both plan SUMMARYs themselves correctly flagged as `human_judgment: true` — these route to human verification per the decision tree (status cannot be `passed` while human-verification items are open), not because any check failed.

---

## Post-Verification Hardening (adversarial review)

After the goal-backward verification passed (6/6), a 4-dimension adversarial review of the Phase 4 diff was run (DB freeze/RLS, Server Action, verify:rls soundness, coach-view leak), each finding refuted by 3 independent skeptics before surviving. Three dimensions returned no confirmed defects; one confirmed defect (3/3 skeptics) was found and fixed:

- **HIGH — `getCoachClientDetailData` did not guard a non-UUID route id.** `.eq("id", clientId)` against a `uuid` column throws Postgres `22P02` for a malformed id (e.g. `/coach/clients/foo`, `/coach/clients/1`), which — with no error boundary in the tree — surfaced a distinguishable Next.js 500 instead of the calm not-found, breaking the uniform-not-found / no-enumeration contract (T-04-02, D-11). Missed by the automated gates because `verify:rls` only exercises real UUIDs and the coach page test mocks the data accessor wholesale.
- **Fix:** `378269b` — a UUID-format guard in `getCoachClientDetailData` returns the identical `{ role, client: null }` not-found for any non-UUID id (no DB round-trip), plus `apps/web/lib/auth/server.test.ts` (3 regression cases: malformed id, numeric/injection-shaped ids, valid-UUID-null). All gates re-run green (`build` 17 routes, `verify:rls` 14/14, `lint`, `typecheck`, **248 tests**).

## Live Verification Attempt (browser)

A live browser pass was attempted via a fresh preview server on `localhost:3001`. The `/login` page rendered correctly and the calm, non-red error-notice copy was confirmed live (an XC-03 data point). Full pixel verification of the authenticated screens was blocked by a **preview-only** `.env.local` `NEXT_PUBLIC_SUPABASE_URL` client-config condition that makes the app's Supabase client unreachable for **all** authenticated routes (home/coach/profile alike) — not a Phase 4 defect. Independently confirmed from the browser that `client1@fish.dev`'s credentials + the local auth endpoint work (token grant → 200) and that Node-side `verify:rls` signs in and passes. The three visual design-line items therefore remain a recommended human eyeball; every underlying property was confirmed at the code/CSS level.

---

*Verified: 2026-07-05T00:00:00Z*
*Verifier: Claude (gsd-verifier)*
*Hardened: 2026-07-05 (adversarial review + fix 378269b)*
