---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: The Coaching Loop
status: executing
stopped_at: Phase 5 Plan 02 ready to execute
last_updated: "2026-07-05T03:14:39.395Z"
last_activity: 2026-07-05
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 7
  completed_plans: 4
  percent: 20
---

# Project State: FISH

**Last updated:** 2026-07-05

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04 after v1.0 milestone)

- **Core value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.
- **Shipped:** v1.0 Monochrome Foundations (2026-07-04) — design system + auth foundation + role-aware home; verified closeout, 28/28 requirements
- **Current focus:** Phase 05 — data-driven-onboarding

## Current Position

Phase: 05 (data-driven-onboarding) — EXECUTING
Plan: 2 of 4
Status: Executing Phase 05
Last activity: 2026-07-05 -- Phase 05 Plan 01 completed; Plan 02 ready to execute

Progress: [██░░░░░░░░] 20%

## Milestone v1.1 Phases

Dependency chain: profiles → onboarding → tracker → chat-schema → chat-route. Granularity: coarse. Chat split (7/8) is pitfall-driven (isolates the top data-leak + idempotency + integrity surface), not padding.

| Phase | Name | Depends on | Requirements | Status |
|-------|------|------------|--------------|--------|
| 4 | Client Profiles | v1.0 | PROF-01..06 | Complete |
| 5 | Data-Driven Onboarding (build shared renderer) | Phase 4 | ONBD-01..07 | Ready to plan |
| 6 | Tracker Engine (reuse renderer) | Phase 5, Phase 4 | TRAK-01..06 | Not started |
| 7 | Chat Schema (realtime-ready, no subscriptions/UI) | v1.0 (parallelizable) | CHAT-01, CHAT-04, CHAT-06 | Not started |
| 8 | Real Chat Route + send-message Edge Function | Phase 7, Phase 5, Phase 6 | CHAT-02/03/05/07, XC-04 | Not started |

Cross-cutting XC-01 (RLS + verify:rls gate) / XC-02 (zod + pg_jsonschema) / XC-03 (ND design line + sketch-findings-fish) are woven into every phase's success criteria they touch.

## Archived Milestones

| Version | Name | Shipped | Archive |
|---------|------|---------|---------|
| v1.0 | Monochrome Foundations | 2026-07-04 | milestones/v1.0-ROADMAP.md · v1.0-REQUIREMENTS.md · v1.0-MILESTONE-AUDIT.md · v1.0-phases/ |

## Accumulated Context

### Decisions

Milestone-scoped decision log archived with v1.0 (see PROJECT.md Key Decisions for outcomes and `milestones/v1.0-phases/` for full execution decisions). Durable conventions carried forward:

- Layout-stability contract: no control changes size on state change (overlay spinners, reserved message rows, out-of-flow notices).
- Every auth screen: `<form onSubmit>` + `type="submit"` — Enter always submits.
- RLS is the sole authorization boundary for reads; `authRedirects` is the single redirect source of truth.
- Alert tones are the one scoped color exception (low-chroma, contrast-gated); structural UI stays chroma-0.
- Theme work must be verified against served/compiled CSS (Lightning CSS `light-dark()` polyfill), never authored CSS alone.
- Dev origin must match the browser exactly: `localhost:3001` (host-scoped cookies), pinned via `next dev -p 3001` + supabase `site_url`.
- [Phase 04]: Followed RESEARCH Pattern 1 DDL verbatim for the level freeze — column-scoped GRANT UPDATE (level never named) + independent BEFORE-UPDATE trigger mirroring 0005's shape
- [Phase 04]: Auto-provision client_profiles via a separate AFTER INSERT ON profiles trigger — RESEARCH Pattern 3 Option B — keeps the hardened handle_new_user (0002) untouched
- [Phase 04-02]: The repo's first Server Action (updateProfileAction) uses useActionState + uncontrolled defaultValue; re-verifies getUser() inside the action per T-04-05 — Server Actions are directly POST-reachable; the calling page's own wrong-door guard is not sufficient auth verification
- [Phase 04-02]: Product-facing a11y prefs (theme/text-size/reduced-motion) use NEW html[data-*] attribute names distinct from the dev-only data-kit-theme, sharing only the Lightning CSS mechanism — Prevents a real client session and an open /kit dev-preview tab from ever colliding on the same attribute
- [Phase 04-UAT]: Persisted a11y prefs hydrate at the authenticated shell level (not only inside `/profile`) so every authenticated route inherits theme/text-size/reduced-motion; browser Supabase clients require direct `process.env.NEXT_PUBLIC_*` property reads so Next can inline public env values; `AuthSessionMissingError` maps to signed-out/null so route guards redirect instead of rendering production RSC errors.

### v1.1 roadmap decisions (2026-07-04)

- **Phase numbering continues (4-8), not reset** — v1.0 ended at Phase 3.
- **Onboarding (5) precedes Tracker (6)** to build ONE shared config-driven renderer/validator the tracker reuses; any ordering that duplicates the renderer is waste (research, load-bearing).
- **Chat split into schema (7) + route/Edge (8)** — isolates the top data-leak + idempotency + integrity pitfalls; Phase 8 gets the largest planning/test budget. Chat depends only on the shipped pair, so Phase 7 may run in parallel with 5/6 if capacity allows.
- **XC-01/02/03 are cross-cutting** (woven into every touched phase's success criteria); **XC-04 (E2E of the three cross-role flows) anchors to Phase 8**.
- **Scope boundaries held:** persistent chat send/read only (realtime deferred, schema realtime-ready); human chat only (no AI); assignment seed-only (`assign-tracker` Edge Function seed-invocable, no assignment UI); consent = fields only; onboarding linear-first (branching is Future/ONBD-B01).
- **One net-new runtime dep this milestone: `zod` v4** (apps/web + Edge Function, never `packages/core`); `pg_jsonschema` CHECK as the un-bypassable config backstop.

### Known tech debt (from v1.0 audit — non-blocking)

See `milestones/v1.0-MILESTONE-AUDIT.md` frontmatter for the full structured list (Input a11y attributes, two hardcoded `/home` redirects vs authRedirects, icon-guard regex breadth, tailwind caret-range pinning, stale dev seed password for client1).

### Todos / open questions

- [ ] AGENTS.md docs pass — design-token section still describes the pre-monochrome lime accent (tracked in PROJECT.md Active)
- [ ] `vite@8` peer-wants `@types/node >=22.12.0` (installed 22.10.7) — warning only; bump with the next dependency task
- [ ] Hosted Supabase environments (staging/prod): linked project, per-env email templates, Site URL / Redirect URLs — D-14 deploy checklist exists, execute at first deploy
- [ ] `assign-tracker` + real `send-message` Edge Function signatures — design during Phase 6 / Phase 8 planning
- [ ] Research flags for planning: Phase 7/8 (Chat) is highest-complexity — consider `/gsd:plan-phase --research-phase` (real Edge Function: JWT verify + membership + zod + idempotency + in-memory rate limit + `useOptimistic` reconciliation edge case, React issue #31967). Phase 4 (Profiles) and Phase 6 (Tracker) use standard/reuse patterns — skip research-phase.

### Blockers

- None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260704-dn2 | Implement native Android static Compose UI preview for current web auth screens, no auth wiring yet | 2026-07-04 | 2e21c80 | [260704-dn2-go-with-option-1-implement-native-androi](./quick/260704-dn2-go-with-option-1-implement-native-androi/) |
| 260704-inu | Build modern chat interface component library for web | 2026-07-04 | 59cc6fb | [260704-inu-build-modern-chat-interface-component-li](./quick/260704-inu-build-modern-chat-interface-component-li/) |
| 260704-k50 | Create Storybook stories for each existing UI component | 2026-07-04 | c9d2df0 | [260704-k50-create-storybook-stories-for-each-existi](./quick/260704-k50-create-storybook-stories-for-each-existi/) |
| 260704-keb | Organize chat components into per-component folders (match ui/ structure) | 2026-07-04 | e094f79 | [260704-keb-organize-chat-components-into-per-compon](./quick/260704-keb-organize-chat-components-into-per-compon/) |
| 260704-kfb | Design and implement production-ready service abstraction architecture | 2026-07-04 | 3c1ec95 | [260704-kfb-design-and-implement-a-production-ready-](./quick/260704-kfb-design-and-implement-a-production-ready-/) |
| 260705-amu | Bootstrap the iOS project and configure foundational UI infrastructure | 2026-07-04 | 8c60efe | [260705-amu-bootstrap-the-ios-project-and-configure-](./quick/260705-amu-bootstrap-the-ios-project-and-configure-/) |

## Session Continuity

**Last session:** 2026-07-05T02:19:32.489Z

- **Last activity:** 2026-07-05
- **Stopped at:** Phase 5 UI-SPEC approved
- **Resume file:** .planning/phases/05-data-driven-onboarding/05-UI-SPEC.md
- **Next action:** `/gsd:plan-phase 5` — plan Data-Driven Onboarding (shared config renderer/validator)

---
*State initialized: 2026-07-02 at roadmap creation. v1.1 roadmap added: 2026-07-04.*
