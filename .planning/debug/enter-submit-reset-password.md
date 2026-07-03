---
status: diagnosed
trigger: "Pressing Enter in the /reset-password password field does not submit the form. UAT test 10 (Phase 02)."
created: 2026-07-03T00:00:00Z
updated: 2026-07-03T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — hydrated /reset-password submits on Enter correctly (live browser proof). The reported "Enter does nothing" is explained by the pre-hydration window: Enter before React hydration triggers NATIVE implicit form submission (GET to /reset-password? — silent same-page reload that wipes the field), demonstrated live with JS disabled. next dev's lazy first-visit route compilation stretches that window to human scale on the very navigation the recovery link produces.
test: (A) Playwright vs live stack, hydrated page: Enter vs click — identical outcomes. (B) JS-disabled (pre-hydration proxy): Enter -> native GET self-navigation, field wiped, no submission.
expecting: n/a — both experiments completed
next_action: Return ROOT CAUSE FOUND diagnosis (goal: find_root_cause_only; no fix applied)

reasoning_checkpoint:
  hypothesis: "The page code is NOT defective post-hydration; the observed 'Enter does nothing' matches the pre-hydration native-GET-self-submit failure mode (amplified by dev-mode lazy compilation on first visit), with a password-manager Enter-swallow as the untestable environmental alternative."
  confirming_evidence:
    - "Live repro (hydrated, real Chromium, real stack): Enter fired keydown -> submit -> handleSubmit -> navigated to /expired-link?type=recovery, identical to button click"
    - "Live repro (JS disabled = pre-hydration): Enter caused navigation to /reset-password? (native GET, empty query — input has no name attr), full reload, password field emptied — visually 'nothing happened'"
    - "All static candidates eliminated with direct evidence (markup, components, global handlers, stale code)"
  falsification_test: "If Enter failed on a hydrated page in the live repro, the pre-hydration theory would be irrelevant and a code defect would exist — observed the opposite"
  fix_rationale: "No markup/handler fix needed on /reset-password. Gap closes via hydrated retest + optional real-browser e2e regression; the genuine code defect in this symptom family is /expired-link's formless resend UI (test 11, separate gap)"
  blind_spots: "Cannot observe the user's original session: cannot distinguish pre-hydration timing from a headed-browser password-manager overlay swallowing Enter. Both are environment/timing, not steady-state code defects; the pre-hydration mechanism is the only code-observable one and is proven to look exactly like the report."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: On /reset-password (apps/web, Next.js App Router, dev on localhost:3001), with the password field focused, pressing Enter submits the form exactly like clicking the primary button (password updated, user lands on /home).
actual: Pressing Enter does nothing; the form only submits via button click.
errors: None reported
reproduction: UAT test 10 (.planning/phases/02-secure-account-you-can-return-to/02-UAT.md). Local Supabase (Mailpit at 127.0.0.1:54324), dev server on port 3001. Complete recovery-link flow, land on /reset-password, focus password field, press Enter.
started: Discovered during UAT (Phase 02). Related identical symptom reported on /expired-link (test 11, investigated separately).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Button with onClick instead of form onSubmit (the /expired-link pattern) breaks Enter on /reset-password
  evidence: page.tsx uses <form onSubmit> + <Button type="submit">; live SSR HTML confirms. /expired-link has that defect; /reset-password does not.
  timestamp: 2026-07-03

- hypothesis: Shared Input/Button components intercept the Enter key
  evidence: Full read of both components — no key handlers; props spread cleanly onto native elements.
  timestamp: 2026-07-03

- hypothesis: Global keydown handler or nested form swallows Enter
  evidence: grep across apps/web finds no keydown/onKeyDown listeners; no <form> in layout.tsx.
  timestamp: 2026-07-03

- hypothesis: Stale code — UAT ran against an older broken version
  evidence: Form markup identical since first commit (2da7883); worktree file identical to main checkout serving the dev server.
  timestamp: 2026-07-03

- hypothesis: Enter-submit is broken at all on the hydrated /reset-password page
  evidence: Live Playwright reproduction (Chromium headless shell, real dev stack, port 3001): Enter in the password field fired keydown-enter -> native submit on FORM -> handleSubmit ran -> AuthSessionMissingError path -> navigated to /expired-link?type=recovery. Control (button click) produced the identical outcome. Repro script: scratchpad/repro-enter.js.
  timestamp: 2026-07-03

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-03
  checked: apps/web/app/reset-password/page.tsx (full read)
  found: Page uses <form className="mt-6 space-y-5" onSubmit={handleSubmit}> wrapping Input + <Button type="submit">. handleSubmit calls event.preventDefault() then supabase.auth.updateUser. Markup is textbook-correct for implicit Enter submission.
  implication: The "onClick-only button without form" hypothesis is FALSE for this page. Cause must be elsewhere (shared component interception, nested form, global handler, or stale build during UAT).

- timestamp: 2026-07-03
  checked: apps/web/components/ui/button.tsx and input.tsx (full read)
  found: Button spreads {...props} onto native <button> AFTER its own attrs, so type="submit" passes through untouched. Input spreads {...props} onto native <input>; no onKeyDown/onKeyPress handlers anywhere in either component.
  implication: Shared UI components do not intercept Enter. Eliminates component-level key interception.

- timestamp: 2026-07-03
  checked: grep for keydown/onKeyDown/onKeyPress/preventDefault across apps/web; layout.tsx for wrapping forms; git log of page.tsx
  found: Only preventDefault occurrences are inside the four pages' own onSubmit handlers. No global key listeners. No <form> in layout. Form markup existed since the page's first commit (2da7883), unchanged by c5293d3.
  implication: No global interceptor, no nested-form parser issue, no stale-code theory — the markup has always been correct.

- timestamp: 2026-07-03
  checked: Live SSR HTML from dev server (curl http://localhost:3001/reset-password) + diff worktree vs main checkout
  found: Served DOM is <form class="mt-6 space-y-5"> containing <input type="password" minLength="8" required> and <button type="submit">. Worktree file is identical to the checkout the dev server runs from (main @ eadaa92).
  implication: The running app serves structurally correct implicit-submission markup. Static analysis cannot explain "Enter does nothing" — need live behavioral reproduction in a real browser.

- timestamp: 2026-07-03
  checked: apps/web/app/expired-link/page.tsx (comparison — sibling symptom, test 11)
  found: /expired-link genuinely lacks a <form>: inputs sit in a <div className="mt-6 space-y-5"> and the button is type="button" with onClick={handleResend}. Its own code comment admits required can't gate a type="button" click.
  implication: The two pages do NOT share one mechanism. /expired-link is mechanically broken (no form); /reset-password is not. Test 11's "still not working" phrasing may have colored the test 10 report, OR an environment-level factor (e.g. password-manager dropdown) affects both.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: >
  Not a steady-state code defect. The hydrated /reset-password page submits on Enter
  correctly (proven live: Enter and button click produce identical end-to-end behavior
  against the running dev stack). The reported symptom matches the pre-hydration window:
  before React hydration attaches onSubmit, Enter triggers the browser's NATIVE implicit
  submission — a GET to the same URL (/reset-password?; the input has no name attribute,
  so the query is empty and the password never reaches the URL) that silently reloads the
  page and wipes the field, i.e. exactly "pressing Enter does nothing". In `next dev`,
  the first visit to /reset-password (which is precisely what the recovery-link redirect
  produces) pays lazy route compilation, stretching the unhydrated window to several
  seconds — enough to type a password and press Enter. After that reload the route is
  warm, hydration is instant, and the button click works, matching the report "only the
  button submits". A headed-browser password-manager overlay swallowing the first Enter
  is the alternative (untestable headlessly) environmental explanation; both are
  timing/environment, not markup or handler bugs. The sibling test 11 issue on
  /expired-link IS a genuine structural code defect (no <form>, type="button" onClick)
  with a different mechanism — its persistent, real Enter failure likely reinforced the
  perception that "Enter is broken" across auth pages.
fix: n/a — diagnose-only session (goal: find_root_cause_only)
verification: >
  Repro A (scratchpad/repro-enter.js): hydrated page, Enter -> keydown-enter -> native
  submit event on FORM -> handleSubmit -> AuthSessionMissingError path -> navigation to
  /expired-link?type=recovery; identical to click control. Repro B (repro-nojs.js):
  JS disabled, Enter -> navigation /reset-password -> /reset-password?, field value
  emptied, same heading — the silent "nothing happened" reload.
files_changed: []
