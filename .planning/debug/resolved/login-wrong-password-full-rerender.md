---
status: resolved
trigger: "UAT test 7 gap: Wrong password on /login should show a single in-place field-level error in the soft notice tone, without a full page reload. User reported: 'the whole page rerenders when login button clicked'"
created: 2026-07-03T15:30:00Z
updated: 2026-07-03T08:13:30Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — no reload occurs; the "whole page rerenders" is a whole-page layout shift caused by the vertically-centered card growing ~30px when the error line appears (no reserved space for the message), plus the message rendering in the heavy tier-2 error treatment instead of the expected soft notice tone
test: Reproduced UAT test 7 in real headless Chrome via CDP against the running dev server (localhost:3001) with sentinel + navigation-event instrumentation and before/after layout measurement
expecting: n/a — diagnosis complete
next_action: Return ROOT CAUSE FOUND to orchestrator (goal: find_root_cause_only — no fix applied)

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "On /login, enter your email with a wrong password. A single field-level error appears — 'That email and password don't match. Try again?' — in the soft notice tone, never alarming red, and it does not reveal whether the email exists." No full page reload.
actual: "the whole page rerenders when login button clicked" (verbatim user report). Whether the error copy appears after the re-render was unknown at intake — investigation determined it DOES appear.
errors: None reported
reproduction: UAT test 7 — on /login (dev server on port 3001), enter seeded email (client1@fish.dev) with any wrong password, click primary button
started: Discovered during UAT 2026-07-03; correct-password login works (test 6 passed)

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: H1 — login is a server action that redirect()s on failure (full navigation round-trip)
  evidence: apps/web/app/login/page.tsx is "use client" with an onSubmit handler calling supabase.auth.signInWithPassword client-side; the wrong-password path only sets local state (setPasswordError) — no server action, no redirect anywhere in the failure path
  timestamp: 2026-07-03T15:32:00Z

- hypothesis: H2 — form not wired to a client handler, browser performs default full-document POST
  evidence: form has onSubmit={handleSubmit} with event.preventDefault() as the first statement; CDP reproduction confirmed the handler runs (error state rendered, no navigation)
  timestamp: 2026-07-03T15:45:00Z

- hypothesis: H3 — hydration failure / JS error on /login causing fallback to native submit (actual document reload)
  evidence: (1) UAT tests 6 and 8 passed in the same session — both require the hydrated handleSubmit on this exact page (test 8 routes through the SAME error branch via router.push to /check-inbox); (2) live CDP reproduction: window.__sentinel survived the click, location.href unchanged, ZERO Page.frameNavigated / Page.loadEventFired events post-click, no console errors or exceptions
  timestamp: 2026-07-03T15:45:00Z

- hypothesis: Running dev server executes different (stale) code than the reviewed source
  evidence: main checkout HEAD (09b8b7c) == worktree base; diff of login/page.tsx and components/ui/input.tsx between worktree and /Users/franz/Work/Personal/fish is IDENTICAL
  timestamp: 2026-07-03T15:35:00Z

- hypothesis: Error copy never appears (silent failure)
  evidence: CDP reproduction — after click, DOM contains p element with exact text "That email and password don't match. Try again?"
  timestamp: 2026-07-03T15:45:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-03T15:30:00Z
  checked: .planning/debug/knowledge-base.md
  found: Does not exist — no known-pattern candidates
  implication: Proceed with fresh hypothesis formation

- timestamp: 2026-07-03T15:32:00Z
  checked: apps/web/app/login/page.tsx (full read)
  found: Client component; handleSubmit calls event.preventDefault(), signInWithPassword; on error sets passwordError state in place and passes it to Input via the `error` prop (tier 2), not the `notice` prop (tier 1). Page layout: main className "flex min-h-dvh items-center justify-center px-5 py-12" — card is vertically centered.
  implication: Authored code is in-place; but copy is wired to the heavy error tier, and the card is flex-centered with no reserved space for the message line

- timestamp: 2026-07-03T15:35:00Z
  checked: diff worktree vs main checkout for login/page.tsx and input.tsx; git log both
  found: IDENTICAL; main HEAD 09b8b7c == worktree base
  implication: Dev server runs exactly the code reviewed

- timestamp: 2026-07-03T15:36:00Z
  checked: components/ui/input.tsx, components/ui/button.tsx, globals.css tokens
  found: Input `error` tier renders an extra p (mt-2, 20px icon, semibold) below the field and flips border 1px->2px; NO space is reserved when no message is shown. Button loading state is layout-stable (overlay spinner). --color-error is monochrome oklch(0.95 0 0) dark / 0.20 light — not red. --color-notice is the softer tier-1 token.
  implication: Message appearance adds ~30px of height to the card; color is compliant (not red) but treatment tier is the heavy one

- timestamp: 2026-07-03T15:37:00Z
  checked: app/layout.tsx, lib/supabase/client.ts, proxy.ts
  found: No auth listeners/providers in layout; browser client is plain createBrowserClient; proxy only refreshes sessions on Next navigations — the signInWithPassword XHR goes directly to Supabase :54321, never through Next
  implication: No hidden navigation/refresh trigger exists on auth failure

- timestamp: 2026-07-03T15:40:00Z
  checked: Live GoTrue response — POST http://127.0.0.1:54321/auth/v1/token?grant_type=password with client1@fish.dev + wrong password
  found: 400, error_code "invalid_credentials", msg "Invalid login credentials"
  implication: Client takes the setPasswordError branch (not the email_not_confirmed router.push branch) — wrong password is a pure in-place state update

- timestamp: 2026-07-03T15:45:00Z
  checked: Real-browser reproduction — headless Chrome (CDP) against running dev server; filled client1@fish.dev + wrong password via native setters, clicked Log in; instrumented Page.frameNavigated/loadEventFired, console, window sentinel, and element bounding rects before/after
  found: sentinel survived; href unchanged; zero navigation/load events; zero console errors; error copy rendered in place ("That email and password don't match. Try again?", computed color lab(94.2 0 0) — monochrome, font-weight 600, password border 2px). Card height grew 443.9px -> 473.6px (+29.7px).
  implication: NO reload/navigation happens. The DOM change is real and in-place; the visible defect must be the layout consequence

- timestamp: 2026-07-03T15:47:00Z
  checked: Same reproduction at a realistic 1440x900 desktop viewport
  found: When the error appears, the flex-centered card re-centers: heading/h2 (and email field) jump UP 14.8px while the button and links jump DOWN 14.8px — every element on screen moves simultaneously in the same frame; also a brief button spinner flicker during the ~100ms auth round trip
  implication: This whole-viewport simultaneous movement is what the user described as "the whole page rerenders" — a whole-page layout shift, not a reload

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  There is NO full page reload or navigation — the wrong-password path is fully client-side, in-place, and the
  expected copy DOES render. The reported "whole page rerenders" is a whole-page LAYOUT SHIFT:

  1. PRIMARY — /login centers its Card vertically (main: "flex min-h-dvh items-center justify-center",
     apps/web/app/login/page.tsx line 63) and the Input component reserves NO space for its message line
     (apps/web/components/ui/input.tsx renders the hint/notice/error <p> conditionally). When passwordError is
     set, the error line (+ mt-2 + 20px icon row) grows the card by ~30px, and flexbox re-centers it: measured
     at 1440x900, the heading and email field jump UP 14.8px while the button and links jump DOWN 14.8px in the
     same frame. Every visible element moves at once — on this sparse, calm page that reads as "the whole page
     re-rendered". This violates the phase-01 layout-stability contract ("no control changes size on state
     change"), which Button honors but Input + the centered page layout do not.

  2. SECONDARY (same UAT truth) — the copy is wired to Input's tier-2 `error` prop (semibold, 1px->2px border
     flip, IconAlertCircle) instead of the tier-1 soft `notice` tone UAT test 7 expects. Color is compliant
     (monochrome lab(94.2 0 0), never red), but the treatment is the heavy tier and the border flip adds to the
     visual jolt.
fix: (not applied — goal is find_root_cause_only; gap-closure plan will implement)
verification: (n/a — diagnosis only. Fix verification should re-run UAT test 7 and assert zero movement of the heading/button when the message appears, e.g. via the CDP measurement used here)
files_changed: []

## Reasoning Checkpoint (diagnosis)

reasoning_checkpoint:
  hypothesis: "Wrong-password submit updates state in place; the perceived 'whole page rerender' is the flex-centered card growing ~30px with no reserved message space, shifting every on-screen element simultaneously; the message additionally renders in the heavy error tier rather than the expected soft notice tone"
  confirming_evidence:
    - "CDP real-browser repro: sentinel survived, zero frameNavigated/load events, error copy present — no reload"
    - "Measured layout: card +29.7px; at 1440x900 heading -14.8px and button +14.8px in the same frame"
    - "UAT tests 6 and 8 passed in the user's own browser — the same handler (incl. an error branch) works, ruling out hydration fallback"
  falsification_test: "If the user's browser showed a URL change to /login?email=... or cleared fields (native GET submit), the layout-shift explanation would be wrong — not reported, and impossible given tests 6/8 passed"
  fix_rationale: "Reserving constant space for the field message (and using the notice tier) removes the size change at its source, so the centered layout never re-centers"
  blind_spots: "Could not observe the user's exact browser session; a browser-extension-induced one-off reload cannot be 100% excluded, but all reproducible evidence contradicts it"

## Resolution

Resolved by gap-closure plan 02-07 (commits cae9ca5, a04ccaf):
- Input always renders a persistent `mt-2 min-h-[22px]` message row — showing/hiding hint/notice/error changes text, not geometry (the layout-stability contract Button already honored).
- /login passes the wrong-password copy through the tier-1 `notice` prop instead of tier-2 `error`.

Fix verified 2026-07-03 in a live Chromium session (1440x900, dev server :3001) using this session's CDP measurement pattern: heading/button/footer-link/card rect deltas all 0.00px when the message appears (previously 14.8px); message renders weight-400 with info-circle icon, monochrome; signup/reset tier-2 treatment unaffected; happy-path login still lands /home. UAT test 7 marked pass.
