---
phase: 01-monochrome-design-system-you-can-see
plan: 01
subsystem: ui
tags: [tailwind-v4, light-dark, oklch, vitest, testing-library, colorjs.io, tabler-icons, wcag]

# Dependency graph
requires: []
provides:
  - Monochrome light-dark() token ladder in globals.css @theme (14 semantic roles, chroma 0, both themes)
  - color-scheme: light dark on html — zero-JS system-follow theme resolution (TOKN-04)
  - First test infrastructure: Vitest + jsdom + RTL + jest-dom, @/ alias, `pnpm test`
  - WCAG AA contrast test parsing globals.css at test time (single source of truth)
  - Hardened Button with loading state (aria-busy + spinner + pointer-events blocked)
  - Two-tone :focus-visible ring visible on inverted primary fill in both themes (D-05)
  - KitThemeToggle dev client island (system/light/dark via color-scheme override)
  - /kit demo route (Server Component) with Button section
affects: [01-02, 01-03, auth-ui, app-shell]

# Tech tracking
tech-stack:
  added:
    - "@tabler/icons-react 3.44.0 (deps)"
    - "colorjs.io 0.6.1 (deps)"
    - "vitest 4.1.9, @testing-library/react 16.3.2, @testing-library/jest-dom 6.9.1, jsdom 29.1.1, @vitejs/plugin-react 6.0.3 (devDeps)"
  patterns:
    - "Every color token is light-dark(oklch, oklch) inside @theme — no @custom-variant dark, no dark: utilities"
    - "Contrast test parses globals.css tokens at test time — token edits are auto-re-verified (Pitfall 3)"
    - "TDD RED/GREEN per feature; tests co-located (button.test.tsx) or in tests/ for token-level checks"
    - "Theme override = color-scheme style mutation on html via useEffect in a client island"

key-files:
  created:
    - apps/web/vitest.config.ts
    - apps/web/vitest.setup.ts
    - apps/web/tests/contrast.test.ts
    - apps/web/components/ui/button.test.tsx
    - apps/web/components/kit/theme-toggle.tsx
    - apps/web/app/kit/page.tsx
  modified:
    - apps/web/app/globals.css
    - apps/web/components/ui/button.tsx
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Border tokens tuned darker/lighter than plan proposal (light 0.85→0.64, dark 0.34→0.55; border-strong light 0.75→0.55, dark 0.44→0.65) — plan values failed the 3:1 UI-component gate (1.5–2.3 measured); contrast test is the acceptance gate per plan"
  - "Kept the token name --color-primary-press (semantic, not hue-named) so Button's hover/active classes carry forward unchanged"
  - "contrast.test.ts parses globals.css at test time (option a from plan) — no second copy of token values exists anywhere"
  - "contrast.test.ts pinned to node environment; jsdom rewrites import.meta.url scheme and the test needs no DOM"
  - "KitThemeToggle applies color-scheme in useEffect synced to state (not in the click handler) to satisfy react-hooks/immutability lint"

patterns-established:
  - "light-dark() in @theme: dual-theme values live in the token, components never branch on theme"
  - "WCAG gate: text pairs >= 4.5, UI pairs >= 3.0, chroma must be 0 — enforced by pnpm test"
  - "Client islands stay leaf-level; route pages remain Server Components"

requirements-completed: [TOKN-01, TOKN-02, TOKN-03, TOKN-04, TOKN-05, TOKN-06, KIT-01, KIT-04, KIT-05, KIT-06]

# Metrics
duration: 12min
completed: 2026-07-02
---

# Phase 01 Plan 01: Monochrome Design System Vertical Slice Summary

**Monochrome light-dark() oklch token ladder with WCAG AA contrast tests (Vitest + colorjs.io), hardened Button with loading state and two-tone focus ring, rendered on a new /kit route with a dev theme toggle**

## Performance

- **Duration:** 12 min (continuation segment; excludes pre-checkpoint package verification)
- **Started:** 2026-07-02T08:19:03Z
- **Completed:** 2026-07-02T08:31:03Z
- **Tasks:** 3 (1 checkpoint + 2 TDD)
- **Files modified:** 10

## Accomplishments

- Replaced the aquatic-blue palette wholesale with a 14-role pure-monochrome `light-dark()` ladder (chroma 0 everywhere, no hue tokens, no numbered ramp, no `@custom-variant dark`)
- Stood up the project's first test infrastructure (Vitest 4 + jsdom + RTL + jest-dom) with a WCAG AA contrast suite that parses `globals.css` at test time — 27 assertions across both themes
- Hardened Button in place with a `loading` state (aria-busy, spinner, pointer-events blocked) and replaced the focus ring with the two-tone D-05 ring visible on the inverted primary fill in both themes
- Shipped the `/kit` route: Server Component page with Button variants/disabled/loading and a `KitThemeToggle` client island that re-resolves every token via `color-scheme` override

## Task Commits

Each task was committed atomically (TDD tasks have RED + GREEN commits):

1. **Task 1: Verify + install new dependencies (package legitimacy gate)** - `4d066bd` (chore) — human approved all 7 packages at checkpoint before install
2. **Task 2: Vitest + WCAG AA contrast test** - `04877ac` (test, RED: 26 failures vs aquatic palette) → `7de5b89` (feat, GREEN: 27/27)
3. **Task 3: Harden Button + theme toggle + /kit slice** - `8831221` (test, RED: loading behavior fails) → `c00ae2d` (feat, GREEN: 34/34 + build + lint + typecheck clean)

## Files Created/Modified

- `apps/web/app/globals.css` - Monochrome `light-dark()` @theme ladder, `color-scheme: light dark` on html, two-tone `:focus-visible` ring
- `apps/web/tests/contrast.test.ts` - Parses globals.css tokens; asserts AA 4.5:1 text / 3.0:1 UI pairs + chroma-0 in both themes
- `apps/web/vitest.config.ts` - First test runner config (jsdom, react plugin, @/ alias, globals)
- `apps/web/vitest.setup.ts` - jest-dom matchers for Vitest
- `apps/web/components/ui/button.tsx` - Hardened in place: `loading` prop, aria-busy, spinner (global reduced-motion applies)
- `apps/web/components/ui/button.test.tsx` - RTL specs: variants, 56px floor, disabled, loading busy semantics
- `apps/web/components/kit/theme-toggle.tsx` - `"use client"` dev toggle; useEffect syncs `document.documentElement.style.colorScheme`
- `apps/web/app/kit/page.tsx` - /kit Server Component route; toggle + Button section
- `apps/web/package.json` - 7 new packages + `"test": "vitest"` script
- `pnpm-lock.yaml` - Lockfile for the 7 verified packages

## Decisions Made

- **Border tokens tuned for the 3:1 gate:** plan-proposed border values (light 0.85 / dark 0.34; strong 0.75 / 0.44) measured 1.5–2.3:1 against surface — below the WCAG non-text threshold. Tuned to `border: light-dark(oklch(0.64 0 0), oklch(0.55 0 0))` and `border-strong: light-dark(oklch(0.55 0 0), oklch(0.65 0 0))` (3.36/3.73 and 4.85/5.60). The plan explicitly designated the contrast test as the acceptance gate and its values as starting points.
- **`--color-primary-press` name kept** — it is semantic-role-named (not hue-named), so Button's `hover:bg-primary-press`/`active:bg-primary-press` classes carry forward unchanged.
- **Single source of truth for token values:** the contrast test reads `globals.css` directly (plan's option a), so no divergent copy can drift (Pitfall 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] contrast.test.ts pinned to node environment**
- **Found during:** Task 2 (RED run)
- **Issue:** Under the jsdom environment, `import.meta.url` is not a `file:` URL, so reading globals.css threw `TypeError: The URL must be of scheme file`
- **Fix:** Added `// @vitest-environment node` — the test is pure Node (no DOM needed)
- **Files modified:** apps/web/tests/contrast.test.ts
- **Verification:** RED run then produced the intended 26 contrast/token failures
- **Committed in:** 04877ac (Task 2 RED commit)

**2. [Rule 3 - Blocking] Added @/ path alias + globals to vitest.config.ts**
- **Found during:** Task 3 (RED run setup)
- **Issue:** button.test.tsx imports Button, which imports `@/lib/utils` — Vitest does not read tsconfig paths, so the import could not resolve; RTL auto-cleanup also needs global `afterEach`
- **Fix:** `resolve.alias { "@": <apps/web root> }` and `test.globals: true` in vitest.config.ts (file belongs to this plan's files_modified, though not listed under Task 3)
- **Files modified:** apps/web/vitest.config.ts
- **Verification:** Suite resolves and runs; 34/34 after GREEN
- **Committed in:** 8831221 (Task 3 RED commit)

**3. [Rule 1 - Bug] react-hooks/immutability lint error in KitThemeToggle**
- **Found during:** Task 3 (lint gate)
- **Issue:** Direct `document.documentElement.style.colorScheme = ...` inside the component's click-path function violated the `react-hooks/immutability` rule (eslint-config-next), failing `pnpm lint`
- **Fix:** Moved the mutation into `useEffect` synchronized with `mode` state — same observable behavior, canonical external-system sync, no suppression comment
- **Files modified:** apps/web/components/kit/theme-toggle.tsx
- **Verification:** lint exits 0; toggle acceptance greps still pass
- **Committed in:** c00ae2d (Task 3 GREEN commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All fixes were required to make the planned test infrastructure and lint gates function. No scope creep; no architectural change.

## Authentication Gates

None.

## Issues Encountered

- Plan-proposed border token values failed the 3:1 UI-component contrast gate (measured 1.5–2.3:1) — resolved by tuning lightness values, exactly the iteration loop the plan prescribed ("adjust values until it passes").
- `pnpm peers check` reports `vite@8.1.2` wants `@types/node >=22.12.0` (installed 22.10.7). Warning only — typecheck, tests, and build all pass. Left untouched to avoid unplanned dependency drift; worth bumping alongside the next dependency task.

## Known Stubs

None in files created/modified by this plan. (Pre-existing: `apps/web/app/page.tsx` still references removed `old-hue-token-a`/`old-hue-token-b` utilities — logged in `deferred-items.md`, out of this plan's scope; `/kit` supersedes that page as the contract.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Theme mechanism, token ladder, test harness, and one end-to-end component slice are in place — Plan 01-02 (Input/Card/Progress/Alert hardening) can consume the ladder and test infra directly
- Manual no-flash/hydration check on /kit (TOKN-04) deferred to the Plan 03 phase checkpoint per plan
- Ready for 01-02-PLAN.md

## Self-Check: PASSED

- All 6 created files exist on disk; all 4 modified files contain their required markers (`light-dark(`, `loading`, `"test": "vitest"`)
- All 5 task commits found in git log (4d066bd, 04877ac, 7de5b89, 8831221, c00ae2d)
- Full suite re-run: 34/34 green; `pnpm --filter @fish/web build` + `typecheck` + `lint` exit 0
- TDD gates: test-before-feat commit order verified for both TDD tasks

---
*Phase: 01-monochrome-design-system-you-can-see*
*Completed: 2026-07-02*
