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

### Active

- [ ] Pure monochrome token set — black/white/greys only; all color tokens (lime primary, pink/yellow accents) removed
- [ ] Light and dark monochrome themes from day one — tokens support both schemes
- [ ] Existing UI kit hardened: states (disabled, loading, error), accessibility, focus, reduced motion
- [ ] UI kit expanded with the base components upcoming screens need (respecting 56px tap targets, one primary action per screen)
- [ ] Token pipeline formalized so native iOS/Android can mirror tokens later
- [ ] App shell and layout: nav, page structure, empty states — calm, one-action-per-screen chrome
- [ ] UI kit demo page showing every component in every state, both themes — the contract for future screens
- [ ] Email/password auth: sign up, log in, log out, email verification, password reset, session persists across refresh
- [ ] Client/coach roles wired to `packages/core` contracts; signup always creates clients
- [ ] Database foundation: Supabase migrations (profiles, coach-client relationship), RLS policies enforcing coach/client boundaries
- [ ] Protected routing: middleware redirects — signed-out → login, client → client home, coach → coach home
- [ ] Role-aware landing screens (near-empty calm placeholders are fine)
- [ ] Coach home shows the coach's assigned clients (assignments seeded manually)

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
- Design rules (non-negotiable, AGENTS.md): one primary action per screen; assigned never chosen; min 56px tap targets; progress visual never a grade; reward-only gamification; copy never scolds (soft notice, never alarming red — in pure monochrome, notices distinguish by weight/structure, not hue).
- API boundary: direct Supabase reads under RLS; Edge Functions for command-style writes (messages, assignments, moderation).
- `apps/ios` is empty; `apps/android` is a Gradle skeleton. Both wait.

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
| Pure monochrome first, no color tokens | If the UI works in monochrome, the hierarchy is right; color is a later deliberate layer | — Pending |
| Light + dark themes from day one | Tokens must support both schemes; retrofitting a second theme is costlier | — Pending |
| Coach accounts are seed-only | Open "I'm a coach" pickers let anyone claim coach powers | — Pending |
| Assignment is seed-only this milestone | Schema + RLS + coach view make the relationship real; UI deferred to shrink scope | — Pending |
| Signup always creates clients | Simplest safe default; role escalation is a manual act | — Pending |
| Tabler Icons as the only icon set | One consistent stroke style; no mixed icon sources | — Pending |
| Lexend (body) + Fraunces (display) | Lexend is designed for reading fluency — right for the ADHD audience; Fraunces provides warm heading contrast | — Pending |

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
*Last updated: 2026-07-02 after initialization*
