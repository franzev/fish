---
phase: 01-monochrome-design-system-you-can-see
plan: 02
subsystem: ui
tags: [tailwind-v4, light-dark, oklch, tabler-icons, vitest, testing-library, wcag]

# Dependency graph
requires:
  - phase: 01-01
    provides: Monochrome light-dark() token ladder, Vitest/RTL test infra, hardened Button, /kit route with theme toggle
provides:
  - Hardened Input with notice/error two-tier split (D-08/D-09), disabled state, Tabler icons
  - --shadow-card light-dark() elevation token consumed by Card (no dark: branching, D-06)
  - /kit now renders Input (default/disabled/notice/error), Card (default/elevated), and Progress sections
affects: [01-03, auth-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-tier feedback (notice/error) distinguished structurally only: border weight, message font-weight, and Tabler icon shape — never a hue token"
    - "Elevation as a light-dark() token consumed via shadow-[var(--shadow-card)] — components stay theme-branch-free"
    - "error prop wins over notice when both are passed on the same Input (mutual exclusivity enforced in the class-list conditional, not by prop validation)"

key-files:
  created:
    - apps/web/components/ui/input.test.tsx
    - apps/web/components/ui/card.test.tsx
  modified:
    - apps/web/components/ui/input.tsx
    - apps/web/components/ui/card.tsx
    - apps/web/app/globals.css
    - apps/web/app/kit/page.tsx

key-decisions:
  - "--shadow-card uses a single shadow layer (not the plan's illustrative two-layer example) to avoid comma-parsing ambiguity between light-dark()'s two arguments and box-shadow's own comma-separated layer list inside the Tailwind v4 @theme block"
  - "Input's disabled input element gets disabled:opacity-50 (new), matching Button's existing disabled treatment, rather than inventing a new disabled visual language"

patterns-established:
  - "Notice/error tier split: notice && !error for the tier-1 branch, error && for tier-2 — error always wins when both props are present"
  - "Icon + message live in one flex row inside the existing <p> message block, not a restructured layout"

requirements-completed: [KIT-01, KIT-02, KIT-04, KIT-05, KIT-06]

# Metrics
duration: 8min
completed: 2026-07-02
---

# Phase 01 Plan 02: Input/Card/Progress Hardening Summary

**Input's notice/error two-tier system (border weight + message weight + Tabler icon, zero hue) and Card's light-dark() elevation token, both now demoed on /kit alongside Progress**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-02T08:36:10Z
- **Completed:** 2026-07-02T08:39:46Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (2 new test files, 4 modified/created source files)

## Accomplishments

- Hardened `Input` with a new `error` prop that is mutually exclusive with `notice` (error wins): notice tier renders `border-border-strong` + regular-weight message + `IconInfoCircle`; error tier renders `border-error border-2` + `font-semibold` message + `IconAlertCircle` — distinguished entirely by structure, never a red hue
- Added `disabled:opacity-50` to Input's field, matching Button's existing disabled language
- Added a `--shadow-card` `light-dark()` token to `globals.css` (soft shadow in light, `none` in dark) and wired `Card` to consume it via `shadow-[var(--shadow-card)]` with zero `dark:` variant branching
- Expanded `/kit` with Input (default, disabled, notice, error), Card (default, elevated), and Progress sections, all following the existing section-wrapper pattern

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Harden Input — notice/error two-tier split, disabled, Tabler icons** - `a3592c6` (test, RED: 3/5 failing) → `a3b653d` (feat, GREEN: 5/5)
2. **Task 2: Add Card elevation + render Input/Card/Progress on /kit** - `019c235` (test, RED: 1/3 failing) → `e3005d9` (feat, GREEN: 3/3)

## Files Created/Modified

- `apps/web/components/ui/input.tsx` - Added `error` prop, notice/error tier classes, Tabler icons in the message block, `disabled:opacity-50`
- `apps/web/components/ui/input.test.tsx` - RTL specs: tap target, notice tier, error tier, mutual exclusivity, disabled propagation
- `apps/web/components/ui/card.tsx` - Added `shadow-[var(--shadow-card)]` elevation utility to Card's class list
- `apps/web/components/ui/card.test.tsx` - RTL specs: elevation utility present, Progress ARIA triad + fill width, no bare percentage text
- `apps/web/app/globals.css` - Added `--shadow-card: light-dark(0 4px 16px oklch(0.15 0 0 / 0.08), none)` to `@theme`
- `apps/web/app/kit/page.tsx` - Added Input, Card, and Progress sections after the Button section

## Decisions Made

- Used a single-layer `--shadow-card` value instead of the plan's illustrative two-layer shadow to avoid ambiguity between `light-dark()`'s comma-separated two-argument syntax and `box-shadow`'s own comma-separated multi-layer syntax inside a Tailwind v4 `@theme` custom property. A single soft shadow layer satisfies D-06 (elevation is a token, resolves to `none` in dark) without introducing untested comma-nesting risk in the CSS build pipeline.
- Input's disabled state reuses `disabled:opacity-50` (the same Tailwind utility Button already uses for its disabled treatment) rather than inventing new disabled styling — keeps the calm/dim disabled language consistent across the kit.

## Deviations from Plan

None - plan executed exactly as written. The single-layer shadow choice (documented above under Decisions Made) is an implementation detail within the plan's D-06 elevation requirement, not a deviation from any specified behavior — the plan's shadow snippet was explicitly illustrative ("`<soft two-layer shadow using oklch(...) / low-alpha>`"), not a literal value to copy.

## Issues Encountered

None.

## Known Stubs

None. All Input/Card/Progress sections on `/kit` render real, wired components (no mock data, no empty-state placeholders standing in for unbuilt features).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Input's notice/error tier system and Card's elevation token are ready for Plan 03 (Alert component, which shares the exact same tone-config pattern per `01-PATTERNS.md`)
- Full suite: 42/42 green (34 from Plan 01 + 5 Input + 3 Card); `pnpm --filter @fish/web build`, `typecheck`, and `lint` all exit 0
- No blockers for 01-03-PLAN.md

## Self-Check: PASSED

- `apps/web/components/ui/input.test.tsx` — FOUND
- `apps/web/components/ui/card.test.tsx` — FOUND
- `apps/web/components/ui/input.tsx` contains `error` prop and Tabler icon imports — FOUND
- `apps/web/components/ui/card.tsx` contains `shadow-[var(--shadow-card)]` and zero `dark:` matches — FOUND
- `apps/web/app/globals.css` contains `--shadow-card` with `light-dark(` — FOUND
- `apps/web/app/kit/page.tsx` imports `Input`, `Card`, `Progress` and renders notice/error examples — FOUND
- All 4 task commits found in git log (a3592c6, a3b653d, 019c235, e3005d9)
- Full suite re-run: 42/42 green; `pnpm --filter @fish/web build` + `typecheck` + `lint` exit 0
- TDD gates: test-before-feat commit order verified for both TDD tasks

---
*Phase: 01-monochrome-design-system-you-can-see*
*Completed: 2026-07-02*
