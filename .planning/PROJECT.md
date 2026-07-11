# FISH

## What This Is

FISH is a ChatHub that teaches English to neurodivergent professionals, many with ADHD. Coaches assign everything; clients are never given menus or choices — the product's whole job is to remove choices, not add them. Three shipped milestones stand under it: v1.0 (2026-07-04) delivered the monochrome design system, the email/password auth loop on an RLS-protected schema, and role-aware routing; v1.1 (2026-07-06) added safe client profiles and real persisted chat on an idempotent `send-message` Edge Function; v1.2 (2026-07-11) made chat state a portable, test-vector-backed contract (`@fish/core/chat-state` + web-only Zustand adapter + Android/iOS protocol docs) with bounded, calm message loading on the canonical community room at `/channels/:id`.

## Current State

**Shipped:**
- v1.0 Monochrome Foundations (2026-07-04) — 3 phases, 16 plans, 28/28 requirements, verified closeout (audit passed).
- v1.1 The Coaching Loop Foundation (2026-07-06) — Phases 4, 7, 8; profiles + real persistent chat. Closed informally during the 2026-07-06 re-scope (no separate archive; its requirements are archived inside `milestones/v1.2-REQUIREMENTS.md`).
- v1.2 Cross-platform Chat State Foundation (2026-07-11) — Phases 9–10, 26 plans, 12/12 requirements, audit passed (`milestones/v1.2-MILESTONE-AUDIT.md`); override closeout with 6 stale artifacts acknowledged as deferred (STATE.md Deferred Items). Phase 9 security review verified, 0 open threats. `/channels/:id` is the canonical community chat surface (the 1-on-1 `/chat` route was removed 2026-07-10).

What works today:
- Monochrome design system: `light-dark()` oklch token ladder, WCAG-AA contrast-tested, five kit components (Button, Input, Card, Progress, Alert), `/kit` demo page as the visual contract in both themes.
- Full auth loop: signup (always client) → verification email → login → persistent session → logout → password recovery; all screens Enter-submittable, calm non-enumerating copy.
- Database foundation: hardened `handle_new_user` trigger, `profiles` + `coach_clients` + `client_profiles` + chat schema, recursion-safe RLS (`is_coach_of`/`is_client_of`), server-enforced roles, DB-frozen protected fields, idempotent seed + `pnpm verify:rls` live assertions.
- Role-aware routing: default-deny `(authenticated)` guard, pure-redirect root, wrong-door guards, `redirectIfSignedIn` on auth pages, AppShell with zero primary actions, calm empty states.
- Client profiles: safe-edit `/profile` (Server Action), instant-apply accessibility prefs, consent fields, read-only coach detail at `/coach/clients/[id]`.
- Community chat at `/channels/:id`: persisted idempotent sends with an optimistic lifecycle and draft-safe failure recovery, realtime in-place merges (no duplicates, no layout shift), presence/typing, bounded 40+1 newest window on open, cursor-based load-earlier with infinite scroll and preserved reading position, identity-safe store purge on sign-out/identity change.
- Portable chat-state contract: platform-neutral reducer/selectors in `@fish/core/chat-state`, 17 JSON fixture vectors, protocol docs + Android/iOS native architecture notes.

Known tech debt (non-blocking): from the v1.0 audit — Input lacks `aria-describedby`/`aria-invalid`; two hardcoded `/home` redirects bypass `authRedirects`; icon-guard regex breadth; tailwind caret-range pinning; stale dev seed password for client1. From the v1.2 audit — docs/intel codebase maps lag the code (refresh via `/gsd-map-codebase`); vite@8 wants `@types/node` >= 22.12.0 (installed 22.10.7, warning only). Full lists: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`, `.planning/milestones/v1.2-MILESTONE-AUDIT.md`.

## Next Milestone Goals

Not yet defined — run `/gsd-new-milestone` (questioning → research → requirements → roadmap). Standing candidates from the deferred list:
- Native Android/iOS chat implementations against the shipped `@fish/core/chat-state` contract (fixture-vector parity)
- Assignment UI (coach→client assignment is still seed/manual-only)
- Privacy tooling (consent flows, export, delete, retention) — precedes public launch
- Coach-validated learning techniques (coach-first rule; nothing built until validated manually)

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
- ✓ Client profiles: safe-edit client flow with DB-frozen protected fields, accessibility prefs, consent fields, and read-only coach detail view — v1.1 (Phase 4, PROF-01..06)
- ✓ Real persisted chat: idempotent `send-message` Edge Function, live web chat route, optimistic send lifecycle with draft preservation and calm invalid-message guidance — v1.1 (Phase 8, CHAT-02/03/05/07, XC-04)
- ✓ Portable chat-state contract: platform-neutral reducer/selectors in `@fish/core/chat-state` with 17 JSON fixture vectors, web-only Zustand adapter (never source of truth), identity-safe store purge, and Android/iOS protocol docs — v1.2 (Phase 9, CSTATE-01..06)
- ✓ Bounded chat message loading: 40-message newest window on open, cursor-based older-history pagination with reading position preserved, in-place realtime merges with no duplicates or layout shift, and coalesced bounded reconnect recovery with stale-callback revocation — v1.2 (Phase 10, CLOAD-01..06)

### Active

(None — the next milestone defines fresh requirements via `/gsd-new-milestone`.)

### Out of Scope

Durable exclusions:
- Color palette / brand colors — hierarchy before color; if the UI works in monochrome, the structure is right; color is a deliberate later layer
- Coach signup UI — coach accounts are created manually (seed/dashboard); open role pickers would let anyone claim coach powers
- Gamification and streaks — explicitly barred until techniques are coach-validated; a resetting streak is never allowed (AGENTS.md). *Note: a community chat room (`/channels/:id`) shipped in v1.2 as the canonical chat surface — that is a chat channel, not the gamified community feed this exclusion covers.*

Deferred (in the build order, just not scheduled):
- Native iOS/Android client implementations — the v1.2 event/result contract and native architecture notes anticipate them; production native code is a future milestone
- AI-assisted coaching (AI replies, grammar/vocabulary/pronunciation pipelines, memory, personalization) — build the human chat foundation first; AI waits for coach-validated techniques
- Assignment UI — coach→client assignment stays seed/manual-only; the relationship schema already carries chat and profiles
- Full privacy tooling (consent flows, export, delete, retention, audit logging) — consent *fields* shipped on the profile in v1.1; the privacy milestone precedes public launch
- Validated learning content/templates — learning mechanics await coach validation (coach-first rule)

## Context

- Web stack: Next.js 16.2.9, React 19.2.7, Tailwind CSS v4.3.1 (CSS-first `@theme` — **never** create `tailwind.config.js`; keep `tailwindcss` and `@tailwindcss/postcss` on the same version).
- Design rules (non-negotiable, AGENTS.md): one primary action per screen; assigned never chosen; min 56px tap targets; progress visual never a grade; reward-only gamification; copy never scolds (soft notice, never alarming red — structural UI stays monochrome; alerts are the one deliberate exception, using calm desaturated tone colors per the 02-08 user decision).
- API boundary: direct Supabase reads under RLS; Edge Functions for command-style writes (messages, assignments, moderation).
- **Current state (2026-07-11):** v1.2 shipped. Chat state lives in `@fish/core/chat-state` (portable reducer + 17 fixture vectors) with a web-only Zustand adapter; the canonical chat surface is the community room at `/channels/:id` (the 1-on-1 `/chat` route was removed 2026-07-10, with dated supersede notes on CSTATE-02/06 and D-09). Message loading is bounded (40+1 keyset SSR window, cursor-based load-earlier, coalesced reconnect backfill). The product is web-only; Android/iOS get the same event contract for future native implementations. The unvalidated learning-flow implementations remain removed.

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
| Realtime lifecycle callbacks are revoked per effect (`active` flag) so a removed conversation's queued callbacks are inert | Async channel removal leaves stale callbacks callable; guarding entry (not just promise exit) is the only way to protect the active conversation's reconnect state | ✓ Good — CR-01 closed at c404b0cd; regression proves stale A callbacks can't corrupt B's first-subscribe slots or recovery lock |
| Chat state is a portable reducer in `@fish/core` with JSON fixture vectors as the cross-platform contract | Android/iOS must implement identical behavior natively; replayable vectors make parity testable instead of aspirational | ✓ Good — 17 vectors, dependency-boundary tests reject React/Zustand/Supabase imports in the core |
| Zustand is the web React adapter only, never the source of truth | State rules must stay portable; a web store that owns logic can't be reimplemented natively | ✓ Good — store actions dispatch `ChatEvent` through the one portable reducer; authority exclusions are tested |
| Community room `/channels/:id` is the canonical chat surface; the 1-on-1 `/chat` route was removed (supersedes D-09) | The shipped, verified surface is the community room; keeping a dead route made verification measure the wrong thing | ✓ Good — dated supersede notes on CSTATE-02/06; e2e smoke repointed; re-verification passed against the real surface |
| Conversation open reads a bounded 40+1 keyset window; older history is cursor-paged | Near-instant open with no unbounded fetches; the +1 sentinel answers "is there more" without a count query | ✓ Good — CLOAD-01..06 verified; reconnect backfill bounded and conversation-owned |
| Chat cache binds to a verified auth identity fingerprint and purges on any identity change | A module-singleton store outlives sign-out; only identity-keyed purging prevents cross-account leaks | ✓ Good — CR-01 leak closed; covers non-button account switch, sign-out, and cross-tab expiry |
| Failed older-page loads stop after exactly one automatic retry, then a calm manual affordance | Unbounded auto-retry is a silent storm; the failure flag must commit atomically with the loading flag in the reducer | ✓ Good — store-backed `hasLoadError`; browser-faithful IntersectionObserver regression proves single-fire |

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
*Last updated: 2026-07-11 after v1.2 milestone*
