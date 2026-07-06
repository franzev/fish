---
phase: 01-monochrome-design-system-you-can-see
plan: 03
subsystem: ui
tags: [tailwind-v4, light-dark, oklch, tabler-icons, vitest, testing-library, lightning-css, wcag]

# Dependency graph
requires:
  - phase: 01-01
    provides: Monochrome light-dark() token ladder, Vitest/RTL test infra, hardened Button, /kit route with theme toggle
  - phase: 01-02
    provides: Input notice/error two-tier system, Card elevation token, /kit Input/Card/Progress sections
provides:
  - Block-level Alert with notice/error/success tones distinguished structurally (icon shape + border weight + message weight, never hue) — Phase 2 auth consumes it for form-level messages
  - icon-source guard test asserting Tabler is the only icon set imported in apps/web (TOKN-06)
  - Complete /kit single-scroll visual contract - tokens, typography, icons, Button, Input, Card, Progress, Alert, every state, both themes (KIT-06, D-13)
  - Working dev theme toggle under the Lightning CSS light-dark() polyfill (data-kit-theme attribute + stylesheet color-scheme rules)
  - Layout-stability contract on Button - loading overlays the spinner over an opacity-0 mounted label; constant border width across variants; no state change resizes any control
affects: [auth-ui, app-shell]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Theme override = data attribute + stylesheet color-scheme rules, never inline style.colorScheme: Lightning CSS downlevels light-dark() into a prefers-color-scheme variable polyfill, and only build-time-visible color-scheme declarations get compiled into the polyfill-variable flips"
    - "Layout stability: no control changes size on state change - loading spinners overlay an opacity-0 (still mounted) label; border width is constant across variants (transparent where invisible); active states never flip font weight"
    - "Alert tone-config record maps tone to icon/border/message-weight - the same structural-only distinction idiom as Input's two-tier split"

key-files:
  created:
    - apps/web/components/ui/alert.tsx
    - apps/web/components/ui/alert.test.tsx
    - apps/web/tests/icon-source.test.ts
    - apps/web/components/kit/theme-toggle.test.tsx
  modified:
    - apps/web/app/kit/page.tsx
    - apps/web/app/globals.css
    - apps/web/components/kit/theme-toggle.tsx
    - apps/web/components/ui/button.tsx
    - apps/web/components/ui/button.test.tsx

key-decisions:
  - "Theme toggle flips a data-kit-theme attribute consumed by stylesheet color-scheme rules in globals.css - inline style.colorScheme is invisible to Lightning CSS's light-dark() polyfill, which drove the checkpoint-reported toggle failure"
  - "Button loading state overlays an absolutely-centered spinner over the still-mounted opacity-0 label so the label itself preserves the box dimensions - no state change may resize a control (ADHD layout-stability rule)"
  - "All Button variants carry a constant 1px border (transparent on primary/ghost, border-border on secondary) so the box model is identical across variants"
  - "KitThemeToggle active state signals with bg/border/text color only - the font-medium flip resized the toggle buttons on every click"

patterns-established:
  - "Stylesheet-rule theme overrides: any future theme switching must go through CSS rules Lightning CSS can compile, not runtime style mutation"
  - "Layout-stability floor for all controls: state transitions never change rendered dimensions"

requirements-completed: [KIT-02, KIT-03, KIT-06, TOKN-06, TOKN-05, KIT-05, TOKN-04]

# Metrics
duration: 41min
completed: 2026-07-02
---

# Phase 01 Plan 03: Complete /kit Visual Contract Summary

**Alert with three structurally-distinguished monochrome tones, the completed /kit single-scroll contract (tokens/typography/icons + all five components), an icon-source guard, and two checkpoint-driven fixes: a Lightning CSS polyfill-aware theme toggle and a layout-stability hardening of Button**

## Performance

- **Duration:** 41 min (including two human verification cycles at the phase-gate checkpoint)
- **Started:** 2026-07-02T08:44:00Z
- **Completed:** 2026-07-02T09:25:23Z
- **Tasks:** 3 (1 TDD, 1 auto, 1 blocking human-verify checkpoint with 2 fix cycles)
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- Built the block-level `Alert` (notice/error/success) distinguished purely structurally: IconInfoCircle/IconAlertCircle/IconCircleCheck, `border-border-strong` vs `border-error border-2`, `font-normal` vs `font-semibold` — zero hue classes, verified by grep gate and RTL specs
- Added the icon-source guard test scanning all `apps/web` TS/TSX sources: no `react-icons`/`@heroicons/react`/`lucide-react` import can slip in beside Tabler (TOKN-06)
- Completed `/kit` into the full D-13 single-scroll contract: 13-role token swatch grid, typography samples at the 4 declared sizes (32/20/17/14, Fraunces headings / Lexend body), the 3 Tabler icons, then Button, Input, Card, Progress, Alert in every state — page stays a Server Component with the toggle as the only client island
- Diagnosed and fixed the checkpoint-reported theme-toggle failure at its real root cause: Lightning CSS (Next 16/Turbopack) compiles every `light-dark()` away into a `prefers-color-scheme` variable polyfill, so the old inline `style.colorScheme` mutation was a no-op; the toggle now flips `data-kit-theme` and globals.css carries `color-scheme` rules that Lightning CSS compiles into the polyfill-variable flips (verified in the served CSS)
- Hardened Button (and the toggle) for layout stability after checkpoint feedback: loading overlays an absolutely-centered spinner over the still-mounted `opacity-0` label, all variants share a constant border width, and the toggle's active state no longer flips font weight — no state change moves a pixel
- Human phase-gate verification approved on the third pass: no theme flash in either OS theme, no hydration warning, two-tone focus ring visible on the inverted primary in both themes, full monochrome contract with correct fonts and distinguishable tiers

## Task Commits

Each task was committed atomically (TDD: test then feat; checkpoint fixes as fix commits):

1. **Task 1: Alert + icon-source guard (TDD)** - `ddeeccc` (test, RED: alert.tsx absent) → `b242773` (feat, GREEN: 47/47)
2. **Task 2: Complete /kit sections** - `015fbad` (feat: tokens/typography/icons/Alert, D-13 order)
3. **Task 3: Phase-gate human verification** - two fix cycles from user feedback, then approved:
   - `a9c6c3f` (fix: theme toggle under Lightning CSS light-dark() polyfill)
   - `ab58790` (fix: layout stability — Button loading/border, toggle weight flip)

## Files Created/Modified

- `apps/web/components/ui/alert.tsx` - Block Alert; toneConfig record maps tone to Tabler icon + border class + message weight; named export, no forwardRef
- `apps/web/components/ui/alert.test.tsx` - RTL specs for all three tones (border/weight/icon/aria-hidden/children)
- `apps/web/tests/icon-source.test.ts` - Node-env scan of apps/web sources for banned icon-set import specifiers
- `apps/web/components/kit/theme-toggle.test.tsx` - Toggle regression specs: data-kit-theme set/removed, aria-pressed, no weight flip, globals.css hooks present
- `apps/web/app/kit/page.tsx` - Added tokens/typography/icons/Alert sections; final order tokens → typography → icons → Button → Input → Card → Progress → Alert
- `apps/web/app/globals.css` - html[data-kit-theme="light"/"dark"] color-scheme rules (Lightning CSS polyfill hooks)
- `apps/web/components/kit/theme-toggle.tsx` - Flips data-kit-theme attribute instead of inline style; active state color-only
- `apps/web/components/ui/button.tsx` - relative + constant border base; loading spinner overlaid absolute over opacity-0 mounted label
- `apps/web/components/ui/button.test.tsx` - Layout-stability specs (label mounted while loading, absolute spinner, constant variant border)

## Decisions Made

- **Stylesheet-rule theme override, not inline style:** the CSS pipeline (Lightning CSS) downlevels `light-dark()` into `--lightningcss-light/dark` variables flipped by a `prefers-color-scheme` media query. Only `color-scheme` declarations visible at build time get compiled into matching variable flips, so the toggle must flip a `data-kit-theme` attribute whose rules live in globals.css. This also works unchanged if a future pipeline keeps `light-dark()` native.
- **Layout-stability contract:** for this ADHD-focused audience, controls must never resize on state change. Loading states overlay the spinner over the still-mounted (opacity-0) label so the label preserves dimensions; every Button variant carries a constant border width (transparent where invisible); active/selected states signal with color only, never weight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Theme toggle no-op under Lightning CSS light-dark() polyfill**
- **Found during:** Task 3 (checkpoint cycle 1 — user reported "it didn't switch to light when I clicked light")
- **Issue:** Served CSS contains zero `light-dark()` — Lightning CSS downlevels every token into `var(--lightningcss-light, ...) var(--lightningcss-dark, ...)` flipped only by the OS media query; the toggle's inline `style.colorScheme` mutation never re-resolved any token
- **Fix:** `data-kit-theme` attribute + `html[data-kit-theme]` color-scheme rules in globals.css; Lightning CSS compiles those rules into the polyfill-variable flips (verified in served CSS); attribute specificity beats the media-query flip
- **Files modified:** apps/web/components/kit/theme-toggle.tsx, apps/web/app/globals.css, apps/web/components/kit/theme-toggle.test.tsx (regression specs)
- **Verification:** Served CSS shows `--lightningcss-light: initial` inside the light rule and `--lightningcss-dark: initial` inside the dark rule; human confirmed toggle works in both directions
- **Committed in:** a9c6c3f

**2. [Rule 1 - Bug] Buttons resized on state change (layout stability)**
- **Found during:** Task 3 (checkpoint cycle 2 — user reported "I don't like buttons changing sizes when switching states")
- **Issue:** Three causes: (a) loading inserted a 24px inline spinner+margin next to the label, shifting/growing the box; (b) secondary carried a 1px border primary/ghost lacked; (c) KitThemeToggle's active option flipped to font-medium, resizing all three toggle buttons on every theme click
- **Fix:** Spinner overlaid absolute (`inset-0 m-auto`) over the still-mounted `opacity-0` label; constant `border border-transparent` in Button base with color-only variant overrides; toggle active state color-only. Focus ring checked and already non-layout-affecting (outline/box-shadow)
- **Files modified:** apps/web/components/ui/button.tsx, apps/web/components/ui/button.test.tsx, apps/web/components/kit/theme-toggle.tsx, apps/web/components/kit/theme-toggle.test.tsx
- **Verification:** 4 new regression specs green; human confirmed nothing shifts across default/disabled/loading and toggle clicks
- **Committed in:** ab58790

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs surfaced by the phase-gate checkpoint feedback loop, exactly the iteration the plan's Task 3 prescribed)
**Impact on plan:** Both fixes were necessary for the phase's core promises (working dual-theme demo, calm/stable UI). No scope creep; no architectural change.

## Authentication Gates

None.

## Issues Encountered

- The plan assumed inline `style.colorScheme` re-resolves `light-dark()` natively — true in a raw browser, false under this repo's build pipeline because Lightning CSS polyfills `light-dark()` at build time. Worth remembering for any future theme work: verify against the *served* CSS, not the authored CSS.

## Known Stubs

None. Every /kit section renders real wired components; the Alert examples use the UI-SPEC copy contract.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 requirements all demonstrated on /kit and human-approved: monochrome dual-theme tokens (TOKN-01..05), Tabler-only iconography with a guard test (TOKN-06), hardened kit with every state (KIT-01..06)
- Alert is ready for Phase 2 auth screens (form-level messages); Input two-tier + Button layout-stability patterns carry into auth forms
- Full suite 57/57 green; build, typecheck, lint all exit 0
- Phase complete — ready for phase verification / Phase 2 planning

## Self-Check: PASSED

- All 4 created files exist on disk; all 5 modified files contain their required markers (`AlertTone`, `data-kit-theme`, `opacity-0` label wrap, icon-source guard specifiers)
- All 5 task commits found in git log (ddeeccc, b242773, 015fbad, a9c6c3f, ab58790)
- Acceptance criteria re-verified: no red/green hue in alert.tsx (grep 0), no banned icon imports (grep 0), /kit renders all three Alert tones + border-strong/error/success swatches + 32px display sample, no old-hue-token-a/old-hue-token-b, no "use client" in page
- Full suite 57/57 green; `pnpm --filter @fish/web build`, `typecheck`, `lint` exit 0
- TDD gate: test-before-feat commit order verified for Task 1 (ddeeccc → b242773)
- Human checkpoint: approved after 2 fix cycles (all six manual checks pass)

---
*Phase: 01-monochrome-design-system-you-can-see*
*Completed: 2026-07-02*
