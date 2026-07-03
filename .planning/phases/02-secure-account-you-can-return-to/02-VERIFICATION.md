---
phase: 02-secure-account-you-can-return-to
verified: 2026-07-03T08:17:24Z
status: human_needed
score: 16/16 must-haves verified (10 initial + 3 from gap-closure 02-06 + 3 from gap-closure 02-07)
has_blocking_gaps: false
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 13/13 must-haves verified
  gaps_closed:
    - "Wrong password on /login shows a single in-place field-level error in the soft notice tone, without a full page reload (UAT test 7 — whole-page layout shift + wrong tier, closed by gap-closure plan 02-07)"
  gaps_remaining: []
  regressions: []
---

# Phase 2: Secure account you can return to — Verification Report (Re-verification)

**Phase Goal:** As a new client, I want to sign up, verify my email, log in, stay logged in across a browser restart, and log out, so that I can always return to an account where my data belongs only to me. (Mode: mvp. Full linear email/password auth loop backed by a hardened profiles + coach-client schema with server-enforced roles and RLS.)
**Verified:** 2026-07-03T08:17:24Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 02-07 (UAT test 7)

## Context

This is the third verification pass for Phase 2. The prior pass (2026-07-03T14:20:00Z, preserved in git history) recorded `status: human_needed` at 13/13 must-haves verified, after gap-closure plan 02-06 fixed the UAT test 3 blocker (verification-email-link 500). That pass flagged UAT tests 4-13 as still pending live human execution.

Since then, a second UAT session ran 10 more live tests (commit `09b8b7c`, "UAT session 2 - 10 passed, 2 issues, 1 blocked") and surfaced two new issues:

- **Test 3 retest** — no defect found on retest (diagnosis confirmed, resolved).
- **Test 7 (Wrong Password Stays Calm)** — a real defect: the wrong-password message caused a whole-page layout shift (card grew ~30px, flexbox re-centered the page, 14.8px jump on heading/button) and was wired to the heavy tier-2 `error` prop instead of the tier-1 `notice` tone. Diagnosed in `.planning/debug/resolved/login-wrong-password-full-rerender.md`.
- **Test 10 (Recovery Link)** — investigated; diagnosis proved no code/config defect (anti-enumeration behavior masked a typo'd email address in the original UAT attempt). A valid recovery email for `client1@fish.dev` is already sitting in Mailpit, ready for retest.

Gap-closure plan 02-07 (commits `cae9ca5`, `a04ccaf`, `470b502`, `ad585a3`) fixed the test 7 defect:
1. `Input` now always renders its hint/notice/error message row inside a single persistent container with a `min-h-[22px]` reservation — the same layout-stability principle `Button` already applies to its overlay spinner. Showing/hiding a message now changes text, never geometry.
2. `/login`'s wrong-password (and connection-failure) copy moved from the tier-2 `error` prop to the tier-1 `notice` prop, rendering in the soft monochrome tone (regular weight, info icon) instead of the heavy semibold/alert-icon/red-adjacent treatment.

This re-verification independently re-checks the 02-07 fix at all three levels (exists, substantive, wired), re-runs the full test suite and production build live (not trusting the SUMMARY's reported numbers), regression-checks the 13 previously-verified must-haves for drift, and reflects the current, authoritative `02-UAT.md` ledger state.

## Goal Achievement

### Observable Truths — Gap-Closure Plan 02-07 (newly verified this pass)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every `Input` reserves constant vertical space for its message row, so showing/hiding hint/notice/error text changes text, not geometry | VERIFIED | `apps/web/components/ui/input.tsx:48` — message row is a single persistent `<div className="mt-2 min-h-[22px]">` always rendered, whether or not `hint`/`notice`/`error` is passed; the three message `<p>` variants are conditionally rendered *inside* this always-mounted container, not around it. Independently confirmed by re-running `input.test.tsx`'s two new tests live: "always renders the message row, even with no hint/notice/error" and "the message row reserves a constant min-height regardless of message presence" — both pass. |
| 2 | The wrong-password copy renders in the tier-1 soft `notice` tone (regular weight, info icon, notice color), never the heavy tier-2 error treatment, never red | VERIFIED | `apps/web/app/login/page.tsx:79` — `notice={passwordError \|\| undefined}` (was `error={...}` before this plan). Confirmed live: `login/page.test.tsx`'s new test "a bad-credentials error renders in the tier-1 notice treatment, not the tier-2 error treatment" asserts the rendered message element's className does NOT contain `font-semibold` — passes. `text-notice` token in `globals.css` is an achromatic grey (`light-dark(oklch(0.40 0 0), oklch(0.80 0 0))` — zero chroma), never red. |
| 3 | Wrong password on /login shows a single in-place field-level error without any full page reload; when it appears, no other element on the page moves — the card does not grow and the flex-centered layout does not re-center | VERIFIED (human-confirmed) | `02-UAT.md` test 7: `result: pass`, note records a delegated live Chromium session (1440x900) measuring heading/button/card/footer-link bounding-rect deltas at 0.00px (down from the diagnosed 14.8px jump), no reload, URL unchanged, field values preserved. `02-07-SUMMARY.md`'s "Checkpoint Evidence" section independently corroborates the same measurements plus two regression probes (double-submit still shows exactly one message at 0.00px deltas; signup's tier-2 duplicate-email error is unaffected — still semibold/alert-icon/`border-error`/2px). Code inspection confirms no `window.location` or `<form action=` navigation triggers exist in `login/page.tsx`; `event.preventDefault()` is present, consistent with the SPA-only submit the human evidence describes. |

**Score: 3/3 gap-closure truths verified** (2 fully re-provable by static/unit-test re-execution, 1 human-confirmed via live browser measurement cross-checked against two independent evidence sources — UAT.md and SUMMARY.md — that agree on specifics, not just conclusions).

### Regression Check — Plans 02-01 through 02-06 (previously VERIFIED, re-checked for drift)

| # | Truth (from prior verifications) | Status | Evidence |
|---|-------|--------|----------|
| 4 | signup and reset-password keep their tier-2 `error` treatment — no regression from the Input/login change | VERIFIED (no drift) | `grep -n "error=\|hint=\|notice=" apps/web/app/signup/page.tsx` -> `error={emailError \|\| undefined}` (line 94), `hint="At least 8 characters."` (line 100) — unchanged. `grep -n "error=\|hint=\|notice=" apps/web/app/reset-password/page.tsx` -> `hint=` (line 70), `error={error \|\| undefined}` (line 73) — unchanged. Neither file was touched by plan 02-07 (confirmed via `files_modified` in 02-07-PLAN.md frontmatter, limited to `input.tsx`, `input.test.tsx`, `login/page.tsx`, `login/page.test.tsx`). |
| 5 | Full test suite passes | VERIFIED (re-run live, not trusted from SUMMARY) | Ran `pnpm --filter @fish/web exec vitest run` myself this pass: **15 files, 123/123 tests passing.** Matches the number claimed in 02-07-SUMMARY.md, independently reproduced. |
| 6 | Production build + typechecks pass | VERIFIED (re-run live) | Ran `pnpm build` myself this pass: `apps/web` compiles successfully (Turbopack, 3.7s), TypeScript passes, 13 routes generate/compile (static + dynamic), `packages/core` and `packages/supabase` `tsc --noEmit` both exit clean. |
| 7 | No `.getSession(` server-side; no `exchangeCodeForSession`; open-redirect guard on `/auth/confirm`; port/site_url alignment (02-06 fix) | VERIFIED (no drift) | None of these files are in plan 02-07's scope; 02-06's fix (`apps/web/package.json` dev script, `supabase/config.toml` site_url) is untouched by the diff since the prior verification pass (`git diff` shows no changes to either file in the 02-07 commit range). |
| 8 | Gap-closure diff is surgical — no scope creep | VERIFIED | `files_modified` in 02-07-PLAN.md frontmatter lists exactly 4 files (`input.tsx`, `input.test.tsx`, `login/page.tsx`, `login/page.test.tsx`); `git show --stat` for commits `cae9ca5`/`a04ccaf` confirms only those 4 files (plus the docs commits `470b502`/`ad585a3`, which touch only `.planning/` tracking files). No signup, reset-password, forgot-password, migration, or config file touched. |
| 9 | No debt markers introduced | VERIFIED | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` on all 4 code files modified by 02-07 plus `apps/web/package.json`/`supabase/config.toml` (02-06 scope) -> zero matches. |
| 10 | Requirements traceability current | VERIFIED | `.planning/REQUIREMENTS.md` shows AUTH-01..06, DB-01..04 all `[x]` Complete, mapped to Phase 2. KIT-02 (declared by 02-07-PLAN as a reinforced, not orphaned, requirement — it is a Phase-1-owned UI-kit contract phase 02 consumes and regression-tests) is present and marked `[x]` Complete under Phase 1, consistent with 02-07 extending an existing Phase-1 layout-stability contract to a new component rather than introducing a new requirement. |

No regressions found. All previously-verified artifacts, key links, and behaviors from plans 02-01 through 02-06 remain intact (full detail preserved in git history from the prior verification pass, dated 2026-07-03T14:20:00Z).

### Required Artifacts (gap-closure plan 02-07)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components/ui/input.tsx` | Input with a constant-height message row reserving space whether or not a message is shown | VERIFIED | Persistent `<div className="mt-2 min-h-[22px]">` wraps all three conditional message `<p>` variants; WHY comment references the layout-stability contract explicitly. Tier semantics (hint suppressed by notice/error; error wins over notice; icon/weight/border per tier) unchanged from before this plan. |
| `apps/web/app/login/page.tsx` | Wrong-password copy wired to the tier-1 notice prop | VERIFIED | Line 79: `notice={passwordError \|\| undefined}`. State variable name, copy strings, and error-branch routing logic (email_not_confirmed -> /check-inbox, bad credentials -> field message, transport failure -> connection copy) all unchanged. |
| `apps/web/components/ui/input.test.tsx` | Test asserting the message row is always present and reserves height | VERIFIED | Two new tests present and passing: "always renders the message row, even with no hint/notice/error" and "the message row reserves a constant min-height regardless of message presence" (asserts `className` matches `/min-h-\[/`). All 4 pre-existing tests (tap-target, notice tier, error tier, error-wins, disabled) still present and passing — 7 tests total in this file, all green. |
| `apps/web/app/login/page.test.tsx` | Test asserting wrong-password copy uses the notice tier, not the error tier | VERIFIED | New test "a bad-credentials error renders in the tier-1 notice treatment, not the tier-2 error treatment" present and passing, asserting the rendered message lacks `font-semibold`. All 9 pre-existing tests (primary-button grep gate, RTL role query, two inputs, two links, successful sign-in, email-not-confirmed by message and by stable code, bad-credentials copy, network-failure copy) still present and passing — 10 tests total in this file, all green. |

All 4 required artifacts for gap-closure plan 02-07: VERIFIED (exists, substantive, wired). No stubs, no orphans.

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/web/app/login/page.tsx` | `apps/web/components/ui/input.tsx` | `notice` prop on the Password Input | WIRED | `grep -n "notice={passwordError"` on `login/page.tsx` -> line 79, matches the plan's declared pattern exactly. Input's `notice` branch (`!error && notice`) renders it in the tier-1 tone since `error` is never passed on this field. |
| `apps/web/components/ui/input.tsx` | Reserved message slot | Always-rendered message row with reserved min-height | WIRED | `grep -n "min-h-\["` on `input.tsx` -> line 48, the persistent container. Confirmed rendered unconditionally (outside all three tier conditionals) via direct file read. |
| `login/page.test.tsx` new assertion | `input.tsx` notice-tier rendering | RTL `findByText` + `className` check | WIRED | Test queries the rendered DOM text and asserts absence of `font-semibold` — this is an integration-level check (renders the real `Input` component via `LoginPage`, not a mock), so it verifies the actual prop-to-render wiring, not just that a prop was passed. |

All key links for this gap-closure: WIRED.

### Data-Flow Trace (Level 4)

Not applicable in the traditional sense (no server data source to trace) — this is a pure client-side rendering-and-state fix. The relevant "data flow" is: `signInWithPassword` error -> `setPasswordError(string)` -> `notice` prop -> conditional render inside the always-mounted container. Traced end-to-end via the RTL tests above, which exercise the real component tree (not shallow/mocked rendering of `Input`), confirming the state genuinely reaches the DOM in the expected tier.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes (independently re-run, not trusted from SUMMARY) | `pnpm --filter @fish/web exec vitest run` | 15 files, 123/123 tests passing | PASS |
| Input + login test files specifically (new assertions) | `pnpm vitest run components/ui/input.test.tsx app/login/page.test.tsx` | 2 files, 17/17 tests passing | PASS |
| Production build + shared package typechecks | `pnpm build` | `apps/web` compiles (Turbopack), TypeScript clean, 13 routes generated; `packages/core`/`packages/supabase` `tsc --noEmit` clean | PASS |
| No debt markers in gap-closure-touched files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across 4 files | Zero matches | PASS |
| signup/reset-password unaffected (regression check) | `grep -n "error=\|hint=\|notice=" apps/web/app/signup/page.tsx apps/web/app/reset-password/page.tsx` | Both retain `error=`/`hint=` unchanged, no `notice=` introduced | PASS |
| No full-page navigation triggers in login page (supports the "no reload" human claim) | `grep -n "window.location\|form action=" apps/web/app/login/page.tsx` | Zero matches; `event.preventDefault()` present | PASS |
| Debug session file properly archived | `ls .planning/debug/resolved/login-wrong-password-full-rerender.md` | File exists, 11322 bytes, committed in `dbc9b39` | PASS |

7/7 spot-checks PASS this pass, all independently executed (not read from SUMMARY.md).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-01 | 02-04 | Signup with email+password, always client | SATISFIED | Verified in prior passes; unaffected by 02-07 |
| AUTH-02 | 02-04, 02-06 | Verification email + calm check-inbox screen; link works end-to-end | SATISFIED | Verified in prior passes; unaffected by 02-07 |
| AUTH-03 | 02-05, 02-07 | Log in with email and password; wrong-password feedback is calm, in-place, and non-revealing | SATISFIED | Login mechanism verified in prior passes; the wrong-password *presentation* defect (UAT test 7) is now closed — live-measured 0.00px layout shift, tier-1 tone confirmed |
| AUTH-04 | 02-05 | Reset password via email link -> single-field screen | SATISFIED (mechanism); UAT test 10 retest pending | proxy.ts/updateUser mechanism verified in prior passes; live retest with the verbatim seeded email still needs to run (a valid recovery email is already waiting in Mailpit per the diagnosis) |
| AUTH-05 | 02-01, 02-04 | Session persists across refresh and restart | SATISFIED | UAT tests 4-6 all now `pass` in 02-UAT.md (user-confirmed live) |
| AUTH-06 | 02-04 | Log out from any authenticated screen | SATISFIED | UAT test 5 `pass` in 02-UAT.md |
| DB-01 | 02-02 | Profile row auto-created, trigger never blocks signup | SATISFIED | Verified in prior passes; unaffected by 02-07 |
| DB-02 | 02-02, 02-03 | coach_clients table + seed script | SATISFIED | Verified in prior passes; unaffected by 02-07 |
| DB-03 | 02-02, 02-03 | RLS: client sees own, coach sees assigned only | SATISFIED | UAT test 12 `pass` — `verify:rls` 6/6 PASS, exit 0 |
| DB-04 | 02-02, 02-03 | Role enforced server-side, no self-escalation | SATISFIED | UAT test 12 `pass` — self-escalation rejected, safe-field update succeeds |
| KIT-02 | Phase 1 (reinforced by 02-07) | Errors/notices distinguishable in monochrome via weight/structure/icon, never red | SATISFIED | Not orphaned — a Phase-1-owned requirement 02-07 extends to a new consumer (Input's reserved-row contract) and regression-tests (signup/reset-password tier-2 unaffected) |

**No orphaned requirements.** All 10 phase-02-declared requirement IDs (AUTH-01..06, DB-01..04) are present in `.planning/REQUIREMENTS.md`, all marked `[x]` Complete. KIT-02, declared by plan 02-07, is a Phase-1 requirement being reinforced, not a new phase-02 obligation — it is correctly attributed to Phase 1 in REQUIREMENTS.md and not double-counted.

### Anti-Patterns Found

Scanned all files modified by gap-closure plan 02-07 (`apps/web/components/ui/input.tsx`, `apps/web/components/ui/input.test.tsx`, `apps/web/app/login/page.tsx`, `apps/web/app/login/page.test.tsx`) for `TBD`/`FIXME`/`XXX` (blocker gate), `TODO`/`HACK`/`PLACEHOLDER`, "coming soon"/"not yet implemented" language, and stub-shaped returns.

**Result: zero matches.** The fix is a clean, minimal layout-stability + tone change — no debt markers, no placeholder text, no stub implementations.

The 5 INFO-tier findings from the original 02-REVIEW.md (IN-01 through IN-05, all cosmetic/Phase-3-territory, explicitly out of scope) remain open by design and are unaffected by this gap-closure plan; see the prior verification pass (git history) for the full list. None are must-have failures.

### Human Verification Required

**UAT tests 10 and 11 remain outstanding in `.planning/phases/02-secure-account-you-can-return-to/02-UAT.md`** — this is the live, authoritative human-testing ledger for this phase.

| Test # | Name | UAT.md status | Note |
|---|---|---|---|
| 10 | Recovery Link Lands on Set-New-Password (post-restart retest) | pending | First attempt reported "no email received" — diagnosis (`.planning/debug/recovery-email-not-delivered.md`) proved the submitted address matched no account (anti-enumeration 200), not a defect. A valid recovery email for `client1@fish.dev` is already waiting in Mailpit; retest just needs to open it and walk through set-new-password. |
| 11 | Consumed Link Routes to a Calm Expired-Link Screen | blocked | Blocked by test 10 (needs a link to click twice — the second click is what this test exercises). Unblocks the instant test 10 runs. |

All 11 other UAT tests (1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13) show `result: pass` in 02-UAT.md, with 0 open issues in the Gaps ledger (all 3 recorded gap entries — test 3 port/site_url mismatch, test 7 layout shift/wrong tier, test 10 no-defect diagnosis — show `status: resolved`).

**Why human:** Tests 10 and 11 require a live browser following real Mailpit-delivered email links and observing the resulting screen — this is exactly the category of check (real mail-client link-following, live session establishment) that cannot be verified by static code inspection or unit tests. The underlying mechanism (recovery email template, `type=recovery&next=/reset-password`, `/auth/confirm` handling, `updateUser` on `/reset-password`) was already code-verified and live-HTTP-tested in the initial verification pass; only the live walk-through with the correct email address remains.

### Gaps Summary

**No blocking gaps.** The phase's two open UAT gap entries at the time of the prior verification pass (test 3 and test 7) are now BOTH resolved:
- Test 3 (verification email link 500): closed by gap-closure plan 02-06, re-confirmed live.
- Test 7 (wrong-password layout shift + wrong tier): closed by gap-closure plan 02-07, re-confirmed this pass via independent test-suite re-execution, build re-execution, and cross-checked human evidence (UAT.md + SUMMARY.md agree on specific pixel deltas and tone details, not just a bare "pass").

The remaining item (test 10, and its dependent test 11) is not a code defect — the phase's own diagnosis proved the pipeline is healthy end-to-end and a valid recovery email is already sitting in Mailpit ready for the retest. This is a live human walk-through step, not a gap requiring a plan or code fix.

Status is `human_needed`, not `passed`, because tests 10 and 11 remain `pending`/`blocked` in the phase's own live UAT tracking file — per the MVP-mode verification protocol, a phase cannot be marked `passed` while human verification items are outstanding, even when all automatable evidence is green and no code defect exists. This is the expected next step, not a new gap.

---

_Verified: 2026-07-03T08:17:24Z_
_Verifier: Claude (gsd-verifier)_
