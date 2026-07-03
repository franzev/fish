---
phase: 02-secure-account-you-can-return-to
plan: 08
subsystem: auth-ui
tags: [react, nextjs, tailwind-v4, forms, accessibility, design-tokens, vitest]

# Dependency graph
requires:
  - phase: 02-secure-account-you-can-return-to
    provides: "02-04/02-05 auth screens (login/signup/forgot-password/reset-password/check-inbox/expired-link) and their shared form pattern; 02-07's layout-stability contract on Input"
provides:
  - "Every auth screen now submits on Enter (shared <form onSubmit> + type=\"submit\" pattern, no stragglers left)"
  - "Button has honest cursor feedback (pointer/progress/not-allowed) without pointer-events-none, using the native disabled attribute + a loading click-guard for non-activation"
  - "Calm semantic tone tokens (--color-error, --color-warning, --color-success) added to the theme, contrast-test gated, consumed by Alert's notice|warning|error|success tones"
  - "Notices on /expired-link and /check-inbox float above the centered Card as a fading, out-of-flow aria-live overlay — the card never resizes or moves in any state"
affects: [phase-03-role-aware-home, future-auth-screens, ui-kit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Out-of-flow floating notice overlay (absolute, bottom-full, aria-live=\"polite\") for any vertically-centered Card that needs to show a result without ever resizing the card"
    - "Button non-activation without pointer-events-none: native disabled attribute for disabled, explicit click-guard (preventDefault + early return before the consumer onClick) for loading"
    - "Conditional onClick attachment (`onClick={onClick ? handleClick : undefined}`) to keep RSC-rendered Buttons with no consumer handler serializable across the Server/Client boundary"

key-files:
  created: []
  modified:
    - apps/web/components/ui/button.tsx
    - apps/web/components/ui/button.test.tsx
    - apps/web/app/expired-link/page.tsx
    - apps/web/app/expired-link/page.test.tsx
    - apps/web/app/check-inbox/page.tsx
    - apps/web/app/check-inbox/page.test.tsx
    - apps/web/app/globals.css
    - apps/web/components/ui/alert.tsx
    - apps/web/components/ui/alert.test.tsx
    - apps/web/tests/contrast.test.ts
    - apps/web/app/kit/page.tsx

key-decisions:
  - "Notices float above the card as an out-of-flow, fading aria-live overlay instead of reserving in-flow height — this supersedes the plan's own first fix (reserved invisible row), which the user rejected at the checkpoint for still coupling notice visibility to card geometry"
  - "Alert tones are now deliberately distinguished by hue (soft coral error / soft amber warning / sage green success, chroma <= 0.15, light-dark() pairs, contrast-test gated) — a documented, deliberate exception to the phase-01 monochrome-only rule for alerts; --color-notice stays neutral/monochrome"
  - "Button non-activation moved off pointer-events-none (which silently suppressed the button's own cursor) onto the native disabled attribute (disabled state) plus an explicit loading click-guard (loading state)"
  - "Button's click-guard is only attached when the consumer passes an onClick, to avoid breaking RSC prerendering of Server-Component call sites (/ and /kit) that render <Button> with no handler"

requirements-completed: [AUTH-04, AUTH-06, KIT-01, KIT-04]

coverage:
  - id: D1
    description: "/expired-link and /check-inbox submit their resend via a real <form onSubmit> + type=\"submit\" Button, so pressing Enter in the email field submits (UAT test 11 closed)"
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: "apps/web/app/expired-link/page.test.tsx — Enter/submit regression (signup + type=recovery routing)"
        status: pass
      - kind: unit
        ref: "apps/web/app/check-inbox/page.test.tsx — form-submit test"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint — user confirmed Enter submits on /expired-link"
        status: pass
    human_judgment: false
  - id: D2
    description: "/reset-password Enter-submit re-verified working end-to-end on a settled/hydrated page (UAT test 10 retest, no code change)"
    requirement: AUTH-04
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint — user confirmed Enter submits on /reset-password"
        status: pass
    human_judgment: true
    rationale: "jsdom cannot exercise native implicit form submission or the pre-hydration timing window; this is inherently a live-browser check the user performed at the checkpoint."
  - id: D3
    description: "Button shows cursor-pointer / cursor-progress / cursor-not-allowed while staying non-activatable by click and keyboard when disabled or loading, with no size change in any state"
    requirement: KIT-01
    verification:
      - kind: unit
        ref: "apps/web/components/ui/button.test.tsx — cursor utility, guarded-click, disabled/toBeDisabled, layout-stability tests"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint — user confirmed cursor feedback and no size change"
        status: pass
    human_judgment: false
  - id: D4
    description: "Notices float above the card as a fading, out-of-flow overlay (reworked per user feedback at the checkpoint) with real semantic tone colors, and the centered card never moves"
    requirement: KIT-04
    verification:
      - kind: unit
        ref: "apps/web/app/expired-link/page.test.tsx, apps/web/app/check-inbox/page.test.tsx — overlay positioning, fade-in class, per-branch tone assertions"
        status: pass
      - kind: unit
        ref: "apps/web/tests/contrast.test.ts — warning token contrast + chroma-exception assertions"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint (round 2) — user confirmed overlay/fade/tone-colors rework"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-07-03
status: complete
---

# Phase 02 Plan 08: Enter-submit forms + Button cursor feedback Summary

**Every auth screen now submits on Enter via a shared `<form onSubmit>` pattern, Button gained honest pointer/progress/not-allowed cursors without losing non-activation, and — after two rounds of checkpoint feedback — notices float above their Card as a fading overlay with real semantic tone colors instead of forcing the card to resize.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-07-03T20:42:00Z
- **Completed:** 2026-07-03T21:29:39Z
- **Tasks:** 3 (2 auto + 1 checkpoint, plus 4 additional commits driven by checkpoint feedback)
- **Files modified:** 11

## Accomplishments
- /expired-link and /check-inbox both submit their resend through a real `<form onSubmit={handleSubmit}>` with a `type="submit"` Button — Enter in the email field now submits, matching every sibling auth screen (UAT test 11 closed).
- Button now shows `cursor-pointer` when interactive, `cursor-progress` while loading, and `cursor-not-allowed` when disabled, while staying non-activatable via the native `disabled` attribute (disabled) and an explicit click-guard (loading) — `pointer-events-none` is gone from the component entirely.
- UAT test 10 (/reset-password Enter submit) re-verified working end-to-end on a hydrated page at the checkpoint — no /reset-password code change needed; the earlier report was the universal Next.js pre-hydration window.
- Calm semantic tone tokens (`--color-error`, `--color-warning`, `--color-success`) added to the theme (contrast-test gated, chroma <= 0.15, `light-dark()` pairs), and Alert's tones extended to `notice | warning | error | success`.
- Notices on /expired-link and /check-inbox now float above the vertically-centered Card as an always-mounted, out-of-flow, fading `aria-live="polite"` region — the card never resizes or jumps in any state, superseding this plan's own first (rejected) fix.
- /kit showcases the new warning tone (token swatch, icon, and Alert example).

## Task Commits

Each task was committed atomically, plus additional fix/feat commits driven by checkpoint feedback:

1. **Task 1: Button honest cursor feedback** - `1094384` (feat) — cursor-pointer/progress/not-allowed, pointer-events-none removed, loading click-guard added.
2. **Task 2: Real form + Enter submit for /expired-link and /check-inbox** - `90cc955` (fix) — `<form onSubmit>` + `type="submit"` on both pages; Enter/submit regression tests added.
3. **(Task 1 verification fix) RSC-safety** - `50ad46f` (fix) — only attach Button's `onClick` when the consumer passes one, fixing a `next build` prerender break on `/` and `/kit`.
4. **(Checkpoint round 1 fix, SUPERSEDED)** - `ecc2149` (fix) — reserved invisible notice row; user rejected this shape at the checkpoint.
5. **(Checkpoint round 2, design evolution)** - `2d0b437` (feat) — calm semantic tone tokens (error/warning/success) + fade-in utility.
6. **(Checkpoint round 2, design evolution)** - `3c327f7` (fix) — notices reworked into a floating, fading, out-of-flow overlay above the card; reverts `ecc2149`'s reserved-row mechanics.
7. **(Kit showcase)** - `7077ee3` (docs) — warning tone added to /kit.

**Plan metadata:** (this commit) `docs(02-08): complete plan — resolve UAT gaps and debug sessions`

_Note: TDD tasks 1 and 2 each committed feat/fix with tests in the same commit rather than separate RED/GREEN commits — consistent with this phase's established gap-closure commit style._

## Files Created/Modified
- `apps/web/components/ui/button.tsx` - Cursor utilities (pointer/progress/not-allowed), removed pointer-events-none, loading click-guard, conditional onClick attachment
- `apps/web/components/ui/button.test.tsx` - New cursor/guarded-click/non-activation tests; updated assertions that referenced the removed pointer-events-none class
- `apps/web/app/expired-link/page.tsx` - Real `<form onSubmit>`, floating fading notice overlay with real success/warning/notice tones
- `apps/web/app/expired-link/page.test.tsx` - Enter/submit regression tests, overlay positioning + tone assertions
- `apps/web/app/check-inbox/page.tsx` - Real `<form onSubmit>` (normalization), floating fading notice overlay with success/warning tones
- `apps/web/app/check-inbox/page.test.tsx` - Form-submit test, overlay positioning + tone assertions
- `apps/web/app/globals.css` - `--color-warning` token added alongside error/success; `animate-fade-in` utility
- `apps/web/components/ui/alert.tsx` - Extended tones to notice|warning|error|success with hue-based tinting + shadow-card (floating-overlay use)
- `apps/web/components/ui/alert.test.tsx` - Coverage for the new warning tone
- `apps/web/tests/contrast.test.ts` - warning token added to contrast pairing lists; chroma exception scoped to the three feedback tones only
- `apps/web/app/kit/page.tsx` - Warning swatch, icon, and Alert example added to the showcase

## Decisions Made
- Notices float above the card as an out-of-flow, fading `aria-live` overlay rather than reserving in-flow height for them — a stronger, more general form of the phase-01/02 layout-stability contract (Button's overlay spinner, Input's reserved message row from 02-07): the card's own box is never touched by notice visibility at all.
- Alert tones are now deliberately distinguished by hue (soft coral error, soft amber warning, sage green success — chroma <= 0.15, `light-dark()` pairs, contrast-test gated) — a documented, deliberate exception to the phase-01 "distinguish never by hue" rule, scoped to Alert only; `--color-notice` remains neutral/monochrome.
- Button's non-activation contract moved off `pointer-events-none` (which silently suppressed the button's own cursor) onto two independent mechanisms: the native `disabled` HTML attribute for the disabled state, and an explicit `preventDefault` + early-return click-guard for the loading state.
- The click-guard's `onClick` is only attached when a consumer actually passes one, so Server-Component call sites with no handler (`/` and `/kit`) keep prerendering correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RSC-safety: Button onClick attached unconditionally broke `next build` prerendering**
- **Found during:** Task 1 verification (`pnpm build`, run per the plan's verification gate before the checkpoint)
- **Issue:** Task 1's click-guard always wired `onClick={handleClick}`, even with no consumer `onClick` passed. Button renders inside Server Components with no `onClick` (the `/` page's plain buttons, `/kit`'s `<Button loading>` demo row); unconditionally attaching a function prop there broke prerendering with "Event handlers cannot be passed to Client Component props."
- **Fix:** Only set `onClick` when the consumer passed one (`onClick={onClick ? handleClick : undefined}`). The click-guard still fires whenever there is a consumer handler to guard.
- **Files modified:** `apps/web/components/ui/button.tsx`, `apps/web/components/ui/button.test.tsx` (added a regression test asserting `.onclick` is null with no consumer callback, in both default and loading states)
- **Verification:** `pnpm build` — 13/13 routes prerender, including `/` and `/kit`.
- **Committed in:** `50ad46f`

### User Design Decision (checkpoint feedback, not a bug fix)

**2. Checkpoint round 1 — flicker on /expired-link submit, root cause and first (rejected) fix**
- **Found during:** Task 3 checkpoint, first round
- **Issue:** User reported flicker on /expired-link submit. Root cause: the notice `Alert` was conditionally mounted below the resend button; both pages vertically center their Card, so the Alert's mount/unmount height delta amplified into the whole card jumping — and jumping twice on repeat submits, since a mid-flight `setNotice("")` on /expired-link also unmounted it.
- **First fix (REJECTED by user):** `ecc2149` — reserved an always-mounted, invisible (`invisible` + `aria-hidden`) notice row below the button so mount/unmount no longer changed height. The user rejected this shape at the checkpoint, asking instead for the notice to float above the card entirely, with real (non-alarming) tone colors rather than a single generic notice tone.
- **Second fix (adopted, evolves the design system):** `2d0b437` + `3c327f7` — added calm semantic tone tokens (error/warning/success, contrast-gated) to the theme; extended Alert's tones accordingly; reworked both pages so the notice region is always mounted but positioned OUT of document flow (`absolute`, `bottom-full`, anchored above the card), with the Alert itself conditionally mounted inside that region and fading in via a new `animate-fade-in` utility (suppressed under `prefers-reduced-motion`). Removed the mid-flight `setNotice("")` so a previous result stays visible until the new attempt resolves, instead of blinking out and back in. Both pages now pick a real result tone (`success` on send, `warning` on failure/rate-limit, `notice` only for the empty-email guard on /expired-link) instead of always reusing the neutral `notice` tone for every outcome.
- **Files modified:** `apps/web/app/globals.css`, `apps/web/components/ui/alert.tsx`, `apps/web/components/ui/alert.test.tsx`, `apps/web/tests/contrast.test.ts`, `apps/web/app/expired-link/page.tsx`, `apps/web/app/expired-link/page.test.tsx`, `apps/web/app/check-inbox/page.tsx`, `apps/web/app/check-inbox/page.test.tsx`
- **Verification:** Full suite green (152/152), `pnpm build` passes; user confirmed the reworked overlay/fade/tone-colors at the checkpoint's second round ("approved").
- **Committed in:** `ecc2149` (superseded), `2d0b437`, `3c327f7`

**3. [Kit consistency] Warning tone showcased in the UI kit**
- **Found during:** After the tone-token addition, before final checkpoint sign-off
- **Issue:** /kit demonstrates every design token and Alert tone as a living reference; adding `warning` without a showcase entry would leave the kit out of sync with the component's actual capabilities.
- **Fix:** Added a warning swatch to the token grid, an `IconAlertTriangle` to the icons row, and an `Alert tone="warning"` example between notice and error.
- **Files modified:** `apps/web/app/kit/page.tsx`
- **Verification:** Visual — swatch/icon/example render correctly in the kit page; `pnpm build` still passes.
- **Committed in:** `7077ee3`

---

**Total deviations:** 3 (1 auto-fixed bug, 1 user design decision spanning two commits + a superseded first attempt, 1 consistency addition)
**Impact on plan:** The RSC-safety fix was a necessary correctness fix caught by the plan's own verification gate before checkpoint sign-off. The notice-overlay rework was a direct, explicit user design decision at the checkpoint — it materially evolves the design system (Alert tones now carry deliberate hue, layout-stability contract extended to "notices never reflow the card") but stayed within this plan's scope (the same two pages, the same Alert component) rather than requiring a new plan. No scope creep beyond what the checkpoint asked for.

### Post-approval polish (after plan sign-off)

**4. [Post-approval polish] Input/form spacing rebalanced — reserved-row contract preserved**
- **Found during:** User review of `/login` after this plan was marked complete: "input spacing doesnt look good" — the vertical gap below each input read as a hole.
- **Root cause:** The 02-07 layout-stability fix's reserved message row (`mt-2` = 8px + `min-h-[22px]` = 22px, on `apps/web/components/ui/input.tsx`) stacked with each auth form's `space-y-5` (20px) gap, producing 50px from an input's bottom edge to the next label — vs only 8px from a label to its own field above it. The reserved row and the form gap were double-counting the same visual gap.
- **Fix:** Tightened the row's own top margin (`mt-2` → `mt-1`, 8px → 4px) and each auth form's gap (`space-y-5` → `space-y-1`, 20px → 4px), applied identically across all six auth forms (login, signup, forgot-password, reset-password, expired-link, check-inbox — including check-inbox, whose form has no `Input`, for consistency). `min-h-[22px]` on the reserved row is unchanged — it remains the floor for the tallest hint/notice/error message (20px icon + 14px text at default line-height, flex `items-center`, ≈21px content), so the layout-stability contract from 02-07 (row always mounted, constant min-height, messages render inside without resizing the field) is fully preserved.
- **New rhythm:** input bottom border → next label = `mt-1` (4px) + `min-h-[22px]` (22px) + `space-y-1` (4px) = **30px**, identical on every auth form (down from 50px).
- **Files modified:** `apps/web/components/ui/input.tsx`, `apps/web/app/login/page.tsx`, `apps/web/app/signup/page.tsx`, `apps/web/app/forgot-password/page.tsx`, `apps/web/app/reset-password/page.tsx`, `apps/web/app/expired-link/page.tsx`, `apps/web/app/check-inbox/page.tsx`
- **Verification:** Full suite green (152/152 — no test asserted the old `mt-2`/`space-y-5` classes directly), `pnpm build` passes (13/13 routes), `pnpm lint` clean. Rendered output on the live dev server confirmed the new `space-y-1` and `mt-1 min-h-[22px]` classes are applied.
- **Commits:** `64b3275` (code), plus this docs commit.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02 (secure account you can return to) has no more pending gap-closure plans; all UAT gaps tracked in `02-UAT.md` are now resolved (see UAT file for the accounting of each).
- The notice-overlay pattern (out-of-flow, fading, `aria-live`) and the semantic tone tokens are new, reusable primitives — future phases building result/status UI on centered cards should reuse this pattern rather than reserving in-flow space.
- Phase 03 (role-aware home) can proceed; nothing in this plan blocks it.

---
*Phase: 02-secure-account-you-can-return-to*
*Completed: 2026-07-03*

## Self-Check: PASSED

- All 11 key files confirmed present on disk (button.tsx, button.test.tsx, expired-link/page.tsx + page.test.tsx, check-inbox/page.tsx + page.test.tsx, globals.css, alert.tsx, alert.test.tsx, contrast.test.ts, kit/page.tsx).
- All 7 referenced commits confirmed present in `git log --all` (1094384, 50ad46f, 90cc955, ecc2149, 2d0b437, 3c327f7, 7077ee3).
- Full test suite re-run at HEAD: 152/152 tests passing across 15 files.
- `pnpm build` re-run at HEAD: production build + shared typechecks pass, all 13 routes prerender.
