---
phase: 02-secure-account-you-can-return-to
plan: 04
subsystem: auth
tags: [supabase, nextjs, app-router, verifyOtp, token-hash, suspense, rtl, vitest, email-template]

# Dependency graph
requires:
  - phase: 02-secure-account-you-can-return-to (plan 01)
    provides: three-client SSR factories (browser/server/proxy), proxy session refresh, authRedirects.home, config.toml template registration, local Supabase stack
  - phase: 02-secure-account-you-can-return-to (plan 02)
    provides: profiles schema + handle_new_user trigger (hard-codes role='client'), RLS, role guard
  - phase: 01-monochrome-design-system-you-can-see
    provides: hardened UI kit (Button/Input/Card/Alert), monochrome token ladder, Vitest+RTL harness
provides:
  - /signup — client-component form (name/email/password), auth.signUp with display_name metadata only, calm existing-email error, redirect to /check-inbox
  - /check-inbox — shared signup + unverified-login screen (D-05), Suspense-wrapped useSearchParams, in-place resend with Alert tone=notice
  - /auth/confirm — token_hash verifyOtp Route Handler (success → next/default /home; failure → /expired-link with type hint + email)
  - /expired-link — calm type-aware resend screen (signup vs recovery method branch, D-06)
  - /home — server-rendered authenticated placeholder; getUser() + redirect('/login') when signed out; one LogoutButton client island
  - components/auth/logout-button.tsx — signOut + navigate to /login, no confirmation dialog
  - supabase/templates/confirmation.html — FISH-voice, pure-monochrome, token_hash verification email
affects: [02-05, phase-3-routing, phase-3-role-landings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Search-param screens split into inner 'use client' component + page-level Suspense wrapper (next build gate on useSearchParams)"
    - "One-primary-per-screen enforced two ways: source grep for variant=\"primary\" AND an RTL getAllByRole('button') filter on bg-primary"
    - "Server page + single client island: /home is a Server Component mounting LogoutButton, mirroring kit/page.tsx's KitThemeToggle precedent"
    - "Route Handler redirects to calm screens, never raw errors: /auth/confirm forwards type=signup|recovery + email to /expired-link"
    - "Email templates mirror the dark-theme monochrome ladder in hex (email HTML cannot consume CSS tokens); zero chroma"

key-files:
  created:
    - apps/web/app/signup/page.tsx
    - apps/web/app/signup/page.test.tsx
    - apps/web/app/check-inbox/page.tsx
    - apps/web/app/check-inbox/page.test.tsx
    - apps/web/app/expired-link/page.tsx
    - apps/web/app/expired-link/page.test.tsx
    - apps/web/app/auth/confirm/route.ts
    - apps/web/app/home/page.tsx
    - apps/web/app/home/page.test.tsx
    - apps/web/components/auth/logout-button.tsx
  modified:
    - supabase/templates/confirmation.html

key-decisions:
  - "Sibling links (e.g. 'Already have an account? Log in') are plain text <Link> elements, never a second Button — keeps the one-primary grep gate meaningful"
  - "The one-primary source grep for /home spans page.tsx + logout-button.tsx combined (the primary lives in the composed island, not inlined in the page)"
  - "Email template is pure monochrome mirroring the dark-theme token ladder; the lime accent in AGENTS.md is stale against the binding monochrome decision"
  - "/auth/confirm maps any non-recovery type to a signup hint on the expired-link redirect, so the resend screen never guesses"

patterns-established:
  - "Suspense-wrapped useSearchParams: every search-param-reading screen ships as inner client component + Suspense fallback Card"
  - "Auth screen layout idiom: min-h-dvh flex items-center justify-center wrapper + Card max-w-[440px]"
  - "Comments must not contain grep-gated strings (getSession/ConfirmationURL) even when warning against them"

requirements-completed: [AUTH-01, AUTH-02, AUTH-05, AUTH-06]

# Metrics
duration: 15min
completed: 2026-07-03
---

# Phase 2 Plan 04: Core Signup Loop Summary

**The full linear signup loop: /signup (always a client) → FISH-voice token_hash email → /check-inbox → /auth/confirm verifyOtp → signed in at /home with one logout action; expired/used links route to a calm type-aware resend screen, and a signed-out /home visit redirects to /login**

## Performance

- **Duration:** 15 min (excludes checkpoint waits)
- **Started:** 2026-07-03T01:05:00Z
- **Completed:** 2026-07-03T02:05:00Z (close-out after human-verify approval)
- **Tasks:** 4 (3 auto + 1 blocking human-verify phase-gate)
- **Files modified:** 12 (11 created, 1 modified)

## Accomplishments

- The phase's headline capability walked end-to-end by the user and approved: sign up → Mailpit email → click link → signed in at /home → refresh + full browser restart still signed in → consumed link lands on /expired-link with a working signup resend → log out returns to /login → signed-out /home revisit redirects to /login
- `pnpm build` green — the App Router Suspense/search-param gate passes (check-inbox and expired-link are static-with-Suspense; /auth/confirm and /home are dynamic)
- 21 new Vitest+RTL tests (92 total, all green): every screen asserts exactly one primary button via BOTH a source grep and an RTL role query (review LOW), signup asserts the three-field form + calm existing-email error, expired-link asserts the type=recovery vs signup method branch, home asserts the authenticated render AND the unauthenticated redirect('/login')
- Review-HIGH closed: /home explicitly redirects signed-out visitors to /login (T-02-27), making AUTH-06 assert a concrete behavior
- All four threat-register mitigations landed: role never sent from signup (T-02-13), getUser()-only /home (T-02-14), calm expired-link for burnt tokens (T-02-15), token_hash-only email template (T-02-16)

## Task Commits

Each task was committed atomically:

1. **Task 1: Signup + check-inbox screens (AUTH-01, AUTH-02)** - `c927af2` (feat)
2. **Task 2: /auth/confirm handler + expired-link screen (AUTH-02)** - `49af8bb` (feat)
3. **Task 3: /home + logout island + FISH-voice email (AUTH-05, AUTH-06)** - `46a364f` (feat)
4. **Deviation fix: monochrome email template** - `ca899f0` (fix)
5. **Task 4: [PHASE-GATE] manual walk** - no commit (human-verify checkpoint, approved by user)

## Files Created/Modified

- `apps/web/app/signup/page.tsx` - "use client" form; auth.signUp sends only display_name metadata (role hard-coded 'client' by the DB trigger); existing-email → calm Input error; generic failure → Alert tone=error; success → /check-inbox?email=
- `apps/web/app/check-inbox/page.tsx` - shared signup/unverified-login screen; Suspense-wrapped useSearchParams; auth.resend({type:'signup'}) with in-place Alert tone=notice
- `apps/web/app/expired-link/page.tsx` - type-aware resend (recovery → resetPasswordForEmail, else signup resend); email pre-filled; Alert stays notice (routing state, not failure)
- `apps/web/app/auth/confirm/route.ts` - GET handler: verifyOtp({type, token_hash}); success redirects to next (default /home); any failure redirects to /expired-link?type=signup|recovery(&email=)
- `apps/web/app/home/page.tsx` - Server Component; getUser() (never the cookie-trusting read); no user → redirect('/login'); else calm confirmation Card + LogoutButton
- `apps/web/components/auth/logout-button.tsx` - the only client code on /home; signOut() then router.push('/login'); no confirmation dialog
- `apps/web/app/{signup,check-inbox,expired-link,home}/page.test.tsx` - RTL tests per screen (one-primary via role query + grep, copy, mocked @/lib/supabase/client and next/navigation)
- `supabase/templates/confirmation.html` - FISH-voice, pure-monochrome verification email; single action link at {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email

## Decisions Made

- Sibling link on /signup is a plain `<Link>` (not a ghost Button) — zero competing button elements, and the RTL one-primary assertion stays strict.
- /home's one-primary grep gate is evaluated across page.tsx + logout-button.tsx combined, since the primary correctly lives in the composed island (the acceptance criterion's intent, adapted to the planned file split).
- Comments were reworded to avoid literal grep-gated strings ("getSession", "ConfirmationURL") while still documenting the pitfalls they warn against.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Design violation] Monochrome email template — removed stale lime accent**
- **Found during:** Task 4 checkpoint (user flagged before walking the flow)
- **Issue:** confirmation.html used lime #a3e635 (wordmark + action button), following AGENTS.md's lime guidance — but that guidance is STALE. The binding decisions (.claude/CLAUDE.md "Pure monochrome (black/white/greys)", STATE.md, Phase 1 globals.css token ladder — --color-primary is zero-chroma oklch in both themes) require zero chroma everywhere.
- **Fix:** Wordmark → #a1a1a1; action button → #fafafa background with #0a0a0a text (mirrors dark-theme primary: near-white surface, near-black text). Verified all six template hex values are pure greys and that no lime/raw hex exists in any app screen introduced by this plan.
- **Files modified:** supabase/templates/confirmation.html
- **Verification:** hex inventory all R=G=B; template gates re-run (token_hash, type=email, no ConfirmationURL); full suite 92/92
- **Committed in:** ca899f0 (fix commit)
- **Note for the project:** AGENTS.md still describes lime tokens (bg-primary "lime") — it should be updated to match the monochrome decision so future plans don't repeat this.

---

**Total deviations:** 1 auto-fixed (1 design-correctness, coordinator/user-directed)
**Impact on plan:** Copy/visual-level fix only; no scope creep, no behavior change.

## Issues Encountered

- **Worktree cwd trap in plan verify commands:** the plan's `<verify>` blocks say `cd /Users/franz/Work/Personal/fish/apps/web` — that path is the MAIN repo, not the worktree. Early test runs silently executed against the main repo (finding none of the new files). All commands were re-anchored to the worktree root; no work was lost (Write tool calls had used correct worktree-absolute paths throughout).
- **Grep-gate false positives from comments:** code comments warning "never getSession()" and "never {{ .ConfirmationURL }}" themselves matched the acceptance-criteria greps; reworded the comments rather than weakening the gates.
- `/login` does not exist yet (plan 05's deliverable, sibling wave) — logout and the signed-out /home redirect target it correctly; the user-approved walk accounted for the interim 404.

## Authentication Gates

None — the local stack from plan 02-01 was already running; verification accounts were created with unique timestamped emails to avoid colliding with the sibling executor's seed accounts.

## For the Orchestrator: Stack Restart Required Post-Merge

The shared local Supabase stack loaded `supabase/templates/confirmation.html` from the main repo checkout at stack start. This plan's rewritten (FISH-voice, monochrome) template only takes effect after this worktree merges AND the stack is restarted (`supabase stop && supabase start`) — forbidden mid-wave, so it was deferred. Until then, Mailpit renders the plan-01 placeholder copy (the link shape is identical, so the flow itself is unaffected). The user-approved walk verified the link mechanics live and the template content from the committed file.

## User Setup Required

None - no external service configuration required (local Supabase only, per D-13/D-14).

## Next Phase Readiness

- The signup loop is complete and user-verified: plan 05 (login, forgot/reset password) can compose the same idioms — the auth screen layout wrapper, Suspense pattern, and /auth/confirm already handle type=recovery and route its expired links correctly
- /home is the neutral authenticated landing (D-01); Phase 3 adds role redirects and full route protection on top of the existing getUser() + redirect foundation
- Untyped Supabase client factories (carried stub from 02-01/02-02) remain — screens in this plan don't need row types; wiring the Database generic stays open for whichever plan first reads typed rows

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Untyped Supabase client factories | apps/web/lib/supabase/{client,server}.ts | Carried from 02-01/02-02 — this plan's screens only call auth methods (no typed table reads); the Database generic wiring remains open |
| /login route missing | (plan 05) | Logout + signed-out redirect target /login per authRedirects; plan 05 (sibling wave) ships the screen |

## Self-Check: PASSED

- All 11 created/modified files verified present on disk (`[ -f ]`)
- All 4 commits found in `git log` (c927af2, 49af8bb, 46a364f, ca899f0)
- Plan-level verification re-run at close-out: 21/21 plan tests green (92/92 full suite), `pnpm typecheck` clean, `pnpm build` exits 0 (Suspense gate), no `.getSession(` in app/home or app/auth, confirmation.html uses token_hash + type=email and never the implicit-flow variable, zero chroma in the template
- Task 4 human-verify checkpoint approved by the user (full walk: AUTH-01/02/05/06 + D-06 + signed-out redirect)

---
*Phase: 02-secure-account-you-can-return-to*
*Completed: 2026-07-03*
