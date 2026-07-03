# Roadmap: FISH — Monochrome Foundations

**Created:** 2026-07-02
**Granularity:** coarse
**Mode:** mvp
**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

## Overview

This milestone builds the monochrome design system and the auth foundation everything else stands on. Three vertical slices, each delivering an end-to-end user-visible capability:

1. A monochrome design system you can see and interact with (demo page, both themes).
2. A secure account you can create and return to (sign up → verify → log in → log out, session persists, role enforced server-side).
3. A role-aware home that lands the right person in the right place (protected routing, calm empty states, coach sees only their assigned clients).

Sequencing honors research: tokens have zero upstream dependency and come first; the auth capability is backed by the database schema + RLS it needs to be real; the role-aware home slice depends on both the shell chrome and a populated, RLS-protected coach-client relationship.

## Phases

- [x] **Phase 1: Monochrome design system you can see** - Dual-theme monochrome tokens and a hardened UI kit, provable on a demo page in both light and dark (3/3 plans executed; verification 2026-07-02: 1 blocking gap — primary-button focus ring; gap-closure plan 01-04 created) (completed 2026-07-02)
- [x] **Phase 2: Secure account you can return to** - Full linear email/password auth loop backed by a hardened profiles + coach-client schema with server-enforced roles and RLS (executed 2026-07-03; UAT 2026-07-03: 1 blocking gap — verification email link 500 from a port/site_url mismatch, not a code bug; gap-closure plan 02-06 created)
- [ ] **Phase 3: Role-aware home** - App shell, protected routing, and calm role-specific landings — clients land on client home, coaches see only their assigned clients

## Phase Details

### Phase 1: Monochrome design system you can see

**Goal**: A person can open the UI kit demo page and see every base component, in every state, rendered in pure monochrome, correct in both light and dark, following their system preference with no flash of the wrong theme.
**Mode:** mvp
**Depends on**: Nothing (first phase; tokens have zero upstream dependency)
**Requirements**: TOKN-01, TOKN-02, TOKN-03, TOKN-04, TOKN-05, TOKN-06, KIT-01, KIT-02, KIT-03, KIT-04, KIT-05, KIT-06
**Success Criteria** (what must be TRUE):

  1. The demo page renders every UI kit component (Button, Input, Card, Progress) in every applicable state — default, hover, focus, disabled, loading, error — with nothing rendered in hue-based color, only black/white/grey.
  2. Toggling the system between light and dark switches the whole page cleanly, every token (including error, disabled, and focus states) resolves correctly in both, and the first paint on load never flashes the wrong theme.
  3. Body/UI text renders in Lexend and headings in Fraunces on the demo page, and every icon comes from Tabler with no other icon set present.
  4. Every interactive control is at least 56px tall, shows a visible keyboard focus state, suppresses non-essential motion under prefers-reduced-motion, and distinguishes notices from errors through weight, structure, and iconography rather than red.

**Plans**: 4 plans (3 executed + 1 gap-closure)

- [x] 01-01-PLAN.md — Monochrome light-dark() tokens, Vitest + WCAG contrast test, hardened Button, dev theme toggle, /kit slice
- [x] 01-02-PLAN.md — Input notice/error two-tier split + Card elevation + Progress, added to /kit
- [x] 01-03-PLAN.md — Alert (notice/error/success) + tokens/typography/icons sections + icon-source guard + phase visual verification
- [x] 01-04-PLAN.md — Gap closure: fix inverted primary-button focus ring + regression tripwire (KIT-05) + close WR-04 contrast-coverage gap

**UI hint**: yes

### Phase 2: Secure account you can return to

**Goal**: As a new client, I want to sign up, verify my email, log in, stay logged in across a browser restart, and log out, so that I can always return to an account where my data belongs only to me.
**Mode:** mvp
**Depends on**: Phase 1 (auth screens consume the hardened Input/Button states and calm error styling)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):

  1. A person can sign up with email and password, always as a client, and lands on a calm single-action "check your inbox" screen after a verification email is sent.
  2. A person can log in with email and password, stays logged in across a browser refresh and restart, and can log out from an authenticated screen; a "forgot password" email link lands them on a single-field "set new password" screen.
  3. Signing up reliably creates exactly one profile row (a failing trigger never silently blocks the signup), and a seed script creates a coach account and assigns clients to it.
  4. Role is stored and enforced server-side — an authenticated user cannot escalate themselves to coach — and RLS on every table lets a client read only their own data while a coach reads only their own assigned clients.

**Plans**: 7/7 plans complete

- [x] 02-01-PLAN.md — Supabase plumbing: local CLI/Docker prereq + pinned packages, three-client SSR factories (browser/server/proxy at apps/web root), proxy.ts session refresh, local [auth] config (keys verified vs generated schema), authRedirects.home
- [x] 02-02-PLAN.md — DB schema in 5 ordered migrations (profiles → trigger → coach_clients+role-integrity → is_coach_of helper+policies → role guard; helper created after the table it references), RLS via SECURITY DEFINER helper (caller-role-checked), safe-field UPDATE policy so the guard is exercised, schema push + types split into database.generated.ts
- [x] 02-03-PLAN.md — Idempotent (pagination-safe) TS admin seed (coach + 3 assigned clients), pnpm workflow scripts, scripted anon-session RLS/escalation verification (verify-rls.ts), D-14 deploy checklist
- [x] 02-04-PLAN.md — Signup loop: signup → check-inbox → /auth/confirm (verifyOtp) → /home (redirects signed-out visitors to /login) + logout, type-aware expired-link screen, Suspense-wrapped search-param screens, FISH-voice confirmation email
- [x] 02-05-PLAN.md — Return/recover loop: login (+ unverified→check-inbox), non-enumerating forgot-password, recovery via template-hardcoded next=/reset-password (Mailpit URL verified) → set-new-password → /home, FISH-voice recovery email
- [x] 02-06-PLAN.md — Gap closure (UAT test 3 blocker): pin the FISH web dev port (next dev -p 3001) and align supabase site_url + additional_redirect_urls to :3001 so the {{ .SiteURL }} email link hits FISH, not a foreign app on :3000; stack restart + fresh-signup re-verify
- [x] 02-07-PLAN.md — Gap closure (UAT test 7): reserve constant message-row height in the shared Input so a wrong-password message changes text not geometry (restores the phase-01 layout-stability contract on the flex-centered /login card), and wire the wrong-password copy to the tier-1 soft notice tone instead of the heavy tier-2 error treatment

### Phase 3: Role-aware home

**Goal**: After logging in, a person lands inside a calm app shell on the home that matches their role — a client on the client home, a coach on the coach home listing only their assigned clients — with signed-out users always redirected to login and empty states that guide rather than alarm.
**Mode:** mvp
**Depends on**: Phase 2 (needs a real session, server-enforced role, and the RLS-protected coach-client relationship to land into and read from)
**Requirements**: ROUT-01, ROUT-02, ROUT-03, ROUT-04, SHEL-01, SHEL-02
**Success Criteria** (what must be TRUE):

  1. A signed-out person hitting any protected route is redirected to login; after login a client lands on the client home and a coach lands on the coach home.
  2. The coach home lists that coach's assigned (seeded) clients and only theirs; no coach sees another coach's clients.
  3. Authenticated screens are wrapped by an app shell (navigation + page layout) that shows at most one primary action per screen.
  4. A client home before assignment and a coach home with zero clients both show calm, guiding empty states — never alarming "no data" language.

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monochrome design system you can see | 4/4 | Complete   | 2026-07-02 |
| 2. Secure account you can return to | 7/7 | Complete   | 2026-07-03 |
| 3. Role-aware home | 0/? | Not started | - |

## Coverage

All 28 v1 requirements mapped to exactly one phase. No orphans, no duplicates.

| Category | Requirements | Phase |
|----------|--------------|-------|
| Design Tokens & Theming | TOKN-01..06 (6) | Phase 1 |
| UI Kit | KIT-01..06 (6) | Phase 1 |
| Authentication | AUTH-01..06 (6) | Phase 2 |
| Database Foundation | DB-01..04 (4) | Phase 2 |
| App Shell | SHEL-01..02 (2) | Phase 3 |
| Routing & Roles | ROUT-01..04 (4) | Phase 3 |

**Note:** The v1 requirement set contains 28 requirements (TOKN 6 + KIT 6 + SHEL 2 + AUTH 6 + DB 4 + ROUT 4). Some initialization inputs cited "24" — that count is inaccurate against the actual REQUIREMENTS.md contents. All 28 are mapped here; the traceability table and coverage count in REQUIREMENTS.md have been corrected to 28.

---
*Roadmap created: 2026-07-02*
