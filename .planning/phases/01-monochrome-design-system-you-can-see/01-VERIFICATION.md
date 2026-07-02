---
phase: 01-monochrome-design-system-you-can-see
verified: 2026-07-02T09:46:16Z
status: gaps_found
score: 10/11 must-haves verified
has_blocking_gaps: true
overrides_applied: 0
gaps:
  - truth: "The keyboard focus ring is visible on the inverted primary button in both light and dark (D-05, KIT-05)"
    status: failed
    severity: blocking
    reason: >
      The two-tone :focus-visible rule in globals.css has its inner/outer colors inverted.
      Empirically reproduced from the actual production build output (.next static chunk):
      light theme outline (outer band) resolves to #fff against a #f8f8f8-ish near-white page
      (measured 1.06:1 contrast — invisible) and box-shadow (inner band) resolves to #0b0b0b
      against the black primary button fill (measured 1.00:1 — invisible). Dark theme is the
      exact mirror failure (1.00:1 and 1.06:1). Both bands fail against what they sit next to
      when focus lands on the primary button — the one control this rule's own code comment
      says it protects ("stays visible against the inverted primary fill in BOTH themes").
      The ring is correctly visible on secondary/ghost buttons and inputs (verified: 19.67:1 on
      white surface) — the failure is scoped exactly to the primary variant, which is also the
      single most important control per screen per AGENTS.md's one-primary-action rule. No
      automated test exists for this rule (confirmed: zero focus-ring assertions across the
      57-test suite), so nothing caught it. The phase-gate human checkpoint approved this exact
      code across all three of its passes; the computed evidence from the shipped CSS
      contradicts that visual impression and is the more reliable signal for a ~1:1 contrast
      case that is easy to miss in a fast Tab-through.
    artifacts:
      - path: "apps/web/app/globals.css"
        issue: "Lines 106-111: outline uses light-dark(oklch(1 0 0), oklch(0.15 0 0)) and box-shadow uses light-dark(oklch(0.15 0 0), oklch(1 0 0)) — swapped relative to what's needed for the primary button's inverted fill"
    missing:
      - "Swap the two light-dark() pairs so outline (outer, contrasts the page) uses light-dark(oklch(0.15 0 0), oklch(1 0 0)) and box-shadow (inner, contrasts the inverted primary fill) uses light-dark(oklch(1 0 0), oklch(0.15 0 0))"
      - "Add a regression test asserting the correct band-to-background pairing (e.g. parse the rule and assert computed contrast ≥ 3:1 against both --color-bg and --color-primary in both themes), the same class of tripwire theme-toggle.test.tsx already applies to the data-kit-theme rules"
deferred: []
human_verification: []
---

# Phase 1: Monochrome Design System You Can See — Verification Report

**Phase Goal:** A person can open the UI kit demo page and see every base component, in every state, rendered in pure monochrome, correct in both light and dark, following their system preference with no flash of the wrong theme.
**Verified:** 2026-07-02T09:46:16Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A person can open `/kit` and see it render in pure monochrome (black/white/grey only) | VERIFIED | `/kit` builds as a static route; every `--color-*` token in globals.css is `light-dark(oklch(... 0 0), oklch(... 0 0))` — chroma 0 asserted by `contrast.test.ts` ("keeps every token pure monochrome" test, passing); grep for `accent-pink\|accent-yellow` in kit/page.tsx and globals.css returns 0 |
| 2 | Toggling the `/kit` dev control between system/light/dark switches the whole page cleanly and every token resolves in both themes | VERIFIED | `KitThemeToggle` flips `data-kit-theme` attribute; globals.css carries `html[data-kit-theme="light"/"dark"]` stylesheet rules (not inline style) specifically because Lightning CSS only compiles stylesheet-visible `color-scheme` declarations into its polyfill-variable flips — confirmed present in the actual production CSS chunk (`--lightningcss-light`/`--lightningcss-dark` variable pairs). `theme-toggle.test.tsx` regression-tests the attribute set/remove and the presence of the globals.css hooks. This was a checkpoint-reported bug (cycle 1) that was root-caused and fixed, then human-reapproved |
| 3 | On first paint the page follows the OS theme with no flash of the wrong theme (zero JS for the default) | VERIFIED | `html { color-scheme: light dark; }` set in `@layer base` with zero JS involved in the default path (JS only runs for the dev override); human phase-gate checkpoint explicitly confirmed no flash in either OS theme and no hydration warning on the third approval pass |
| 4 | The Button renders default, hover, focus, disabled, and loading states in both themes, primary is a full-contrast inverted block | VERIFIED | `button.tsx` inverted primary (`bg-primary text-on-primary`), disabled (`disabled:opacity-50 disabled:pointer-events-none`), loading (`aria-busy`, spinner, `opacity-70 pointer-events-none`) all present and asserted by `button.test.tsx` (14 passing specs incl. layout-stability regressions); rendered on `/kit` in variants/disabled/loading sections |
| 5 | The keyboard focus ring is visible on the inverted primary button in both light and dark | **FAILED** | See gap below — empirically reproduced 1.00–1.06:1 contrast (invisible) on the primary button in both themes from the actual shipped CSS |
| 6 | `pnpm test` runs and the WCAG AA contrast assertion passes for every token pair in both themes | PARTIAL (counted as verified for the must-have as literally testable, gap noted separately) | `pnpm --filter @fish/web test -- --run` exits 0, 57/57 green, including 27 contrast/chroma assertions across both themes. However the claim "every token pair" is broader than what's covered — 5 pairings actually rendered on `/kit` are absent from the test's `textPairs`/`uiPairs` (see Anti-Patterns, WR-04) — all currently pass by manual computation but are unguarded against regression. Not classified as a blocking gap because current values do pass and the truth as literally stated ("the WCAG AA contrast assertion passes for every token pair" that IS asserted) is true; flagged as a warning for follow-up |
| 7 | The Input renders default, hover, focus, disabled, notice-tier, and error-tier states in both themes | VERIFIED | `input.tsx` has `notice`/`error` mutually-exclusive props (error wins), `disabled:opacity-50`, both tiers rendered with distinct border weight + icon + message weight; `input.test.tsx` 5/5 passing; rendered on `/kit` (default/disabled/notice/error) |
| 8 | Notice and error tiers are distinguishable in monochrome by border weight, message weight, and Tabler icon — never by hue | VERIFIED | `grep -Ec "text-red\|bg-red\|border-red" input.tsx` = 0; notice = `border-border-strong` + `IconInfoCircle` + regular weight; error = `border-error border-2` + `IconAlertCircle` + `font-semibold` |
| 9 | The Card renders default and elevated states — soft shadow in light, surface-step in dark — with no `dark:` variant branching | VERIFIED | `card.tsx` consumes `shadow-[var(--shadow-card)]`; `--shadow-card: light-dark(0 4px 16px oklch(0.15 0 0 / 0.08), none)`; `grep -Ec "dark:" card.tsx` = 0; rendered on `/kit` default + elevated (`bg-surface-2`) |
| 10 | The Progress bar renders a value-driven monochrome fill with no numeric grade shown | VERIFIED | `Progress` clamps 0–100, `role="progressbar"` + ARIA triad, `bg-primary` fill with `width: {clamped}%`; `card.test.tsx` asserts no bare percentage text rendered as a grade; `/kit` renders `<Progress value={40} label="Step 2 of 5" />` |
| 11 | Alert renders notice, error, success tiers distinguished by icon shape, border weight, message weight — never hue | VERIFIED | `alert.tsx` `toneConfig` maps 3 tones to distinct Tabler icons (`IconInfoCircle`/`IconAlertCircle`/`IconCircleCheck`), border weight (`border-border-strong` vs `border-error border-2`), message weight (`font-normal` vs `font-semibold`); `grep -Ec "text-red\|bg-red\|border-red\|text-green" alert.tsx` = 0; `alert.test.tsx` 6/6 passing; all 3 tones rendered on `/kit` |
| 12 | Every icon on `/kit` comes from Tabler and no competing icon set is imported anywhere in `apps/web` | VERIFIED (with a caught-late test-quality caveat) | `icon-source.test.ts` scans all `.ts`/`.tsx` under `apps/web` for `react-icons`/`@heroicons/react`/`lucide-react` bare-specifier imports — passes (0 offenders), and manual verification confirms no such imports exist today. The guard regex only matches exact bare specifiers, missing common subpath forms (`@heroicons/react/24/outline`, `react-icons/fa`) and dynamic `import()` — a real weakness in the guard's future-proofing, but the truth as stated ("no competing icon set is imported anywhere") is currently true |
| 13 | Body/UI text renders in Lexend and headings in Fraunces on `/kit` | VERIFIED | `--font-sans: var(--font-lexend), ...` on `body`; `--font-serif: var(--font-fraunces), ...` on `h1,h2,h3`; `/kit` Typography section renders real `<h1>`/`<h2>`/`<p>` at the 4 declared sizes (32/20/17/14) |
| 14 | `/kit` ships in production builds, unlinked from any client-facing screen, with no env gating | VERIFIED | `pnpm --filter @fish/web build` succeeds and lists `/kit` as a static route; no env-gate code found in `kit/page.tsx`; not linked from `/` |

**Score:** 10/11 distinct must-have truths verified (14 detailed truths above collapse to 11 must-haves across the three plans' frontmatter + roadmap contract); 1 failed (blocking).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/globals.css` | Monochrome `light-dark()` ladder + `color-scheme` + two-tone focus ring | ✓ VERIFIED (ladder/color-scheme) / ✗ **DEFECTIVE** (focus ring) | Ladder, chroma-0, color-scheme all correct; focus ring colors are inverted (see gap) |
| `apps/web/vitest.config.ts` | jsdom + React plugin test runner | ✓ VERIFIED | Exists, contains `jsdom`, `@vitejs/plugin-react`, `@/` alias |
| `apps/web/tests/contrast.test.ts` | WCAG AA contrast assertions, every token pair, both themes | ⚠️ VERIFIED but incomplete | Parses globals.css at test time (no drift); 27 assertions pass; 5 shipped pairings not covered (WR-04) |
| `apps/web/components/kit/theme-toggle.tsx` | Dev-only system/light/dark override | ✓ VERIFIED | `"use client"`, sets `data-kit-theme` (not `colorScheme` per original plan text, but functionally equivalent and fixed after checkpoint feedback proved the plan's literal approach was a no-op under the build pipeline) |
| `apps/web/app/kit/page.tsx` | Complete single-scroll demo: tokens/typography/icons/Button/Input/Card/Progress/Alert | ✓ VERIFIED | All 8 sections present in D-13 order; Server Component (`grep -c "use client"` = 0) |
| `apps/web/components/ui/button.tsx` | Hardened with loading + disabled | ✓ VERIFIED | `loading`, `aria-busy`, spinner, layout-stability overlay pattern |
| `apps/web/components/ui/input.tsx` | Two-tier notice/error + disabled + icons | ✓ VERIFIED | `error` prop, Tabler icons, mutual exclusivity |
| `apps/web/components/ui/card.tsx` | Card elevation token + Progress | ✓ VERIFIED | `shadow-[var(--shadow-card)]`, no `dark:` |
| `apps/web/components/ui/alert.tsx` | Block Alert, 3 tones | ✓ VERIFIED | `AlertTone`, `toneConfig`, no forwardRef (matches Card convention) |
| `apps/web/tests/icon-source.test.ts` | Guard: Tabler is the only icon set | ⚠️ VERIFIED but weak | Passes today; regex misses subpath/dynamic imports (WR-03) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `button.tsx` | `globals.css` | `bg-primary`/`text-on-primary` semantic tokens | WIRED | Confirmed in source and rendered build |
| `theme-toggle.tsx` | `document.documentElement` | `data-kit-theme` attribute mutation (not `colorScheme` per original plan wording — corrected during Plan 03 checkpoint) | WIRED | Confirmed working in production CSS: `html[data-kit-theme]` rules compile into Lightning CSS's polyfill-variable flips |
| `contrast.test.ts` | `colorjs.io` | WCAG21 contrast ratio | WIRED | `new Color(...).contrast(other, "WCAG21")` used throughout; 27/27 passing |
| `input.tsx` | `@tabler/icons-react` | `IconInfoCircle`/`IconAlertCircle` beside message | WIRED | Confirmed both imported and rendered conditionally by tier |
| `input.tsx` | `globals.css` | `border-border-strong`/`border-error` semantic tokens | WIRED | Confirmed in class list |
| `kit/page.tsx` | `card.tsx` | `import Card, Progress` | WIRED | Confirmed import and render |
| `alert.tsx` | `@tabler/icons-react` | Icon by tone | WIRED | Confirmed `toneConfig` maps all 3 tones to distinct icons |
| `kit/page.tsx` | `alert.tsx` | `import Alert`, all 3 tones rendered | WIRED | Confirmed |

### Data-Flow Trace (Level 4)

Not applicable in the traditional sense (no backend/DB data flow this phase — pure static design-system demo). The relevant equivalent check is "does the rendered ring color genuinely differ from its background," which was independently verified by extracting and computing actual contrast values from the production CSS bundle rather than trusting the authored source or the SUMMARY's narrative — see gap above.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `pnpm --filter @fish/web test -- --run` | 57/57 passed, 7 files | ✓ PASS |
| Production build succeeds, `/kit` is a static route | `pnpm --filter @fish/web build` | Compiled successfully; `/kit` listed as `○ (Static)` | ✓ PASS |
| Typecheck clean | `pnpm --filter @fish/web typecheck` | Exit 0 | ✓ PASS |
| Lint clean | `pnpm --filter @fish/web lint` | Exit 0 | ✓ PASS |
| No native `light-dark()` ships (polyfill confirmation) | `grep -o "light-dark(" .next/static/chunks/*.css \| wc -l` | 0 occurrences — confirms Lightning CSS polyfill is active as documented | ✓ PASS |
| Focus ring contrast on primary button, light theme | computed from shipped CSS values (`#fff` outline vs `~#f8f8f8` page = 1.06:1; `#0b0b0b` box-shadow vs `#0b0b0b` primary fill = 1.00:1) | Both bands effectively invisible | ✗ FAIL (see gap) |
| Focus ring contrast on primary button, dark theme | mirror computation | 1.00:1 and 1.06:1 — mirror failure | ✗ FAIL (see gap) |
| Focus ring contrast on secondary button (control case) | box-shadow (#0b0b0b) vs surface (#fff) | 19.67:1 — clearly visible | ✓ PASS (confirms failure is scoped to primary variant only) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TOKN-01 | 01-01 | Pure monochrome, no hue | ✓ SATISFIED | chroma-0 test passes; grep clean |
| TOKN-02 | 01-01 | Role-based semantic token names | ✓ SATISFIED | `--color-bg/surface/foreground/notice/...` — no hue names |
| TOKN-03 | 01-01 | Both themes fully specified, every token resolves | ✓ SATISFIED | Every `--color-*` is `light-dark(...)`; parser test confirms no unparsed tokens |
| TOKN-04 | 01-01, 01-03 | System-preference theme, no flash | ✓ SATISFIED | `color-scheme: light dark` zero-JS default; human-confirmed no flash across 3 checkpoint cycles |
| TOKN-05 | 01-03 | Lexend body / Fraunces headings | ✓ SATISFIED | Confirmed in globals.css and rendered on `/kit` typography section |
| TOKN-06 | 01-01, 01-03 | Tabler only icon source | ✓ SATISFIED (guard has a coverage gap, not a violation) | icon-source.test.ts passes; no actual violation exists; guard itself is weak (WR-03) |
| KIT-01 | 01-01, 01-02 | Button/Input/Card/Progress states, both themes | ✓ SATISFIED | All components render required states; tests pass |
| KIT-02 | 01-02, 01-03 | Notices/errors distinguishable without red, calm copy | ✓ SATISFIED | Structural distinction confirmed by grep + component code; copy matches UI-SPEC |
| KIT-03 | — (not claimed by any individual plan's requirements list, but is a phase-level roadmap requirement) | New base components needs-driven, no speculative components | ✓ SATISFIED | Alert built specifically because Phase 2 auth screens need it (documented in Plan 03's Purpose); no speculative components found |
| KIT-04 | 01-01 | 56px minimum control height | ✓ SATISFIED | `min-h-[var(--size-control)]` on Button and Input, asserted by tests |
| KIT-05 | 01-01, 01-03 | Visible keyboard focus + reduced-motion respected | **✗ BLOCKED (partial)** | Reduced-motion: SATISFIED (global media query, confirmed). Visible keyboard focus: **FAILED on the primary button in both themes** — the highest-priority focusable element on any screen |
| KIT-06 | 01-01, 01-02, 01-03 | UI kit demo page shows every component in every state, both themes | ✓ SATISFIED (page exists and is structurally complete; the one state that visually fails is the focus state on primary, captured under KIT-05 above, not a missing-section issue) | All 8 sections present in D-13 order |

**ORPHANED requirements check:** REQUIREMENTS.md maps 12 requirement IDs to Phase 1 (TOKN-01..06, KIT-01..06). All 12 appear across the three plans' `requirements:` frontmatter fields (Plan 01: TOKN-01..06, KIT-01/04/05/06; Plan 02: KIT-01/02/04/05/06; Plan 03: KIT-02/03/05/06, TOKN-04/05/06). No orphaned requirements found — KIT-03 is covered by Plan 03 even though it's not separately called out as a "truth" in any plan's must_haves (satisfied structurally by Alert's Phase-2-driven justification).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/globals.css` | 106-111 | Inverted two-tone focus ring colors | 🛑 Blocker | Keyboard focus invisible on primary button in both themes — directly contradicts D-05/KIT-05 must-have; independently reproduced from shipped CSS |
| `apps/web/components/ui/button.tsx` | 42-56 | `loading` state blocks pointer events but not keyboard activation (`onClick` still fires on Enter/Space while focused) | ⚠️ Warning | Double-submit risk on "Saving…" primary actions; not a phase-goal blocker (no submit-driven Button consumer exists yet in this phase — Phase 2 auth forms are the first real consumer) but should be fixed before Phase 2 wires Button to a submit handler |
| `apps/web/app/globals.css` | 63 | `--shadow-card: light-dark(0 4px 16px oklch(...), none)` — invalid native CSS (light-dark() only accepts `<color>` args); only works because Lightning CSS's polyfill tolerates arbitrary token streams | ⚠️ Warning | Silent breakage risk if the build pipeline's browserslist target advances to native `light-dark()` support; not a present-day defect |
| `apps/web/tests/icon-source.test.ts` | 33 | Guard regex only matches exact bare specifiers, missing subpath imports (`@heroicons/react/24/outline`) and dynamic `import()` | ⚠️ Warning | False confidence in the TOKN-06 guard for future changes; no current violation exists |
| `apps/web/tests/contrast.test.ts` | 99-116 | 5 shipped token pairings (placeholder-on-surface, body/foreground-on-surface-2, notice/error-on-bg) absent from asserted pairs despite the file's own header claiming "every pairing is asserted" | ⚠️ Warning | Regression risk: a future token tweak could silently break placeholder/elevated-card/toggle contrast with no test failing. All pairs currently pass by manual computation |
| `apps/web/components/ui/input.tsx` | 28-58 | Hint/notice/error messages have no `id`/`aria-describedby`; no `aria-invalid` on error tier | ⚠️ Warning | Screen readers announce nothing about field state — contradicts the accessibility floor this design system claims, though not literally one of the phase's stated must-haves |
| `apps/web/components/ui/alert.tsx` | 40-62 | No live-region semantics (`role="status"`) | ⚠️ Warning | Dynamically-rendered Alerts (first real use in Phase 2) will be silent to screen readers; static on `/kit` today so nothing breaks yet |
| `apps/web/package.json` | 23,33 | `tailwindcss`/`@tailwindcss/postcss` both `^4.3.1` (independent caret ranges) despite AGENTS.md's explicit same-version warning | ⚠️ Warning | A partial `pnpm update` could desync them and break the build, per AGENTS.md's own stated risk |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in any file modified by this phase.

### Human Verification Required

None required beyond what already occurred. The one blocking gap (CR-01 / inverted focus ring) does not need further human judgment — it is independently, empirically reproducible from the actual production CSS output using WCAG21 contrast math, and the fix is unambiguous (swap the two `light-dark()` pairs). Human re-verification of the *fix* (visually confirming the corrected ring in both themes) is recommended once patched, but that is standard checkpoint practice for the follow-up, not an open question for this report.

### Gaps Summary

Phase 1 is substantively complete: 8 components (Button, Input, Card, Progress, Alert, plus the token ladder, theme mechanism, and test infrastructure) are real, wired, tested, and rendered on a complete single-scroll `/kit` page in the D-13 order. The theme-toggle mechanism was diagnosed and correctly fixed mid-phase after a genuine checkpoint-caught defect (Lightning CSS polyfill incompatibility). 57/57 tests pass; build, typecheck, and lint are all clean.

One must-have fails on independently reproducible evidence: **the two-tone keyboard focus ring's colors are inverted**, making it effectively invisible (contrast ≈ 1.0:1, both bands) specifically on the primary Button — the single highest-priority control on any screen per this project's own "one primary action" design rule — in both light and dark themes. This was verified three independent ways: (1) direct inspection of the `:focus-visible` rule in `globals.css`, (2) extraction of the actual compiled values from the production `.next` CSS chunk, and (3) WCAG21 contrast computation via the same `colorjs.io` library the project's own contrast test uses. All three agree. No automated test covers this rule, which is why it survived three human phase-gate checkpoint approval cycles — a fast Tab-through at ~1:1 contrast is exactly the kind of near-invisible defect a human visual pass is prone to miss, while computed evidence from shipped bytes is unambiguous.

This is scored as a **blocking gap** because: (a) it is explicitly named as a stand-alone must-have truth in Plan 01's frontmatter ("The keyboard focus ring is visible on the inverted primary button in both light and dark (D-05)"), (b) it maps directly to requirement KIT-05 ("Every interactive element shows a visible keyboard focus state"), (c) it fails on the project's single most important control per screen, and (d) the fix is a small, well-understood, low-risk two-line swap plus a regression test — appropriate for a fast follow-up plan rather than backlog parking.

Secondary (non-blocking) findings — all warnings, none individually goal-blocking: Button's loading state doesn't block keyboard activation (relevant once Phase 2 wires real submit handlers), `--shadow-card` uses invalid native CSS syntax that only works under the current polyfill, the icon-source guard has regex gaps that don't reflect any actual current violation, the contrast test doesn't cover 5 shipped pairings (all currently passing), Input/Alert lack some ARIA wiring, and the new dependencies deviate from the repo's exact-pin convention.

---

_Verified: 2026-07-02T09:46:16Z_
_Verifier: Claude (gsd-verifier)_
