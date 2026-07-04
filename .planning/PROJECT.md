# FISH

## What This Is

FISH is a ChatHub that teaches English to neurodivergent professionals, many with ADHD. Coaches assign everything; clients are never given menus or choices — the product's whole job is to remove choices, not add them. This milestone builds the monochrome design system and the auth foundation everything else stands on.

## Core Value

A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

## Business Context

- **Customer**: Neurodivergent professionals (many with ADHD) learning English; coaches deliver the service
- **Revenue model**: Coaching-led service (not yet monetized in-app)
- **Success metric**: Clients keep returning — no abandonment triggers (broken streaks, scolding copy, choice overload)
- **Strategy notes**: Coach-first, code-second — no learning feature is built until a coach has validated the technique manually (see AGENTS.md)

## Requirements

### Validated

<!-- Inferred from existing code -->

- ✓ pnpm monorepo scaffold (apps/web Next.js + App Router, packages/core, packages/supabase, supabase/) — existing
- ✓ Base UI kit: Button, Input, Card, Progress in `apps/web/components/ui/` — existing
- ✓ Design tokens via Tailwind v4 `@theme` in `apps/web/app/globals.css` — existing
- ✓ Shared type contracts: roles + chat limits in `packages/core`, auth/database types in `packages/supabase` — existing
- ✓ Supabase Edge Function stub for send-message (validation only, no persistence) — existing
- ✓ Pure monochrome token set — black/white/greys only via `light-dark()`, WCAG-contrast-tested — Validated in Phase 1: Monochrome design system you can see
- ✓ Light and dark monochrome themes from day one — both schemes resolve from one token ladder, no first-paint flash — Validated in Phase 1
- ✓ UI kit hardened: Button/Input/Card/Progress states (disabled, loading, error), visible two-tone focus ring (regression-tripwired), reduced motion — Validated in Phase 1
- ✓ UI kit expanded for upcoming screens: Alert (notice/error/success), theme toggle; Tabler-only icon guard — Validated in Phase 1
- ✓ UI kit demo page (`/kit`) showing every component in every state, both themes — the contract for future screens — Validated in Phase 1
- ✓ Email/password auth loop: sign up → verify → log in → log out, password reset, session persists across refresh and restart (token_hash/verifyOtp; getUser server-side) — Validated in Phase 2: Secure account you can return to
- ✓ Client/coach roles enforced server-side; signup always creates clients, role self-escalation rejected by DB guard — Validated in Phase 2
- ✓ Database foundation: hardened `handle_new_user` trigger, `profiles` + `coach_clients` schema, recursion-safe RLS via SECURITY DEFINER helper, seed + scripted anon-session RLS verification — Validated in Phase 2
- ✓ App shell and layout: calm authenticated chrome (logo, display name, ghost logout — zero primary actions in the shell) — Validated in Phase 3: Role-aware home
- ✓ Protected routing: signed-out → login; client → /home, coach → /coach wrong-door guards; signed-in users silently redirected off /login and /signup (server-side, no form flash) — Validated in Phase 3
- ✓ Role-aware landing screens: client home greets by first name and names the real assigned coach; calm assigned-state empty state — Validated in Phase 3
- ✓ Coach home lists the coach's assigned clients (seeded), alphabetical with quiet emails, rows inert — Validated in Phase 3

### Active

- [ ] Token pipeline formalized so native iOS/Android can mirror tokens later (hand-written CSS kept for this milestone; THEM-02 is v2)

### Out of Scope

- Color palette / brand colors — hierarchy before color; if the UI works in monochrome, the structure is right; color is a deliberate later layer
- Coach signup UI — coach accounts are created manually (seed/dashboard) for v1; open role pickers would let anyone claim coach powers
- Assignment UI — coach→client assignment happens via seed/dashboard this milestone; the relationship schema and coach view make it real, the UI comes later
- 1-on-1 chat — next foundation after auth per the build order; Edge Function stub stays a stub this milestone
- Onboarding assessment, tracker engine — later build-order items; not started until auth foundation exists
- Community feed, gamification, streaks — explicitly barred until foundations are done and techniques are coach-validated (AGENTS.md)
- Native iOS/Android implementation — web-first; native clients mirror tokens later

## Context

- Brownfield: `.planning/codebase/` maps the current state. Key findings: no Supabase client integrated anywhere, no `supabase/migrations/` (database doesn't exist), no auth layer, Edge Function is a pass-through stub, no tests.
- Web stack: Next.js 16.2.9, React 19.2.7, Tailwind CSS v4.3.1 (CSS-first `@theme` — **never** create `tailwind.config.js`; keep `tailwindcss` and `@tailwindcss/postcss` on the same version).
- Design rules (non-negotiable, AGENTS.md): one primary action per screen; assigned never chosen; min 56px tap targets; progress visual never a grade; reward-only gamification; copy never scolds (soft notice, never alarming red — structural UI stays monochrome; alerts are the one deliberate exception, using calm desaturated tone colors per the 02-08 user decision).
- API boundary: direct Supabase reads under RLS; Edge Functions for command-style writes (messages, assignments, moderation).
- `apps/ios` is empty; `apps/android` is a Gradle skeleton. Both wait.
- **Current state (2026-07-04):** Milestone "Monochrome Foundations" is functionally complete — all 3 phases done. Phase 3 shipped the authenticated app shell, protected role-aware routing (client → /home, coach → /coach, wrong-door guards, signed-in auth-page redirects via shared `redirectIfSignedIn` server guard), the client home (first-name greeting + real coach name), and the coach home (assigned clients, alphabetical, inert rows). Phase 3 UAT: 3/3 passed in a live browser with zero console errors; `pnpm verify:rls` at 8/8. Note: `AGENTS.md`'s design-token section still describes the pre-monochrome lime accent — a follow-up docs pass is flagged.

## Constraints

- **Tech stack**: Next.js App Router + TypeScript + Tailwind v4 (CSS-first) + Supabase — locked by AGENTS.md; no Express/Node API service
- **Design**: Pure monochrome (black/white/greys), both light and dark themes — user decision, hierarchy before color
- **Iconography**: Tabler Icons (https://tabler.io/icons) — single icon set, consistent stroke style
- **Typography**: Lexend (body/UI — designed for reading fluency, fits the neurodivergent audience) + Fraunces (headings/display serif)
- **Product**: Coach-first, code-second — no learning features without manual coach validation
- **Security**: Signup can only create clients; coach role granted manually; every table gets RLS
- **Package manager**: pnpm only (lockfile is pnpm-lock.yaml)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pure monochrome first, no color tokens | If the UI works in monochrome, the hierarchy is right; color is a later deliberate layer | ✓ Good — Phase 1 shipped the full kit in monochrome, contrast-tested |
| Light + dark themes from day one | Tokens must support both schemes; retrofitting a second theme is costlier | ✓ Good — one `light-dark()` ladder drives both themes, verified in Phase 1 |
| Coach accounts are seed-only | Open "I'm a coach" pickers let anyone claim coach powers | — Pending |
| Assignment is seed-only this milestone | Schema + RLS + coach view make the relationship real; UI deferred to shrink scope | — Pending |
| Signup always creates clients | Simplest safe default; role escalation is a manual act | — Pending |
| Tabler Icons as the only icon set | One consistent stroke style; no mixed icon sources | ✓ Good — enforced by an icon-source test since Phase 1 |
| Lexend (body) + Fraunces (display) | Lexend is designed for reading fluency — right for the ADHD audience; Fraunces provides warm heading contrast | ✓ Good — loaded and demonstrated on `/kit` in Phase 1 |
| Alerts get calm semantic tone colors (coral/amber/green) and float above the card as a fading overlay | User decision at 02-08 UAT: honest feedback colors beat monochrome-only for alerts; overlay keeps the centered card from ever moving | ✓ Good — tokens are low-chroma, contrast-test gated; structural UI stays monochrome |
| Authenticated shell carries zero primary actions (Logout is ghost) | The shell must never compete with page content — widens the "at most one primary per view" rule | ✓ Good — Phase 3 shell ships with no primary button |
| Each protected page re-checks role server-side (getUser + profiles.role) | Server Components re-execute per navigation; the shared layout can't know which leaf route it wraps | ✓ Good — wrong-door guards verified live in Phase 3 UAT |
| RLS is the sole authorization boundary for reads (no manual id filtering) | Direct Supabase reads under RLS per AGENTS.md; policies (`is_coach_of`/`is_client_of`) carry the whole burden | ✓ Good — `pnpm verify:rls` passes 8/8 live assertions |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-04 after Phase 3 completion*
