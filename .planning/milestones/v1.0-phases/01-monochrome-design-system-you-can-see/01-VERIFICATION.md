---
phase: 01-monochrome-design-system-you-can-see
verified: 2026-07-02T20:35:00Z
status: passed
score: 11/11 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "The keyboard focus ring is visible on the inverted primary button in both light and dark (D-05, KIT-05)"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification: []
---

# Phase 1: Monochrome Design System You Can See — Verification Report

**Phase Goal:** A person can open the UI kit demo page and see every base component, in every state, rendered in pure monochrome, correct in both light and dark, following their system preference with no flash of the wrong theme.
**Verified:** 2026-07-02T20:35:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 01-04)

## Goal Achievement

This is a re-verification. The prior round (2026-07-02T09:46:16Z) found 10/11 must-haves verified with one blocking gap: the two-tone `:focus-visible` ring in `apps/web/app/globals.css` had its inner/outer `light-dark()` color pairs swapped, making the keyboard focus ring effectively invisible (~1.0-1.06:1 contrast) on the primary Button — the single highest-priority control per screen — in both themes. Plan 01-04 closed this gap. All other truths passed the prior round and were regression-checked here rather than re-verified from scratch (per re-verification mode).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A person can open `/kit` and see it render in pure monochrome (black/white/grey only) | VERIFIED (regression-checked) | `pnpm build` still lists `/kit` as a static route; `grep -Ec "old-hue-token-a\|old-hue-token-b\|text-red\|bg-red\|border-red\|text-green\|text-blue"` across globals.css, kit/page.tsx, and all `components/ui/*.tsx` returns 0 in every file |
| 2 | Toggling the `/kit` dev control between system/light/dark switches the whole page cleanly and every token resolves in both themes | VERIFIED (regression-checked) | `html[data-kit-theme="light"/"dark"]` rules unchanged in globals.css; compiled production CSS chunk confirmed to still carry `--lightningcss-light`/`--lightningcss-dark` polyfill-variable pairs for every token, including the corrected focus-ring bands |
| 3 | On first paint the page follows the OS theme with no flash of the wrong theme (zero JS for the default) | VERIFIED (regression-checked) | `html { color-scheme: light dark; }` unchanged in `@layer base`; no JS in the default path |
| 4 | The Button renders default, hover, focus, disabled, and loading states in both themes, primary is a full-contrast inverted block | VERIFIED (regression-checked) | `button.tsx` unchanged by 01-04; `button.test.tsx` still passing as part of the 71-test suite |
| 5 | **The keyboard focus ring is visible on the inverted primary button in both light and dark** | **VERIFIED (gap closed)** | See "Gap Closure Verification" below — independently reproduced from three sources: source CSS, compiled production CSS bytes, and a live-executed regression test proven to fail against the old defective state |
| 6 | `pnpm test` runs and the WCAG AA contrast assertion passes for every token pair actually rendered on `/kit` in both themes | VERIFIED (upgraded from PARTIAL) | `pnpm --filter @fish/web test -- --run` exits 0, 71/71 passing (up from 57). The 5 previously-unasserted rendered pairings (WR-04: muted/surface, body/surface-2, foreground/surface-2, notice/bg, error/bg) are now in `contrast.test.ts`'s `textPairs` and pass — confirmed via `grep` of the file plus live test run |
| 7 | The Input renders default, hover, focus, disabled, notice-tier, and error-tier states in both themes | VERIFIED (regression-checked) | `input.tsx` unchanged by 01-04; `input.test.tsx` still passing |
| 8 | Notice and error tiers are distinguishable in monochrome by border weight, message weight, and Tabler icon — never by hue | VERIFIED (regression-checked) | `input.tsx` unchanged; 0 hue-class matches confirmed above |
| 9 | The Card renders default and elevated states — soft shadow in light, surface-step in dark — with no `dark:` variant branching | VERIFIED (regression-checked) | `card.tsx` unchanged by 01-04 |
| 10 | The Progress bar renders a value-driven monochrome fill with no numeric grade shown | VERIFIED (regression-checked) | `card.tsx` (Progress) unchanged |
| 11 | Alert renders notice, error, success tiers distinguished by icon shape, border weight, message weight — never hue | VERIFIED (regression-checked) | `alert.tsx` unchanged by 01-04 |
| 12 | Every icon on `/kit` comes from Tabler and no competing icon set is imported anywhere in `apps/web` | VERIFIED (regression-checked) | `icon-source.test.ts` unchanged, still passing; manual re-scan confirms 0 offenders |
| 13 | Body/UI text renders in Lexend and headings in Fraunces on `/kit` | VERIFIED (regression-checked) | Font tokens unchanged in globals.css |
| 14 | `/kit` ships in production builds, unlinked from any client-facing screen, with no env gating | VERIFIED (regression-checked) | `pnpm build` succeeds, `/kit` listed `○ (Static)` |

**Score:** 11/11 must-have truths verified (14 detailed truths collapse to 11 distinct must-haves across the four plans' frontmatter + roadmap contract). The one prior failure is now closed.

### Gap Closure Verification (Truth #5 — Focus Ring)

The prior verifier's finding is falsifiable, and I falsified it directly rather than trusting the SUMMARY narrative. Four independent checks, all agreeing:

1. **Source diff is exactly the claimed fix.** `git show c91c3b4 -- apps/web/app/globals.css` shows only the two `:focus-visible` band colors swapped — `outline` now `light-dark(oklch(0.15 0 0), oklch(1 0 0))`, `box-shadow` now `light-dark(oklch(1 0 0), oklch(0.15 0 0))`. No `--color-*` token value changed. This is committed on `main` (commit `c91c3b4`), not just claimed in a SUMMARY.

2. **Independent WCAG21 contrast computation from the raw token values** (computed live in this verification, not reusing the plan's own test):
   - Light theme: outline vs `--color-bg` = **18.57:1**; box-shadow vs `--color-primary` = **19.67:1**
   - Dark theme: outline vs `--color-bg` = **19.67:1**; box-shadow vs `--color-primary` = **18.57:1**
   - Both far exceed the 3:1 WCAG 2.1 non-text contrast floor, and both are the mirror-opposite of the prior verifier's measured ~1.0-1.06:1 failure.

3. **Compiled production CSS bytes inspected directly** (`.next/static/chunks/*.css` after a fresh `pnpm build`): the shipped `:focus-visible` rule resolves to `outline:...var(--lightningcss-light,#0b0b0b)var(--lightningcss-dark,#fff)` and `box-shadow:...var(--lightningcss-light,#fff)var(--lightningcss-dark,#0b0b0b)` — dark outline / white box-shadow in light theme (mirrored in dark theme), exactly the corrected pairing. This is the same class of evidence (actual shipped bytes, not source intent) the prior verifier used to catch the original defect, applied again here to confirm the fix reached production.

4. **The regression tripwire (`apps/web/tests/focus-ring.test.ts`) was proven to be a real guard, not a tautology.** I temporarily reverted `globals.css` to the exact pre-fix swapped state and re-ran the test in isolation: it failed with `expected 1.0593305837819513 to be greater than or equal to 3` on both the light-theme and dark-theme primary-button assertions — reproducing the original defect's measured contrast almost exactly. I then restored the fixed file (confirmed zero `git diff` afterward) and re-ran the full suite: 71/71 pass. This proves the tripwire discriminates the defect rather than always passing.

**Conclusion: the gap is genuinely closed**, verified independently of the SUMMARY's claims, using source diff, live math, compiled production bytes, and an executed pass/fail test cycle.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/globals.css` | Corrected two-tone `:focus-visible` ring | ✓ VERIFIED | Committed diff matches plan exactly; confirmed in source, compiled CSS, and live contrast math |
| `apps/web/tests/focus-ring.test.ts` | Regression tripwire, min 40 lines | ✓ VERIFIED | 137 lines; reads `globals.css` live (0 hard-coded `oklch(` literals — matches single-source-of-truth convention); proven to fail on defective CSS and pass on fixed CSS |
| `apps/web/tests/contrast.test.ts` | Extended `textPairs` with 5 WR-04 pairings | ✓ VERIFIED | `muted/surface`, `body/surface-2`, `foreground/surface-2`, `notice/bg`, `error/bg` all present at lines 112-116 and passing |
| `apps/web/vitest.config.ts` | jsdom + React plugin test runner | ✓ VERIFIED (unchanged) | Regression-checked, still present |
| `apps/web/app/kit/page.tsx` | Complete single-scroll demo, 8 sections | ✓ VERIFIED (unchanged) | Tokens/Typography/Icons/Button/Input/Card/Progress/Alert all present in order |
| `apps/web/components/ui/button.tsx` | Hardened with loading + disabled | ✓ VERIFIED (unchanged) | Regression-checked |
| `apps/web/components/ui/input.tsx` | Two-tier notice/error + disabled + icons | ✓ VERIFIED (unchanged) | Regression-checked |
| `apps/web/components/ui/card.tsx` | Card elevation token + Progress | ✓ VERIFIED (unchanged) | Regression-checked |
| `apps/web/components/ui/alert.tsx` | Block Alert, 3 tones | ✓ VERIFIED (unchanged) | Regression-checked |
| `apps/web/tests/icon-source.test.ts` | Guard: Tabler is the only icon set | ✓ VERIFIED (unchanged) | Still passing; WR-03 weakness noted below is a pre-existing, deliberately deferred warning, not a new gap |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `focus-ring.test.ts` | `globals.css` | `readFileSync` + regex parse of `:focus-visible` and `--color-bg`/`--color-primary`/`--color-surface` | WIRED | Confirmed by reading the test file; the parse regexes correctly extract the live rule (proved by making the test fail on reverted CSS and pass on fixed CSS) |
| `focus-ring.test.ts` | `colorjs.io` | `new Color(...).contrast(other, "WCAG21")` | WIRED | Confirmed imported and used; same library/method as `contrast.test.ts` |
| `contrast.test.ts` | `globals.css` | `textPairs` array extended, `describe.each` asserts each pair | WIRED | Confirmed the 5 new pairs are present and the existing `describe.each` block picks them up automatically (all 71 tests pass, including the new pairings) |
| `button.tsx` | `globals.css` | `bg-primary`/`text-on-primary` semantic tokens | WIRED (unchanged) | Confirmed in source and rendered build |
| `theme-toggle.tsx` | `document.documentElement` | `data-kit-theme` attribute mutation | WIRED (unchanged) | Confirmed in production CSS |

### Data-Flow Trace (Level 4)

Not applicable in the traditional data-fetching sense (static design-system demo, no backend). The equivalent check — "does the rendered ring color genuinely differ from what it sits against in the actual shipped bytes" — was performed directly against the compiled `.next/static/chunks/*.css` output (see Gap Closure Verification, point 3) rather than trusting source intent or test output alone.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `pnpm --filter @fish/web test -- --run` | 71/71 passed, 8 files | ✓ PASS |
| Production build succeeds, `/kit` is a static route | `pnpm --filter @fish/web build` | Compiled successfully; `/kit` listed as `○ (Static)` | ✓ PASS |
| Typecheck clean | `pnpm --filter @fish/web typecheck` | Exit 0 | ✓ PASS |
| Lint clean | `pnpm --filter @fish/web lint` | Exit 0 | ✓ PASS |
| No native `light-dark()` ships (polyfill confirmation) | `grep -o "light-dark(" .next/static/chunks/*.css \| wc -l` | 0 occurrences | ✓ PASS |
| Focus-ring tripwire fails against deliberately-reverted defective CSS | `npx vitest run tests/focus-ring.test.ts` after reverting the two band colors | 2/4 tests failed, contrast measured 1.059:1 — matches the original defect almost exactly | ✓ PASS (proves the guard is real) |
| Focus-ring tripwire passes against the actual committed fix | `npx vitest run` after restoring the committed file | 71/71 passed | ✓ PASS |
| Focus ring contrast on primary button, light theme, independently computed | Live Node script using colorjs.io against raw token values | outline vs bg 18.57:1, box-shadow vs primary 19.67:1 | ✓ PASS |
| Focus ring contrast on primary button, dark theme, independently computed | Live Node script | outline vs bg 19.67:1, box-shadow vs primary 18.57:1 | ✓ PASS |
| Compiled production CSS carries the corrected band colors | `grep -o "focus-visible[^}]*}" .next/static/chunks/*.css` | `outline:...#0b0b0b...#fff`, `box-shadow:...#fff...#0b0b0b` (light/dark) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TOKN-01 | 01-01 | Pure monochrome, no hue | ✓ SATISFIED | chroma-0 test passes; 0 hue-class matches |
| TOKN-02 | 01-01 | Role-based semantic token names | ✓ SATISFIED | `--color-bg/surface/foreground/notice/...` |
| TOKN-03 | 01-01 | Both themes fully specified, every token resolves | ✓ SATISFIED | Every `--color-*` is `light-dark(...)` |
| TOKN-04 | 01-01, 01-03 | System-preference theme, no flash | ✓ SATISFIED | `color-scheme: light dark` zero-JS default |
| TOKN-05 | 01-01, 01-03 | Lexend body / Fraunces headings | ✓ SATISFIED | Confirmed in globals.css and `/kit` |
| TOKN-06 | 01-01, 01-03 | Tabler only icon source | ✓ SATISFIED | icon-source.test.ts passes; no violation exists |
| KIT-01 | 01-01, 01-02 | Button/Input/Card/Progress states, both themes | ✓ SATISFIED | All components render required states; tests pass |
| KIT-02 | 01-02, 01-03 | Notices/errors distinguishable without red, calm copy | ✓ SATISFIED | Structural distinction confirmed |
| KIT-03 | 01-03 (phase-level) | New base components needs-driven, no speculative components | ✓ SATISFIED | Alert built for Phase 2 auth screens; documented justification |
| KIT-04 | 01-01 | 56px minimum control height | ✓ SATISFIED | `min-h-[var(--size-control)]` on Button and Input |
| KIT-05 | 01-01, 01-03, **01-04** | Visible keyboard focus + reduced-motion respected | **✓ SATISFIED (gap closed by 01-04)** | Reduced-motion: unchanged, still SATISFIED. Visible keyboard focus: now VERIFIED — 18.57-19.67:1 contrast on the primary button in both themes, confirmed via source, compiled bytes, and live test execution |
| KIT-06 | 01-01, 01-02, 01-03 | UI kit demo page shows every component in every state, both themes | ✓ SATISFIED | All 8 sections present in D-13 order; the one previously-failing state (primary-button focus) now passes |

**ORPHANED requirements check:** REQUIREMENTS.md maps 12 requirement IDs to Phase 1 (TOKN-01..06, KIT-01..06) — the exact set given in this verification's task scope. All 12 appear across the four plans' `requirements:` frontmatter fields and REQUIREMENTS.md marks all 12 `[x]` Complete. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/components/ui/button.tsx` | 42-56 | `loading` state blocks pointer events but not keyboard activation (unchanged from prior round) | ⚠️ Warning | Double-submit risk once Phase 2 wires a real submit handler; explicitly deferred in 01-04's `<deferred_items>` (WR-01) to Phase 2, the first real consumer |
| `apps/web/app/globals.css` | 63 | `--shadow-card` uses non-color `light-dark()` args, works only under current Lightning CSS polyfill (unchanged) | ⚠️ Warning | No present-day defect; explicitly deferred (WR-02) |
| `apps/web/tests/icon-source.test.ts` | 33 | Guard regex misses subpath/dynamic imports (unchanged) | ⚠️ Warning | No current violation; explicitly deferred (WR-03) |
| `apps/web/components/ui/input.tsx` | 28-58 | No `aria-describedby`/`aria-invalid` on error tier (unchanged) | ⚠️ Warning | Explicitly deferred (WR-06) to Phase 2's first dynamic Input consumer |
| `apps/web/components/ui/alert.tsx` | 40-62 | No `role="status"` live-region (unchanged) | ⚠️ Warning | Explicitly deferred (WR-07) to Phase 2's first dynamic Alert consumer |
| `apps/web/package.json` | 23, 33 | `tailwindcss`/`@tailwindcss/postcss` on independent caret ranges (unchanged) | ⚠️ Warning | Explicitly deferred (WR-08); AGENTS.md same-version risk remains live but is a dependency-management task, not a phase-goal blocker |
| Repository root | — | `package.json`, `pnpm-workspace.yaml`, `packages/`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/tsconfig.json`, and other scaffold files are untracked (`??`) in `git status`, despite the app building and running from them | ⚠️ Warning (infrastructure, not phase-goal) | Confirmed independently: `git ls-tree -r main --name-only` returns no match for `package.json`/`pnpm-workspace.yaml`/`apps/web/app/layout.tsx`/`apps/web/tsconfig.json`. This means a fresh clone of `main` cannot currently build or run tests — the working tree has untracked scaffold files that make local verification possible, but they are not committed. This does not block Phase 1's own goal (the demo page and design system function correctly in the current working tree, verified live in this report) but is a real repo-integrity issue flagged by the 01-04 SUMMARY itself and confirmed here. Recommend committing the scaffold before proceeding to Phase 2 so a clean checkout is buildable. |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in any file touched by 01-04 (`globals.css`, `focus-ring.test.ts`, `contrast.test.ts`).

### Human Verification Required

None. The gap that previously required no further human judgment (per the prior verification's own assessment — "independently, empirically reproducible... the fix is unambiguous") has now been fixed, and the fix was independently re-verified here using four separate methods (source diff, live contrast math, compiled production bytes, and a live-executed fail/pass test cycle), none of which relied on trusting the SUMMARY's narrative.

### Gaps Summary

Phase 1's single blocking gap from the prior verification round — the inverted two-tone `:focus-visible` ring making the keyboard focus indicator invisible (~1.0-1.06:1 contrast) on the primary Button in both themes — is closed. The fix (commit `c91c3b4`) swaps exactly the two band colors the prior report specified, changes no token value, and is now guarded by a regression tripwire (`apps/web/tests/focus-ring.test.ts`) that this verification proved discriminates the defect: reverting the fix locally reproduces a 1.059:1 failure nearly identical to the original measurement, and restoring the fix returns the suite to 71/71 green.

All 12 requirement IDs for Phase 1 (TOKN-01..06, KIT-01..06) are satisfied. All 11 distinct must-have truths across the phase's four plans are verified. Build, typecheck, and lint are clean; the production CSS bundle was inspected directly and confirms the corrected ring ships to real bytes, not just source intent.

One pre-existing, non-blocking infrastructure finding carries forward and is independently confirmed here: the repository's core scaffold (`package.json`, `pnpm-workspace.yaml`, `packages/`, several `apps/web` files) is untracked in git despite being present and functional in the working tree. This was flagged by 01-04's own SUMMARY and is not a Phase 1 goal blocker (everything was verified to work in the current working tree), but should be committed before further phases build on top of it, since a fresh `git clone` of `main` today would not build.

All other secondary findings (Button loading/keyboard-activation, `--shadow-card` polyfill dependency, icon-guard regex gaps, Input/Alert ARIA gaps, dependency version pinning) are unchanged from the prior round, explicitly and reasonably deferred to Phase 2 in 01-04's `<deferred_items>` section, and remain non-blocking warnings.

---

_Verified: 2026-07-02T20:35:00Z_
_Verifier: Claude (gsd-verifier)_
