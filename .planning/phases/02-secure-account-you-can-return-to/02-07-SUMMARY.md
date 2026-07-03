---
phase: 02-secure-account-you-can-return-to
plan: 07
subsystem: ui
tags: [react, tailwind, layout-stability, input, login, notice-tier]

# Dependency graph
requires:
  - phase: 01-monochrome-design-system-you-can-see
    provides: "Input notice/error two-tier split, Button's overlay-spinner layout-stability contract"
provides:
  - "Input component with an always-mounted, min-height-reserved message row (hint/notice/error no longer toggle geometry)"
  - "/login wrong-password copy rendered in the tier-1 soft notice tone, not the heavy tier-2 error tone"
  - "Human-verified zero-layout-shift wrong-password flow at 1440x900 (UAT test 7 closed)"
affects: [phase-03-role-aware-home, ui-kit, login, signup, reset-password]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layout-stability contract extended from Button (overlay spinner) to Input (reserved message row) — a persistent min-h-[22px] container always renders, so hint/notice/error changes text, never geometry."

key-files:
  created: []
  modified:
    - apps/web/components/ui/input.tsx
    - apps/web/components/ui/input.test.tsx
    - apps/web/app/login/page.tsx
    - apps/web/app/login/page.test.tsx

key-decisions:
  - "Message row spacing (mt-2) moved from each conditional <p> onto the single persistent container, so the gap above the message is also constant, not just the row height."
  - "Tier semantics (hint/notice/error precedence, styling, icons) preserved exactly — only the mounting/geometry behavior changed."

patterns-established:
  - "Reserved-geometry message row: Input's message area is always in the DOM at a fixed min-height; presence/absence of a message swaps text content only, matching Button's opacity-0-label-plus-overlay-spinner technique from phase 01."

requirements-completed: [AUTH-03, KIT-02]

coverage:
  - id: D1
    description: "Input reserves constant vertical space for its message row regardless of hint/notice/error presence (layout-stability contract)"
    requirement: "KIT-02"
    verification:
      - kind: unit
        ref: "apps/web/components/ui/input.test.tsx — message row always present + min-h reservation tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Existing Input tier tests (notice styling, error styling, error-wins-over-notice, 56px tap target, disabled) still pass with no regression"
    requirement: "KIT-02"
    verification:
      - kind: unit
        ref: "apps/web/components/ui/input.test.tsx — full suite"
        status: pass
    human_judgment: false
  - id: D3
    description: "/login wrong-password copy renders via the tier-1 notice prop (regular weight, info icon, text-notice) instead of tier-2 error"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "apps/web/app/login/page.test.tsx — notice-tier assertion (no font-semibold on message element)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Existing login tests (anti-enumeration copy, email_not_confirmed routing, network-failure copy, exactly one primary button/two inputs/two links) still pass"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "apps/web/app/login/page.test.tsx — full suite"
        status: pass
    human_judgment: false
  - id: D5
    description: "UAT test 7 re-run: wrong password on /login shows the message in the notice tone with zero page movement (heading, button, card height, both footer links all 0.00px delta), no reload, URL and field values preserved"
    requirement: "AUTH-03"
    verification:
      - kind: manual_procedural
        ref: "Human-verified via real Chromium browser (1440x900) against live dev server on :3001 with local Supabase stack; bounding-rect deltas measured before/after submit"
      - kind: e2e
        ref: "Regression probes: double-submit still renders exactly one message (0.00px deltas); signup tier-2 duplicate-email error still semibold/alert-icon/text-error/border-error-2px; happy-path login/logout still redirects correctly"
    human_judgment: true
    rationale: "Visual/layout verification (pixel-level absence of movement, tone perception) requires a human-observed or human-delegated browser session; not fully provable by unit tests alone."

duration: 2min
completed: 2026-07-03
status: complete
---

# Phase 02 Plan 07: Gap Closure — Login Wrong-Password Layout Stability Summary

**Input now reserves constant message-row height and /login's wrong-password copy renders in the soft tier-1 notice tone, closing UAT test 7 with a verified zero-pixel layout shift.**

## Performance

- **Duration:** 2 min (checkpoint approval only; Tasks 1-2 completed in a prior session)
- **Completed:** 2026-07-03
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments
- Input's hint/notice/error message area is now a single, always-mounted container with a `min-h-[22px]` reservation — the same layout-stability principle Button already applies to its loading spinner. Showing or hiding a message now changes text, never geometry.
- `/login`'s wrong-password (and connection-failure) copy is wired to the tier-1 `notice` prop instead of the heavy tier-2 `error` prop, rendering in regular weight with an info icon in the monochrome `text-notice` tone — never red, never semibold.
- UAT test 7 re-run confirmed in a real browser at 1440x900: the wrong-password message appears in place with 0.00px movement of the heading, button, card height, and both footer links (down from a diagnosed 14.8px jump pre-fix).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reserve constant message-row height in Input (layout-stability contract)** - `cae9ca5` (feat)
2. **Task 2: Wire /login wrong-password copy to the tier-1 notice tone** - `a04ccaf` (fix)
3. **Task 3: UAT test 7 re-run — wrong-password message is calm and in place** - checkpoint approved, no code changes

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/web/components/ui/input.tsx` - Message row restructured into one always-mounted container with `min-h-[22px]`; tier semantics (hint/notice/error precedence, styling, icons) unchanged
- `apps/web/components/ui/input.test.tsx` - Added tests asserting the message row is always present in the DOM and reserves constant min-height independent of message presence
- `apps/web/app/login/page.tsx` - Password Input's `error={passwordError || undefined}` changed to `notice={passwordError || undefined}`
- `apps/web/app/login/page.test.tsx` - Added test asserting the bad-credentials message renders without `font-semibold` (proving the notice tier, not error tier, is used)

## Decisions Made
- Message row spacing (`mt-2`) moved from each conditional `<p>` onto the single persistent container so the gap above the message is also constant, not just the row's own height.
- Tier semantics (hint/notice/error precedence, styling, icons) preserved exactly — this plan only changed mounting/geometry behavior, not visual tiering logic.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1-2 were completed and verified (`pnpm test -- --run` 123/123 green across 15 files, `pnpm build` clean) in a prior session; this session only recorded the Task 3 checkpoint approval.

## Issues Encountered

None. The Task 3 checkpoint was a human-verify gate requiring a live browser session; the orchestrator delegated verification to a real Chromium instance (1440x900) against the dev server on :3001 with the local Supabase stack up, and the user approved with full evidence (see Checkpoint Evidence below).

## Checkpoint Evidence (Task 3 — approved)

- **Wrong password** (client1@fish.dev + bad password): "That email and password don't match. Try again?" appeared under the Password field. Bounding-rect deltas before vs. after: h2 heading 0.00px, submit button 0.00px, both footer links 0.00px, card height 0.00px (was a 14.8px jump pre-fix). No reload, URL stayed `/login`, field values kept.
- **Tone verification:** message row class `flex items-center gap-1.5 text-[14px] text-notice`, computed font-weight 400 (regular), achromatic color (lab a/b ≈ 0 — monochrome, not red), icon `tabler-icon-info-circle`. Password field border stayed 1px, no `border-error` class.
- **Reserved rows:** two always-present `mt-2 min-h-[22px]` containers rendered at exactly 22px before AND after the message, empty state included.
- **Probe — double submit:** still exactly one message, all deltas 0.00px.
- **Probe — signup tier-2 regression:** duplicate-email signup error still renders font-weight 600 semibold, `tabler-icon-alert-circle`, `text-error`, email field `border-error` 2px — heavy tier intact, no regression.
- **Probe — happy path:** correct seeded password logged in and landed on `/home`; logout returned to `/login`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 02's last identified gap (UAT test 7) is closed. All 7 plans in Phase 02 (5 executed waves + 2 gap-closure plans, 02-06 and 02-07) are complete. Phase 02 is ready for a final phase-level verification pass covering UAT tests 4-13 (per STATE.md's Session Continuity note) before Phase 03 (Role-aware home) begins.

---
*Phase: 02-secure-account-you-can-return-to*
*Completed: 2026-07-03*
