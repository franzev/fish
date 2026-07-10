---
phase: 09-cross-platform-chat-state
plan: 18
subsystem: ui
tags: [tailwind, accessibility, chat-shell, design-tokens, gap-closure]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state
    provides: "The min-h-control/min-w-control 56px icon-target Tailwind pattern (--size-control token) established for message actions in Plan 09-11, and the /channels route consolidation from Plan 09-08 that made the app-shell's /chat comment stale."
provides:
  - "A 56px accessible logo tap target on the canonical app-shell header (WR-09 closed), reusing the existing --size-control token via min-h-control/min-w-control — no raw numeric utility, no tailwind.config.js."
  - "A deterministic accessible name (aria-label='FISH home') for the logo Link, replacing ambiguous nested-img alt-text name computation."
  - "Removal of the stale '/chat route was removed' comment and the 'channel/chat surface' wording from app-shell.tsx — zero /chat substrings remain."
  - "Two regression tests locking the 56px target classes and the no-/chat source assertion."
affects: [09-VERIFICATION, 09-UAT, milestone audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anchors/buttons that must clear the 56px floor but wrap only an icon/image use `inline-flex min-h-control min-w-control shrink-0 items-center justify-center` (the pattern already established by icon-button-class.ts, search-filter-popover.tsx, and filters-dialog.tsx) rather than inventing a new sizing convention."

key-files:
  created: []
  modified:
    - apps/web/components/shell/app-shell.tsx
    - apps/web/components/shell/app-shell.test.tsx

key-decisions:
  - "The logo aria-label is a static 'FISH home' regardless of role (client -> /home, coach -> /coach), matching the plan's own example. Both destinations are that role's landing screen, and a static label keeps the accessible name deterministic and simple rather than branching copy for a brand-mark link."

patterns-established:
  - "Regression tests for a 56px interaction-floor fix resolve the element by its aria-label/accessible name and assert className contains the specific control-sizing tokens (min-h-control, min-w-control) plus the centering utilities (items-center, justify-center) — not just a generic 'renders' smoke check."

requirements-completed: [CSTATE-06]

coverage:
  - id: D1
    description: "App-shell logo link enlarged to the 56px non-negotiable tap-target floor (min-h-control/min-w-control, centered via items-center/justify-center) with a deterministic aria-label."
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "apps/web/components/shell/app-shell.test.tsx#gives the logo link a centered 56px accessible target (WR-09)"
        status: pass
    human_judgment: true
    rationale: "The 56px CSS floor is unit-tested precisely (className assertions on the exact control tokens), but the plan's own <verification> block also calls for a visual HV check ('the logo tap target is comfortably 56px on the community shell'). Per this project's convention (no dev-server/browser preview for verification) and workflow.human_verify_mode=end-of-phase, that visual confirmation is deferred to the Phase 9 end-of-phase UAT batch rather than run here."
  - id: D2
    description: "Stale /chat route comment and 'channel/chat surface' wording removed from app-shell.tsx; zero /chat substrings remain in the file."
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "apps/web/components/shell/app-shell.test.tsx#WR-09: app-shell.tsx source contains no stale /chat route reference"
        status: pass
      - kind: other
        ref: "grep -c \"/chat\" apps/web/components/shell/app-shell.tsx returns 0"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 18: App-Shell Logo 56px Floor + /chat Cleanup Summary

**Enlarged the app-shell logo link to the 56px non-negotiable tap-target floor with `min-h-control`/`min-w-control` and a deterministic `aria-label`, and removed the last stale `/chat` route references from the shell, closing WR-09.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-10T09:24:00Z
- **Completed:** 2026-07-10T09:30:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- The app-shell logo `Link` grew from `shrink-0` (a 32px/40px image with no enforced box size) to `inline-flex min-h-control min-w-control shrink-0 items-center justify-center` — a 56px centered box around the unchanged 32px/40px responsive logo images, reusing the exact icon-target pattern already established for message actions and composer icon buttons.
- Added `aria-label="FISH home"` to the logo `Link`, giving it a deterministic accessible name instead of relying on browser-specific concatenation of two nested `<Image alt="FISH">` elements.
- Removed the stale "The `/chat` route was removed 2026-07-10 (community room supersedes it)." sentence from the immersive-surface comment, and reworded "immersive channel/chat surface" to "immersive channel surface" — `app-shell.tsx` now contains zero `/chat` substrings.
- Added two regression tests: one asserting the logo link (queried by its new aria-label) carries `min-h-control`, `min-w-control`, `items-center`, and `justify-center`; one source-assertion test (mirroring the existing D-09/SHEL-01 pattern) asserting `app-shell.tsx` never matches `/\/chat/`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enlarge the logo link to the 56px floor and clean stale /chat comments** - `38c3f7be` (fix)
2. **Task 2: Regression-test the 56px logo target and the /chat cleanup** - `c306c50d` (test)

**Plan metadata:** (this commit) `docs(09-18): complete app-shell logo 56px floor plan`

## Files Created/Modified
- `apps/web/components/shell/app-shell.tsx` - Logo `Link` className changed to a 56px centered target with `aria-label="FISH home"`; stale `/chat` comment text removed from the immersive-surface and channel-column comments.
- `apps/web/components/shell/app-shell.test.tsx` - Added the logo 56px-target behavior test and the no-`/chat` source assertion; all 11 pre-existing tests remain green (13/13 total after the additions).

## Decisions Made
- Used a static `aria-label="FISH home"` rather than a role-conditional label (e.g. different copy for coach vs. client) — see `key-decisions` above. Kept the fix minimal: no change to the logo images' sizes, no change to routing behavior, no new component.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the plan's `<action>` and `<acceptance_criteria>` on the first implementation pass; no auto-fixes, blockers, or architectural questions arose.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-09 is closed: the app-shell logo now meets the 56px interaction floor with an accessible name, and `app-shell.tsx` carries zero `/chat` references. `pnpm --filter @fish/web test app-shell` (13/13), `pnpm lint`, and `pnpm build` are all green; the full web suite (`pnpm --filter @fish/web test`) passes 487/487 across 61 files, confirming no regression from this shared-shell change.
- The plan's own `<verification>` block includes an HV (visual) line — "the logo tap target is comfortably 56px on the community shell" — that was not run here per this project's no-dev-server/no-browser-preview convention; it is deferred to the Phase 9 end-of-phase UAT batch (`09-UAT.md`) alongside the other outstanding Phase 9 human checks (HV-01..HV-04) already tracked there.
- `09-16-PLAN.md` (WR-06/WR-07/WR-02/WR-03 gap-closure) remains unexecuted (no `09-16-SUMMARY.md` yet) — unrelated to this plan (`depends_on: []` on both sides) and not a blocker for it.
- With 09-18 done, the WR-09 blocking product gate identified in `09-VERIFICATION.md` is closed; re-running phase verification should be able to move CSTATE-06 off "FAILED" for this specific defect (other CSTATE-06 gaps from `09-VERIFICATION.md` are outside this plan's scope).

## Self-Check: PASSED

- FOUND: apps/web/components/shell/app-shell.tsx
- FOUND: apps/web/components/shell/app-shell.test.tsx
- FOUND: 38c3f7be (Task 1 commit)
- FOUND: c306c50d (Task 2 commit)
- FOUND: .planning/phases/09-cross-platform-chat-state/09-18-SUMMARY.md

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*
