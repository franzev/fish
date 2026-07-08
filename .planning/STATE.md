---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Cross-platform Chat State Foundation
status: verifying
stopped_at: Phase 09 automated verification passed; UAT required for 2 human checks.
last_updated: "2026-07-07T00:55:09Z"
last_activity: Persisted Phase 09 UAT after human-needed verification.
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 8
  completed_plans: 8
  percent: 88
---

# Project State: FISH

**Last updated:** 2026-07-07

## Project Reference

See: .planning/PROJECT.md

- **Core value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.
- **Shipped:** v1.0 Monochrome Foundations (2026-07-04) — design system + auth foundation + role-aware home; verified closeout, 28/28 requirements.
- **Current focus:** Phase 09 UAT for cross-platform chat state.

## Current Position

Phase: 09 (cross-platform-chat-state) — needs UAT
Plan: 4 of 4
Status: Automated verification passed 6/6 must-haves. Two human checks remain before phase completion: `/chat` visual calm and native notes readability.

Progress: [█████████░] 88%

## Milestone v1.1 Phases

| Phase | Name | Depends on | Requirements | Status |
|-------|------|------------|--------------|--------|
| 4 | Client Profiles | v1.0 | PROF-01..06 | Complete |
| 7 | Chat Schema | v1.0 | CHAT-01, CHAT-04, CHAT-06 | Complete |
| 8 | Real Chat Route + send-message Edge Function | Phase 7 | CHAT-02/03/05/07 | Complete |

Removed 2026-07-06: the previously built learning-flow engines are no longer part of the active product.

## Milestone v1.2 Phases

| Phase | Name | Depends on | Requirements | Status |
|-------|------|------------|--------------|--------|
| 9 | Cross-platform Chat State | Phase 8 | CSTATE-01..06 | Needs UAT |

## Archived Milestones

| Version | Name | Shipped | Archive |
|---------|------|---------|---------|
| v1.0 | Monochrome Foundations | 2026-07-04 | milestones/v1.0-ROADMAP.md · v1.0-REQUIREMENTS.md · v1.0-MILESTONE-AUDIT.md · v1.0-phases/ |

## Accumulated Context

### Decisions

- Layout-stability contract: no control changes size on state change (overlay spinners, reserved message rows, out-of-flow notices).
- Every auth screen: `<form onSubmit>` + `type="submit"` — Enter always submits.
- RLS is the sole authorization boundary for reads; `authRedirects` is the single redirect source of truth.
- Alert tones are the one scoped color exception (low-chroma, contrast-gated); structural UI stays chroma-0.
- Theme work must be verified against served/compiled CSS (Lightning CSS `light-dark()` polyfill), never authored CSS alone.
- Dev origin must match the browser exactly: `localhost:3001` (host-scoped cookies), pinned via `next dev -p 3001` + Supabase `site_url`.
- Product-facing a11y prefs hydrate at the authenticated shell level so every authenticated route inherits theme/text-size/reduced-motion.
- `send_chat_message` is the database-owned chat write boundary; the Edge Function verifies JWT/membership and delegates the insert.
- Chat state portability decision: the durable chat brain should be a small event/result state machine with JSON fixtures; Zustand is only the web adapter, while Android/iOS use native state containers.
- The shared chat brain is exported as `@fish/core/chat-state`; the web `chat-state.ts` helper remains a compatibility shim.
- Chat-state fixtures use plain JSON vectors with expected state or selector outputs so native clients can replay the same contract later.
- [Phase 09]: Plan 09-02 keeps extracted web chat hooks backed by React local state; Zustand remains out of scope until Plan 09-03. — D-06 requires hook extraction before the web store so behavior remains testable and unchanged before shared coordination is introduced.
- [Phase 09]: Chat state parity is documented as event/result replay with expected state or selector outputs, not generated shared native code. — Plan 09-04 creates the cross-platform protocol document and native notes from the existing fixture vectors.
- [Phase 09]: Web Zustand, Android ViewModel/StateFlow, and iOS observable models are adapters only; Supabase/server boundaries remain authoritative. — The protocol and native notes keep auth, assignment, membership, writes, persistence, and durable read state outside local platform stores.
- [Phase 09]: Native readiness is documentation only; Android/iOS production chat source remains untouched. — CSTATE-05 requires architecture notes without native production implementation.
- [Phase 09]: Zustand is the web-only chat coordination/cache adapter keyed by conversationId; the portable reducer and Supabase/server boundaries remain authoritative. — Plan 09-03 introduced Zustand only in apps/web and store tests reject auth, role, assignment, Supabase client, and service-role drift.
- [Phase 09]: ChatClient and hooks subscribe through narrow store selectors/actions while preserving the one assigned conversation UI. — Plan 09-03 wires messages, composer, read state, and realtime status through selector slices with existing chat tests green.

### Todos / open questions

- [ ] Token pipeline formalized so native iOS/Android can mirror tokens later.
- [ ] Hosted Supabase environments (staging/prod): linked project, per-env email templates, Site URL / Redirect URLs.
- [ ] `vite@8` peer-wants `@types/node >=22.12.0` (installed 22.10.7) — warning only; bump with the next dependency task.

### Blockers

- None.

### Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 09 | 01 | 8min | 3 | 10 |
| 09 | 02 | 12min | 3 | 9 |
| 09 | 04 | 5min | 2 | 2 |
| 09 | 03 | 12min | 3 | 11 |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260704-dn2 | Implement native Android static Compose UI preview for current web auth screens, no auth wiring yet | 2026-07-04 | 2e21c80 | [260704-dn2-go-with-option-1-implement-native-androi](./quick/260704-dn2-go-with-option-1-implement-native-androi/) |
| 260704-inu | Build modern chat interface component library for web | 2026-07-04 | 59cc6fb | [260704-inu-build-modern-chat-interface-component-li](./quick/260704-inu-build-modern-chat-interface-component-li/) |
| 260704-k50 | Create Storybook stories for each existing UI component | 2026-07-04 | c9d2df0 | [260704-k50-create-storybook-stories-for-each-existi](./quick/260704-k50-create-storybook-stories-for-each-existi/) |
| 260704-keb | Organize chat components into per-component folders (match ui/ structure) | 2026-07-04 | e094f79 | [260704-keb-organize-chat-components-into-per-compon](./quick/260704-keb-organize-chat-components-into-per-compon/) |
| 260704-kfb | Design and implement production-ready service abstraction architecture | 2026-07-04 | 3c1ec95 | [260704-kfb-design-and-implement-a-production-ready-](./quick/260704-kfb-design-and-implement-a-production-ready-/) |
| 260705-amu | Bootstrap the iOS project and configure foundational UI infrastructure | 2026-07-04 | 8c60efe | [260705-amu-bootstrap-the-ios-project-and-configure-](./quick/260705-amu-bootstrap-the-ios-project-and-configure-/) |
| 260705-gby | Implement authentication improvements across web, iOS, and Android | 2026-07-05 | f494ca9 | [260705-gby-implement-authentication-improvements-ac](./quick/260705-gby-implement-authentication-improvements-ac/) |
| 260706-rsd | Remove stale color wording and retire unvalidated learning-flow implementations | 2026-07-06 | f099a9e | [260706-rsd-remove-stale-color-language-and-re](./quick/260706-rsd-remove-stale-color-language-and-re/) |
| 260708-doh | Fix getServerSnapshot caching infinite loop in chat-store useChatStore | 2026-07-08 | d56fc795 | [260708-doh-fix-getserversnapshot-caching-infinite-l](./quick/260708-doh-fix-getserversnapshot-caching-infinite-l/) |
| 260708-du5 | Redesign chat UI from 1-on-1 messaging to community-room (Discord-like) experience | 2026-07-08 | 4e9d52c4 | [260708-du5-redesign-chat-ui-from-1-on-1-messaging-t](./quick/260708-du5-redesign-chat-ui-from-1-on-1-messaging-t/) |
| 260708-eoo | Port Discord community-chat idioms into ChatClient using existing FISH design tokens only | 2026-07-08 | cb088b0a | [260708-eoo-port-discord-community-chat-idioms-into-](./quick/260708-eoo-port-discord-community-chat-idioms-into-/) |

## Session Continuity

**Last session:** 2026-07-07T00:55:09Z

- **Last activity:** 2026-07-08 - Completed quick task 260708-eoo: Ported Discord community-chat idioms into ChatClient using existing design tokens only.
- **Stopped at:** Phase 09 automated verification passed; UAT required for 2 human checks.
- **Next action:** Run `$gsd-verify-work 09` to complete the visual calm and native docs readability checks.

---
*State initialized: 2026-07-02 at roadmap creation. v1.1 re-scoped: 2026-07-06.*
