---
status: diagnosed
trigger: "Pressing Enter in the /expired-link resend form does not submit it. UAT test 11 (Phase 02) — routing to /expired-link worked, but keyboard submit of the resend form does not work; only clicking the button submits."
created: 2026-07-03T16:00:00.000Z
updated: 2026-07-03T16:10:00.000Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — /expired-link has no <form> element at all; the email Input and resend Button live in a plain <div>, and the Button is explicitly type="button" with onClick. Implicit form submission (Enter in a text field) requires a <form>, so Enter is a structural no-op on this page.
test: Read page source, shared Button/Input components, all sibling auth pages, and searched for global keydown interceptors.
expecting: n/a — diagnosis complete.
next_action: Return ROOT CAUSE FOUND to orchestrator (goal: find_root_cause_only; no fix applied).

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: On /expired-link (apps/web, Next.js App Router, dev on http://localhost:3001), with the pre-filled email field focused, pressing Enter submits the resend form exactly like clicking the resend button.
actual: "enter submit still not working in /expired-link page" — pressing Enter does nothing; only the button click submits.
errors: None reported
reproduction: UAT test 11 (.planning/phases/02-secure-account-you-can-return-to/02-UAT.md). Local stack: Supabase running (Mailpit at http://127.0.0.1:54324), dev server on port 3001. Reach /expired-link by re-clicking a consumed email link, then press Enter in the pre-filled email field.
started: Discovered during UAT (test 11). Identical symptom reported on /reset-password (test 10, investigated separately).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Shared Button component swallows Enter (key handler, non-native element, or disabled state)
  evidence: apps/web/components/ui/button.tsx renders a plain native <button>, spreads all props, has no onKeyDown/keydown logic. loading state only applies opacity + pointer-events-none (pointer events don't affect keyboard). Not the cause.
  timestamp: 2026-07-03T16:08:00.000Z
- hypothesis: Shared Input component intercepts Enter
  evidence: apps/web/components/ui/input.tsx is a plain native <input> with label/hint markup; no key handlers, no preventDefault. Not the cause.
  timestamp: 2026-07-03T16:08:00.000Z
- hypothesis: A global keydown listener / preventDefault interceptor breaks Enter across auth pages (would explain tests 10 and 11 sharing a symptom)
  evidence: grep across apps/web/app, apps/web/components, apps/web/lib for onKeyDown|keydown|addEventListener|preventDefault found ONLY the standard event.preventDefault() inside the onSubmit handlers of signup/login/forgot-password/reset-password. No global interceptor exists. Tests 10 and 11 do NOT share a component-level root cause.
  timestamp: 2026-07-03T16:08:00.000Z
- hypothesis: A prior fix attempted Enter-submit on /expired-link and regressed ("still not working" wording)
  evidence: git log --follow on apps/web/app/expired-link/page.tsx shows only 49af8bb (created with type="button" + onClick, no form) and 4fe7463 (WR-02 resend honesty fix, kept the same pattern). The page has NEVER had a <form>; no Enter-related fix was ever attempted here.
  timestamp: 2026-07-03T16:09:00.000Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-03T16:00:00.000Z
  checked: .planning/debug/knowledge-base.md
  found: File does not exist; no knowledge base entries to match. Resolved sessions present: login-wrong-password-full-rerender.md, verify-email-link-500.md (neither matches Enter-submit symptom).
  implication: Proceed with fresh hypothesis formation.
- timestamp: 2026-07-03T16:05:00.000Z
  checked: apps/web/app/expired-link/page.tsx (full read)
  found: No <form> element anywhere. Input + Button wrapped in <div className="mt-6 space-y-5"> (line 58). Button is type="button" with onClick={handleResend} (lines 66-70). Comment at lines 23-24 explicitly acknowledges the pattern ("The Input's `required` can't gate a type=\"button\" click — guard here...") — the manual empty-email guard papers over the missing form semantics.
  implication: Per the HTML spec, implicit form submission (Enter in a text/email field) only fires when the field is inside a <form> with a submit button. With no form, Enter is a no-op. This alone fully explains the symptom.
- timestamp: 2026-07-03T16:06:00.000Z
  checked: apps/web/app/expired-link/page.test.tsx
  found: All submission tests use fireEvent.click on the button. No test simulates Enter keypress or fireEvent.submit.
  implication: Test coverage gap — keyboard submission was never asserted, so the defect shipped undetected. Gap-closure should add an Enter-submit test.
- timestamp: 2026-07-03T16:07:00.000Z
  checked: Sibling auth pages (login, signup, forgot-password, reset-password) via grep for form/onSubmit/type=
  found: All four use <form className="mt-6 space-y-5" onSubmit={handleSubmit}> with <Button type="submit">. /expired-link is the ONLY auth screen that deviates (bare div + type="button" + onClick).
  implication: The established repo pattern already solves this; the fix is to bring /expired-link in line with its siblings.
- timestamp: 2026-07-03T16:08:00.000Z
  checked: apps/web/components/ui/button.tsx, apps/web/components/ui/input.tsx, global grep for key handlers
  found: Both components are clean native elements with no key interception; no global keydown/preventDefault interceptors in apps/web.
  implication: Root cause is page-local to expired-link/page.tsx. NOT shared with /reset-password (test 10), whose page already has a correct <form onSubmit> + type="submit" structure — that symptom must have a different mechanism.
- timestamp: 2026-07-03T16:09:00.000Z
  checked: apps/web/app/check-inbox/page.tsx (same commit 4fe7463, same resend pattern)
  found: Same no-form + type="button" + onClick pattern (lines 51-57), but the page renders NO Input (grep count 0) — only a button, and Enter on a focused button activates it natively.
  implication: The defect does not manifest on /check-inbox; only /expired-link has a text field whose Enter goes nowhere. No change strictly required there, though gap-closure may normalize it for consistency.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: apps/web/app/expired-link/page.tsx has no <form> element — the email Input and resend Button are wrapped in a plain <div> (line 58), and the Button is explicitly type="button" wired to onClick={handleResend} (lines 66-70). Implicit form submission (pressing Enter in a text/email input) is an HTML form behavior; without a wrapping <form> and a type="submit" button, Enter performs no action. The page has had this structure since creation (commit 49af8bb) and is the only auth screen deviating from the repo's established <form onSubmit> + Button type="submit" pattern.
fix: (not applied — goal: find_root_cause_only) Direction: wrap the Input + Button in <form className="mt-6 space-y-5" onSubmit={handleSubmit}> matching login/signup/forgot-password; change Button to type="submit"; convert handleResend to handleSubmit(event: FormEvent) with event.preventDefault(). The native `required` on the Input then also gates submission, letting the manual empty-email guard become a simple safety net. Add a page test that submits via Enter/fireEvent.submit.
verification: n/a (diagnosis only)
files_changed: []
