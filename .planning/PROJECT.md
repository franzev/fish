# FISH

## What This Is

FISH is a ChatHub that teaches English to neurodivergent professionals, many with ADHD. Coaches assign everything; clients are never given menus or choices — the product's whole job is to remove choices, not add them. v1.0 (shipped 2026-07-04) delivered the monochrome design system and the auth foundation everything else stands on: a dual-theme token ladder and UI kit, a complete email/password auth loop on an RLS-protected schema, and role-aware routing into calm client/coach homes.

## Current State

**Shipped:** v1.0 Monochrome Foundations (2026-07-04) — 3 phases, 16 plans, 28/28 requirements, verified closeout (audit passed).

What works today:
- Monochrome design system: `light-dark()` oklch token ladder, WCAG-AA contrast-tested, five kit components (Button, Input, Card, Progress, Alert), `/kit` demo page as the visual contract in both themes.
- Full auth loop: signup (always client) → verification email → login → persistent session → logout → password recovery; all screens Enter-submittable, calm non-enumerating copy.
- Database foundation: hardened `handle_new_user` trigger, `profiles` + `coach_clients`, recursion-safe RLS (`is_coach_of`/`is_client_of`), server-enforced roles, idempotent seed + `pnpm verify:rls` (8/8 live assertions).
- Role-aware routing: default-deny `(authenticated)` guard, pure-redirect root, wrong-door guards, `redirectIfSignedIn` on auth pages, AppShell with zero primary actions, calm empty states.
- Quality floor: 173/173 tests, clean build/typecheck/lint, focus-ring regression tripwire, chroma/contrast gates.

Known tech debt (non-blocking, from the v1.0 audit): Input lacks `aria-describedby`/`aria-invalid`; two hardcoded `/home` redirects bypass `authRedirects`; icon-guard regex breadth; tailwind version pinning via caret ranges; stale dev seed password for client1 (environment drift). Full list: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`.

## Current Milestone: v1.1 The Coaching Loop

**Goal:** Turn FISH from an auth-and-role shell into a working coaching product — a coach can profile a client, run them through a data-driven onboarding, assign a config-driven tracker, and hold a real persistent 1-on-1 conversation; the client experiences all of it as calm, assigned, choice-free screens.

**Target features (all four remaining foundations, each with client *and* coach views):**
- **Client profiles** (build order #2) — profile domain schema (goals, role context, level, locale/timezone, accessibility prefs, consent metadata), client read/edit flow, coach client-detail view
- **Data-driven onboarding** (build order #3) — versioned DB question-bank (never hard-coded), response storage + resume, one-question-at-a-time renderer, coach review of answers
- **Tracker engine** (build order #4) — config + versioning schema, assignment via seed/Edge Function (assigned-never-chosen), client renderer from config, coach entry review
- **Real 1-on-1 chat** (build order #5) — conversation/message schema + RLS, a real `send-message` Edge Function replacing the stub (idempotent, calm errors), web chat route on live data (persistent send/read), coach reads the same thread

**Scope boundaries (this milestone):**
- Persistent chat send/read only — realtime/presence/typing deferred to the next milestone
- Human coach↔client chat only — no AI replies or learning pipelines (AGENTS.md coach-first + build order)
- Assignment stays seed-only — everything reads the existing seeded coach↔client relationship; no assignment UI
- Engines, not validated content — build the onboarding renderer and config-driven tracker engine; specific questions/templates are minimal seed config, not coach-validated techniques

Also flagged (carried, non-blocking): an AGENTS.md docs pass — its design-token section still describes the pre-monochrome lime accent.

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
- ✓ Pure monochrome token set — black/white/greys only via `light-dark()`, WCAG-contrast-tested — v1.0 (Phase 1)
- ✓ Light and dark monochrome themes from day one — both schemes resolve from one token ladder, no first-paint flash — v1.0 (Phase 1)
- ✓ UI kit hardened: Button/Input/Card/Progress states (disabled, loading, error), visible two-tone focus ring (regression-tripwired), reduced motion — v1.0 (Phase 1)
- ✓ UI kit expanded for upcoming screens: Alert (notice/error/success), theme toggle; Tabler-only icon guard — v1.0 (Phase 1)
- ✓ UI kit demo page (`/kit`) showing every component in every state, both themes — the contract for future screens — v1.0 (Phase 1)
- ✓ Email/password auth loop: sign up → verify → log in → log out, password reset, session persists across refresh and restart (token_hash/verifyOtp; getUser server-side) — v1.0 (Phase 2)
- ✓ Client/coach roles enforced server-side; signup always creates clients, role self-escalation rejected by DB guard — v1.0 (Phase 2)
- ✓ Database foundation: hardened `handle_new_user` trigger, `profiles` + `coach_clients` schema, recursion-safe RLS via SECURITY DEFINER helper, seed + scripted anon-session RLS verification — v1.0 (Phase 2)
- ✓ App shell and layout: calm authenticated chrome (logo, display name, ghost logout — zero primary actions in the shell) — v1.0 (Phase 3)
- ✓ Protected routing: signed-out → login; client → /home, coach → /coach wrong-door guards; signed-in users silently redirected off /login and /signup (server-side, no form flash) — v1.0 (Phase 3)
- ✓ Role-aware landing screens: client home greets by first name and names the real assigned coach; calm assigned-state empty state — v1.0 (Phase 3)
- ✓ Coach home lists the coach's assigned clients (seeded), alphabetical with quiet emails, rows inert — v1.0 (Phase 3)
- ✓ Chat data boundary: one assigned coach-client conversation, member-scoped RLS reads, RPC-only idempotent sends, immutable messages, read-state ownership, seeded conversations, and generated Supabase chat row aliases — v1.1 (Phase 7)

### Active

v1.1 The Coaching Loop — scoped and committed (full requirements with REQ-IDs: `.planning/REQUIREMENTS.md`):

- [ ] Client profiles — profile domain schema, client read/edit flow, coach client-detail view (build order #2)
- [ ] Data-driven onboarding — versioned DB question-bank, response storage + resume, one-at-a-time renderer, coach review (build order #3)
- [ ] Tracker engine — config/versioning schema, seed/Edge-Function assignment, client renderer, coach entry review (build order #4)
- [ ] Real 1-on-1 chat route — real send-message Edge Function, web chat route on live data, optimistic send lifecycle, draft preservation, calm invalid-message guidance, and coach/client thread read (build order #5; Phase 7 schema is validated)

Carried (not owned by a v1.1 phase unless one adopts it):
- [ ] AGENTS.md docs pass — design-token section still describes the pre-monochrome lime accent
- [ ] Token pipeline formalized so native iOS/Android can mirror tokens later (hand-written CSS kept for now; THEM-02 trigger: native builds actually begin)

### Out of Scope

Durable exclusions:
- Color palette / brand colors — hierarchy before color; if the UI works in monochrome, the structure is right; color is a deliberate later layer
- Coach signup UI — coach accounts are created manually (seed/dashboard); open role pickers would let anyone claim coach powers
- Community feed, gamification, streaks — explicitly barred until foundations are done and techniques are coach-validated (AGENTS.md)
- Native iOS/Android implementation — web-first; native clients mirror tokens later

Deferred past v1.1 (in the build order, just not this milestone):
- Realtime chat (presence, typing, read-state, live updates) — v1.1 ships persistent send/read; realtime is the next chat layer
- AI-assisted coaching (AI replies, grammar/vocabulary/pronunciation pipelines, memory, personalization) — build the human chat foundation first; AI waits for coach-validated techniques
- Assignment UI — coach→client assignment stays seed-only in v1.1; the relationship schema already carries chat, profiles, and trackers
- Full privacy tooling (consent flows, export, delete, retention, audit logging) — v1.1 captures consent *fields* on the profile; the privacy milestone precedes public launch
- Validated learning content/templates — v1.1 builds the engines with minimal seed config; specific onboarding questions and tracker templates await coach validation (coach-first rule)

## Context

- Brownfield: `.planning/codebase/` maps the current state. Key findings: no Supabase client integrated anywhere, no `supabase/migrations/` (database doesn't exist), no auth layer, Edge Function is a pass-through stub, no tests.
- Web stack: Next.js 16.2.9, React 19.2.7, Tailwind CSS v4.3.1 (CSS-first `@theme` — **never** create `tailwind.config.js`; keep `tailwindcss` and `@tailwindcss/postcss` on the same version).
- Design rules (non-negotiable, AGENTS.md): one primary action per screen; assigned never chosen; min 56px tap targets; progress visual never a grade; reward-only gamification; copy never scolds (soft notice, never alarming red — structural UI stays monochrome; alerts are the one deliberate exception, using calm desaturated tone colors per the 02-08 user decision).
- API boundary: direct Supabase reads under RLS; Edge Functions for command-style writes (messages, assignments, moderation).
- `apps/ios` is empty; `apps/android` is a Gradle skeleton. Both wait.
- **Current state (2026-07-04):** v1.0 Monochrome Foundations shipped and archived (see `## Current State` above). ~5.0k LOC product code (TS/TSX/SQL/CSS), 173 tests, local Supabase stack (CLI + Docker, Mailpit for email). Planning artifacts archived under `.planning/milestones/`. `AGENTS.md`'s design-token section still describes the pre-monochrome lime accent — docs pass flagged in Active. An Android static Compose preview of the auth screens exists as a quick-task spike (uncommitted working-tree changes under `apps/android/`); native work otherwise waits.

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
| Coach accounts are seed-only | Open "I'm a coach" pickers let anyone claim coach powers | ✓ Good — v1.0 shipped with seed-only coach creation; COAC-01/02 triggers defined for when volume demands in-app flows |
| Assignment is seed-only this milestone | Schema + RLS + coach view make the relationship real; UI deferred to shrink scope | ✓ Good — coach home reads the seeded relationship through RLS alone; no assignment UI was missed in UAT |
| Signup always creates clients | Simplest safe default; role escalation is a manual act | ✓ Good — enforced by hardcoded trigger + DB self-escalation guard, proven live (verify-rls 8/8) |
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
*Last updated: 2026-07-05 after completing Phase 7 chat schema*
