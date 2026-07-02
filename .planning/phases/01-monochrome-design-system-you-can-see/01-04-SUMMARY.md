---
phase: 01-monochrome-design-system-you-can-see
plan: 04
subsystem: ui
tags: [css, accessibility, wcag, focus-ring, contrast, vitest, colorjs.io, gap-closure]

# Dependency graph
requires:
  - phase: 01-monochrome-design-system-you-can-see
    provides: "Monochrome token ladder and contrast-test single-source-of-truth pattern from 01-01"
provides:
  - "Corrected two-tone :focus-visible ring — outer band contrasts the page, inner band contrasts the inverted primary fill"
  - "focus-ring.test.ts regression tripwire preventing the swap defect from silently shipping again"
  - "5 additional WR-04 contrast pairings guarded in contrast.test.ts"
affects: [phase-2-auth-forms, phase-3-app-shell, future-kit-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Band-to-designated-target contrast assertion (not max-of-all-combinations) — required to actually discriminate a swap defect where both band values individually pass some combination by coincidence"

key-files:
  created:
    - apps/web/tests/focus-ring.test.ts
  modified:
    - apps/web/app/globals.css
    - apps/web/tests/contrast.test.ts

key-decisions:
  - "Test asserts outline-vs-bg paired with box-shadow-vs-primary (each band's own designated job), not the max of all four band/background combinations — the naive max-of-all approach does not discriminate the swap bug because the swapped colors still pass by symmetry against the wrong target"
  - "Verification required temporarily copying uncommitted workspace scaffold (package.json, packages/, node_modules, apps/web/lib, etc.) from the main repo into the worktree to run pnpm/vitest/next build/tsc/eslint — none of that scaffold was committed by this plan; it is pre-existing untracked state in the main repo, out of this plan's scope, and was removed from the worktree before finishing"

requirements-completed: [KIT-05]

# Metrics
duration: 15min
completed: 2026-07-02
---

# Phase 1 Plan 04: Focus-ring gap closure Summary

**Corrected the inverted two-tone `:focus-visible` ring band swap (max contrast 1.06:1 to ~18–19:1) and added a colorjs.io regression tripwire plus 5 WR-04 contrast pairings, closing the single blocking Phase 1 verification gap.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-02T12:00:00Z (approx, worktree spawn)
- **Completed:** 2026-07-02T12:13:39Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Fixed the swapped `:focus-visible` outline/box-shadow `light-dark()` pairs in `globals.css` so the outer band contrasts the page canvas and the inner band contrasts the inverted primary fill, restoring keyboard-focus visibility on the primary button (D-05, KIT-05) — max band contrast rose from ~1.06:1 to ~18.57–19.67:1 in both light and dark themes.
- Added `apps/web/tests/focus-ring.test.ts`, a node-environment Vitest suite that parses the live `:focus-visible` rule and token values out of `globals.css` (single source of truth, matching `contrast.test.ts`'s convention) and asserts each band meets its designated WCAG 2.1 non-text 3:1 gate — proven to fail against the pre-fix CSS (RED) and pass against the fixed CSS (GREEN).
- Closed WR-04 by adding the 5 previously-unasserted rendered token pairings (`muted/surface`, `body/surface-2`, `foreground/surface-2`, `notice/bg`, `error/bg`) to `contrast.test.ts`'s `textPairs`, all passing at their existing values with no token change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing focus-ring regression tripwire (RED)** - `ceee9b6` (test)
2. **Task 2: Swap the focus-ring pairs to GREEN + close WR-04 contrast coverage** - `c91c3b4` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified

- `apps/web/tests/focus-ring.test.ts` - New regression tripwire; parses `:focus-visible` outline/box-shadow `light-dark()` pairs and the `--color-bg`/`--color-primary`/`--color-surface` tokens from `globals.css`, asserts primary-button band contrast (outline vs bg, box-shadow vs primary — each band's designated job) and surface-backdrop band contrast, both `>= 3.0` in light and dark themes.
- `apps/web/app/globals.css` - Swapped the two `light-dark()` color pairs in the `:focus-visible` rule (lines 106-111): outline now `light-dark(oklch(0.15 0 0), oklch(1 0 0))`, box-shadow now `light-dark(oklch(1 0 0), oklch(0.15 0 0))`. No `--color-*` token value changed.
- `apps/web/tests/contrast.test.ts` - Extended `textPairs` with 5 WR-04 pairings: `["muted","surface"]`, `["body","surface-2"]`, `["foreground","surface-2"]`, `["notice","bg"]`, `["error","bg"]`.

## Decisions Made

- **Band-to-designated-target contrast, not max-of-all-combinations.** The plan's `<behavior>` spec calls for `max(outlineLight vs bgLight, shadowLight vs primaryLight)` — i.e., each band paired with its OWN intended target, then the max of those two specific pairings taken. An initial implementation instead computed `max(outline vs X, shadow vs X)` for a single target `X` at a time; this passed against the pre-fix CSS because the swapped band values still individually contrast well against *some* target by coincidence (the swap just assigns the right color to the wrong CSS property, and taking the max across both bands against one background hides that). Rewriting to pair each band with its designated target correctly reproduced the plan's documented RED failure (1.06:1 in both themes) before the fix, and GREEN after. This is the load-bearing detail that makes the tripwire a real regression guard rather than a tautology.
- **Verification scaffold not committed.** This worktree's git history does not include `package.json`, `pnpm-workspace.yaml`, `packages/`, `node_modules`, or several `apps/web` scaffold files (`lib/`, `tsconfig.json`, config `.mjs` files, `layout.tsx`, `page.tsx`) — they exist only as untracked files in the main repo working tree, outside this plan's `files_modified` scope. To run `pnpm test`/`build`/`typecheck`/`lint` for verification, these were temporarily copied from the main repo into the worktree, used strictly for local verification, and removed again before finishing (confirmed via `git status --short` showing a clean tree beyond the two task commits). No scaffold file was staged or committed. This gap (uncommitted workspace scaffold) is out of this plan's scope and is not fixed here.

## Deviations from Plan

None - plan executed exactly as written. The band-pairing implementation detail above was corrected during Task 1's own RED-verification loop (before any commit), consistent with the TDD execution flow — not a deviation from the plan's specified behavior, just faithful, careful implementation of the documented `max(outline vs bg, shadow vs primary)` formula rather than a broader (incorrect) generalization of it.

## Issues Encountered

- **Missing workspace scaffold in the worktree's git history.** The worktree (a clean checkout of this branch) is missing `package.json`, `pnpm-workspace.yaml`, `packages/`, and several `apps/web` files needed to run `pnpm install`/`test`/`build` — these are untracked in the main repository too (confirmed via `git status --short` in `/Users/franz/Work/Personal/fish`), meaning they were never committed to any branch. This blocked running the plan's `<verify>` and `<verification>` commands directly in the worktree. Resolved by temporarily rsync-copying the untracked scaffold from the main repo's working tree into this worktree (verification-only, never staged/committed, removed afterward) so `pnpm test`, `pnpm build`, `pnpm typecheck`, and `pnpm lint` could actually run and confirm the acceptance criteria. This is a pre-existing gap in the project's commit history, out of scope for this plan, and worth flagging for whoever next runs `git add` on the workspace root — the entire monorepo scaffold currently lives outside version control.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1's single blocking verification gap (invisible keyboard focus ring on the primary button, D-05/KIT-05) is closed and permanently guarded by an automated tripwire.
- WR-04 (5 unguarded rendered contrast pairings) is closed.
- All 71 tests pass (57 prior + 4 focus-ring + 10 new WR-04 assertions across 2 themes); `pnpm build`, `typecheck`, and `lint` are clean; `/kit` still renders as a static route.
- **Flag for the orchestrator / next session:** the monorepo's root `package.json`, `pnpm-workspace.yaml`, `packages/`, and several `apps/web` scaffold files are untracked in the main repository (`git status --short` in `/Users/franz/Work/Personal/fish` shows them as `??`). This is unrelated to this plan's scope but should be committed deliberately soon — any future worktree spawned from `main` will hit the same missing-scaffold blocker this plan worked around.

---
*Phase: 01-monochrome-design-system-you-can-see*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: apps/web/tests/focus-ring.test.ts
- FOUND: .planning/phases/01-monochrome-design-system-you-can-see/01-04-SUMMARY.md
- FOUND: `:focus-visible` rule present in apps/web/app/globals.css
- FOUND: commit ceee9b6 (test: RED tripwire)
- FOUND: commit c91c3b4 (feat: GREEN fix + WR-04 coverage)
- FOUND: commit 88cb728 (docs: SUMMARY)
