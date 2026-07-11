---
phase: 04-client-profiles
plan: 02
subsystem: ui
tags: [nextjs, server-actions, zod, react-19, a11y-prefs, supabase, useActionState]

# Dependency graph
requires:
  - phase: 04-01 (Client Profiles Schema)
    provides: client_profiles table, RLS policies, two-layer level freeze (grant + trigger), zod ^4.4.3 installed
provides:
  - "/profile read-only essentials view (identity + coach card + settings, zero primary buttons)"
  - "/profile/edit safe-edit screen with the repo's first Server Action (updateProfileAction, useActionState)"
  - "editProfileSchema (zod v4, apps/web only) validating displayName/goal/locale/timezone"
  - "SupabaseClientProfileRepository + ClientProfileRepository interface (updateSafeFields excludes level by type)"
  - "getProfileData() server data-access (identity + goal/locale/timezone/level + prefs + consent + coachName)"
  - "Three accessibility preferences (theme/text-size/reduced-motion) — instant-apply via data-* attributes + persisted via updatePrefsAction"
  - "Combined consent affordance (acceptConsentAction) recording boolean + timestamp + version"
  - "Quiet /profile link from client home"
affects: [04-03, 05-onboarding, 06-tracker, 07-chat-schema, 08-chat-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action + useActionState (RESEARCH Pattern 2) — the repo's first real form Server Action; re-verify getUser() inside the action, never trust the calling page's own guard (T-04-05)"
    - "Instant-apply user preference via html[data-*] attribute + Lightning CSS stylesheet rules (never inline style mutation), extending the KitThemeToggle mechanism under NEW attribute names so dev preview and product session never collide"
    - "Column-scoped write payloads typed at the TS layer (ClientProfileSafeFields) to exclude a protected field by construction, on top of the DB grant+trigger freeze from 04-01"

key-files:
  created:
    - apps/web/lib/validation/profile.ts
    - apps/web/lib/validation/profile.test.ts
    - apps/web/lib/prefs/apply-prefs.ts
    - apps/web/app/(authenticated)/profile/page.tsx
    - apps/web/app/(authenticated)/profile/edit/page.tsx
    - apps/web/app/(authenticated)/profile/edit/actions.ts
    - apps/web/app/(authenticated)/profile/edit/actions.test.ts
    - apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx
    - apps/web/components/profile/coach-card.tsx
    - apps/web/components/profile/settings-row.tsx
    - apps/web/components/profile/a11y-prefs.tsx
    - apps/web/components/profile/a11y-prefs.test.tsx
    - apps/web/components/profile/consent-row.tsx
  modified:
    - apps/web/lib/services/supabase/types.ts
    - apps/web/lib/services/supabase/core.ts
    - apps/web/lib/auth/server.ts
    - apps/web/app/globals.css
    - apps/web/app/(authenticated)/home/page.tsx
    - packages/supabase/src/database.generated.ts
    - packages/supabase/src/database.types.ts

key-decisions:
  - "Regenerated packages/supabase/src/database.generated.ts (supabase gen types typescript --local) before Task 1's own action list — it still reflected pre-client_profiles schema even though 04-01 migrated the DB; without this, ClientProfileRow could not exist. Rule 3 blocking-issue fix."
  - "Narrowed the DB's CHECK-constrained text columns (theme_pref/text_size_pref) to literal TS unions at the getProfileData() server boundary (toThemePref/toTextSizePref), rather than threading `string | null` through every client component — keeps A11yPrefs' prop types exact."
  - "Housed both updateProfileAction (Task 3) and updatePrefsAction (Task 2's a11y-prefs persistence) in the same actions.ts file, since Task 2's plan text called for 'keep the persist path consistent with the Server Action' and the plan's files_modified list only names one edit/actions.ts — created it in Task 2 with updatePrefsAction, extended it in Task 3 with updateProfileAction."
  - "Added consent-row.tsx + acceptConsentAction (not explicitly named in the plan's files_modified list, but required by PROF-04/D-12's 'a calm affordance recording the current version' — the plan's SUMMARY output spec explicitly asks for the consent affordance to be documented) — kept minimal: a single settings row that goes quiet once accepted for the current version string."
  - "LogoutButton (existing v1.0 component) reused verbatim for the 'Sign out' settings row rather than rebuilding sign-out — it's already the correct ghost/secondary shape."

patterns-established:
  - "Pattern: any future Server Action mutating a protected-adjacent table types its write payload as a Pick<> that structurally excludes the protected column, on top of the DB-level freeze — same discipline as ClientProfileSafeFields."
  - "Pattern: product-facing instant-apply preferences get their OWN data-* attribute name, distinct from any dev-only preview attribute already in globals.css, to prevent a real session and a dev tool from colliding."

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04]

coverage:
  - id: D1
    description: "/profile renders identity (avatar + display name + 'Learning English'), the assigned coach card, and settings rows (Edit profile, Appearance, Text size, Reduced motion, Your agreement, Sign out) with zero variant=\"primary\" buttons on the view"
    requirement: "PROF-01"
    verification:
      - kind: other
        ref: "grep 'variant=\"primary\"' apps/web/app/(authenticated)/profile/page.tsx — zero matches"
        status: pass
      - kind: unit
        ref: "pnpm --filter @fish/web typecheck — clean"
        status: pass
    human_judgment: true
    rationale: "Visual/spacing/56px-row and calm-tone verification (XC-03 design line) has no automated test in this repo; requires a human to view /profile in both themes per the plan's own <verification> section."
  - id: D2
    description: "/profile/edit lets a client change display name + goal/role-context; Save is a zod-validated Server Action (updateProfileAction) that splits the write across profiles.display_name and client_profiles safe fields, redirects to /profile on success, and preserves typed values with a calm notice on failure (D-07); locale/timezone are auto-filled from the browser (Intl/navigator) and shown as confirmed read-only values, never a picker"
    requirement: "PROF-02"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/profile/edit/actions.test.ts — all 5 tests pass (invalid displayName preserves values; valid payload writes + redirects; write failure returns calm notice + preserved values; no-session re-verify gate; no 'level' reference in source)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly three accessibility preferences (theme/text-size/reduced-motion) default to system (null) and apply instantly via html[data-*] attributes authored as stylesheet rules (never inline style), then persist to client_profiles via updatePrefsAction so they rehydrate on load"
    requirement: "PROF-03"
    verification:
      - kind: unit
        ref: "apps/web/components/profile/a11y-prefs.test.tsx — 3/3 pass: exactly 3 role=group controls; theme + reduced-motion default to System when prop is null; text-size defaults to Default when prop is null"
        status: pass
      - kind: other
        ref: "grep 'html\\[data-theme=\\|html\\[data-text-size=\\|html\\[data-reduced-motion=' apps/web/app/globals.css — all three rule families present"
        status: pass
    human_judgment: true
    rationale: "Instant-apply must be verified against served/compiled CSS (Lightning CSS light-dark() polyfill), not authored CSS alone, per STATE.md's durable convention — requires a human to toggle each pref in a running browser."
  - id: D4
    description: "Combined consent (boolean + timestamp + version) is recorded via a calm 'Your agreement' settings-row affordance, writing through the same updateSafeFields path as the rest of the edit flow"
    requirement: "PROF-04"
    verification:
      - kind: unit
        ref: "pnpm --filter @fish/web typecheck — clean (acceptConsentAction + ConsentRow compile against ClientProfileSafeFields)"
        status: pass
    human_judgment: true
    rationale: "No automated test exercises the click-to-accept interaction (component test was not required by the plan's verify step for this file); a human should confirm the row goes quiet after accepting, per the plan's calm-affordance intent."

duration: 26min
completed: 2026-07-04
status: complete
---

# Phase 4 Plan 2: Client Profile UI Summary

**The repo's first Next.js Server Action (`updateProfileAction`, `useActionState`) driving a calm essentials-only `/profile` view and a single-primary-action `/profile/edit` safe-edit screen, with three instant-apply + DB-persisted accessibility preferences and a combined-consent affordance — all routed through a new `SupabaseClientProfileRepository` that types `level` out of every write payload.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-04T16:09:10Z (approx, from context load)
- **Completed:** 2026-07-04T16:35:10Z
- **Tasks:** 3 (Task 3 was TDD: RED commit + GREEN commit)
- **Files modified:** 20 (13 created, 7 modified)

## Accomplishments

- `/profile` (Server Component): identity (monogram avatar + Fraunces display name + "Learning English"), the assigned coach card, and a settings block (Edit profile, Appearance, Text size, Reduced motion, Your agreement, Sign out) — zero `variant="primary"` buttons anywhere on the view (D-06), matching sketch 003 winner A.
- `/profile/edit` (Server Component + Client form): the repo's FIRST Server Action (`updateProfileAction`), built on `useActionState` with uncontrolled `defaultValue` fields. zod-validates via `editProfileSchema`, re-verifies `getUser()` inside the action (never trusts the calling page — T-04-05), splits the write across `profiles.display_name` and `client_profiles` safe fields, redirects to `/profile` on success, and on any failure returns the SAME typed values with a calm `notice` (D-07) — nothing is ever cleared.
- Locale/timezone are read once from `Intl.DateTimeFormat().resolvedOptions().timeZone`/`navigator.language` on mount and shown as confirmed, non-editable values — never a picker (PROF-02).
- Three accessibility preferences (theme/text-size/reduced-motion), each defaulting to "follow system" (null): instant-apply via `html[data-theme]`/`[data-text-size]`/`[data-reduced-motion]` attribute flips (new, product-facing attribute names, distinct from the dev-only `data-kit-theme`), authored as `globals.css` stylesheet rules (never inline style — Pitfall 5), and persisted via a new `updatePrefsAction` so they rehydrate on load/another device (D-14).
- Combined consent (`consented`/`consented_at`/`consent_version`) recorded via a calm "Your agreement" settings row (`ConsentRow` + `acceptConsentAction`) — non-blocking, the row goes quiet once accepted for the current version.
- `SupabaseClientProfileRepository` (`findById`, `findByIdForCoach`, `updateSafeFields`) registered in `SupabaseDatabaseServiceImpl`; `ClientProfileSafeFields` is a `Pick<>` type that structurally excludes `level` — defense-in-depth above the 04-01 DB grant+trigger freeze.
- `getProfileData()` server data-access assembling identity + goal/locale/timezone/level + all three prefs + consent + the assigned coach's display name, reusing the coach-name read pattern from `getClientHomeData`.
- A quiet text link to `/profile` added to the client home (D-05) — not a primary button.
- `packages/supabase/src/database.generated.ts` regenerated (`supabase gen types typescript --local`) to include `client_profiles` — it had not been regenerated since the 04-01 migration landed.

## Task Commits

Each task was committed atomically:

1. **Task 1: ClientProfileRepository + server data access + zod schema** - `0d2f61a` (feat)
2. **Task 2: /profile view + coach-card + settings-row + a11y-prefs + home link** - `447e756` (feat)
3. **Task 3: /profile/edit Server Action + form** - RED `46b824c` (test) → GREEN `f678892` (feat)

**Plan metadata:** (this commit — see Final Commit below)

## Files Created/Modified

- `apps/web/lib/validation/profile.ts` - `editProfileSchema` (zod v4, apps/web only per D-16)
- `apps/web/lib/validation/profile.test.ts` - schema behavior tests (empty name rejected, valid payload, level stripped, trimming)
- `apps/web/lib/prefs/apply-prefs.ts` - `applyTheme`/`applyTextSize`/`applyReducedMotion` dataset-flip helpers
- `apps/web/app/(authenticated)/profile/page.tsx` - the essentials-only read view
- `apps/web/app/(authenticated)/profile/edit/page.tsx` - Server Component prefilling the edit form
- `apps/web/app/(authenticated)/profile/edit/actions.ts` - `updateProfileAction`, `updatePrefsAction`, `acceptConsentAction` ("use server")
- `apps/web/app/(authenticated)/profile/edit/actions.test.ts` - Server Action behavior tests
- `apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx` - `useActionState` form, single Save primary
- `apps/web/components/profile/coach-card.tsx` - assigned-coach row (non-tappable this phase — no client-facing destination exists)
- `apps/web/components/profile/settings-row.tsx` - reusable >=56px settings row
- `apps/web/components/profile/a11y-prefs.tsx` - the three preference controls
- `apps/web/components/profile/a11y-prefs.test.tsx` - asserts exactly 3 controls, system-default when null
- `apps/web/components/profile/consent-row.tsx` - combined consent affordance
- `apps/web/lib/services/supabase/types.ts` - `ClientProfileRepository`/`ClientProfileSafeFields`/`ClientProfileRow`, `ProfileRepository.updateDisplayName`
- `apps/web/lib/services/supabase/core.ts` - `SupabaseClientProfileRepository`, `ProfileRepository.updateDisplayName` impl, registered in `SupabaseDatabaseServiceImpl`
- `apps/web/lib/auth/server.ts` - `getProfileData()`, `ThemePref`/`TextSizePref` narrowing helpers
- `apps/web/app/globals.css` - new `html[data-theme]`/`[data-text-size]`/`[data-reduced-motion]` stylesheet rules
- `apps/web/app/(authenticated)/home/page.tsx` - quiet `/profile` link
- `packages/supabase/src/database.generated.ts` - regenerated to include `client_profiles`
- `packages/supabase/src/database.types.ts` - exports `ClientProfileRow`

## Decisions Made

- Regenerated `database.generated.ts` before starting Task 1's listed actions — the file still reflected the pre-`client_profiles` schema despite 04-01 having migrated the DB; without it `ClientProfileRow` could not be typed. Verified via `npx supabase gen types typescript --local` against the running local stack, then hand-merged into the tracked file (a shell redirect attempt truncated the file to empty first; recovered via `git checkout --`).
- Narrowed `theme_pref`/`text_size_pref` from the DB's CHECK-constrained `string | null` to literal TS unions (`ThemePref`/`TextSizePref`) at the `getProfileData()` boundary, keeping `A11yPrefs`'s prop types exact instead of widening them to `string | null` everywhere.
- `updatePrefsAction` and `acceptConsentAction` both live in `edit/actions.ts` alongside `updateProfileAction` — the plan's `files_modified` list names only one `actions.ts`, and both persist through the identical `updateSafeFields` path, so keeping them in one Server Action module (rather than inventing a second file outside the plan's file list) matched both the plan's instruction to "keep the persist path consistent with the Server Action" and its literal file scope.
- `LogoutButton` (existing v1.0 shell component) reused verbatim for the "Sign out" settings row instead of rebuilding sign-out logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated `database.generated.ts` for `client_profiles`**
- **Found during:** Task 1
- **Issue:** `packages/supabase/src/database.generated.ts` had not been regenerated since the 04-01 migration created `client_profiles`; `Database["public"]["Tables"]["client_profiles"]` did not exist, so `ClientProfileRow` could not be defined and Task 1 would fail to typecheck.
- **Fix:** Ran `npx supabase gen types typescript --local` against the running local Supabase stack and merged the `client_profiles` table block into the tracked generated-types file.
- **Files modified:** `packages/supabase/src/database.generated.ts`, `packages/supabase/src/database.types.ts` (added the `ClientProfileRow` re-export)
- **Verification:** `pnpm --filter @fish/web typecheck` passes; `pnpm build` (full monorepo) green.
- **Committed in:** `0d2f61a` (Task 1 commit)

**2. [Rule 1 - Bug] Narrowed DB string columns to literal unions at the server boundary**
- **Found during:** Task 2 (writing `/profile/page.tsx`)
- **Issue:** `pnpm --filter @fish/web typecheck` failed — `ClientProfileRow["theme_pref"]`/`["text_size_pref"]` are typed `string | null` (CHECK-constrained `text` columns, not Postgres enums), which is not assignable to `A11yPrefs`'s literal-union props.
- **Fix:** Added `toThemePref`/`toTextSizePref` narrowing helpers in `lib/auth/server.ts`, applied at the `getProfileData()` return boundary.
- **Files modified:** `apps/web/lib/auth/server.ts`
- **Verification:** `pnpm --filter @fish/web typecheck` clean; all 239 tests pass.
- **Committed in:** `447e756` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both were prerequisites for the plan's own listed files to typecheck/compile — no scope creep beyond what Task 1/Task 2 already required.

## Issues Encountered

- A shell redirect (`npx supabase gen types ... > file`) attempted to write through `/tmp_gen_err`, which failed under the sandboxed filesystem and, in a separate command, truncated `database.generated.ts` to zero bytes. Recovered immediately via `git checkout -- packages/supabase/src/database.generated.ts`, then regenerated the type output into the scratchpad directory first and merged it in via the Edit tool instead of a raw shell redirect. No data loss — caught before any commit.

## User Setup Required

None - no external service configuration required. This plan is 100% local; the local Supabase stack (already running from 04-01) required no changes beyond the type regeneration above.

## Next Phase Readiness

- `/profile` and `/profile/edit` are live client-facing routes reading and writing through the 04-01 schema with no further DB work required.
- The Server Action + `useActionState` pattern (`updateProfileAction`) is now the repo's reference implementation for any future form that needs a real server round-trip — Phase 5 (onboarding) and Phase 6 (tracker) can follow it directly.
- `ClientProfileRepository`/`ClientProfileSafeFields` establish the reusable shape for typing a protected-field-safe write payload; any future phase adding another protected/coach-owned column should mirror this pattern.
- Plan 04-03 (coach read-only client detail view) can build directly against `SupabaseClientProfileRepository.findByIdForCoach` — already implemented and registered, unused until 04-03 wires its route.
- Outstanding manual verification (XC-03 design line, both themes, instant a11y-pref apply against served CSS) is flagged in the `coverage` block above as `human_judgment: true` — no automated design-line test exists in this repo yet; a human should walk `/profile` and `/profile/edit` in a running dev server before this plan is considered fully UAT-closed.
- `pnpm build` (full monorepo) and `pnpm --filter @fish/web test -- --run` (239/239) are both green — no regression to any prior phase's tests.

---
*Phase: 04-client-profiles*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: apps/web/lib/validation/profile.ts
- FOUND: apps/web/lib/validation/profile.test.ts
- FOUND: apps/web/lib/prefs/apply-prefs.ts
- FOUND: apps/web/app/(authenticated)/profile/page.tsx
- FOUND: apps/web/app/(authenticated)/profile/edit/page.tsx
- FOUND: apps/web/app/(authenticated)/profile/edit/actions.ts
- FOUND: apps/web/app/(authenticated)/profile/edit/actions.test.ts
- FOUND: apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx
- FOUND: apps/web/components/profile/coach-card.tsx
- FOUND: apps/web/components/profile/settings-row.tsx
- FOUND: apps/web/components/profile/a11y-prefs.tsx
- FOUND: apps/web/components/profile/a11y-prefs.test.tsx
- FOUND: apps/web/components/profile/consent-row.tsx
- FOUND: 0d2f61a (Task 1 commit)
- FOUND: 447e756 (Task 2 commit)
- FOUND: 46b824c (Task 3 RED commit)
- FOUND: f678892 (Task 3 GREEN commit)
- FOUND: b8bcab6 (SUMMARY commit)
