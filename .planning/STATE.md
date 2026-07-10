---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Cross-platform Chat State Foundation
status: executing
stopped_at: Completed 09-10-PLAN.md
last_updated: "2026-07-10T05:15:00.750Z"
last_activity: 2026-07-10
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 19
  completed_plans: 19
  percent: 60
---

# Project State: FISH

**Last updated:** 2026-07-07

## Project Reference

See: .planning/PROJECT.md

- **Core value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.
- **Shipped:** v1.0 Monochrome Foundations (2026-07-04) — design system + auth foundation + role-aware home; verified closeout, 28/28 requirements.
- **Current focus:** Phase 09 — cross-platform-chat-state

## Current Position

Phase: 09 (cross-platform-chat-state) — EXECUTING
Plan: 10 of 11
Status: Ready to execute
Next planned: Phase 10 (chat-message-loading-optimization) — 4 plans in 3 waves, verified by plan-checker, ready for /gsd-execute-phase 10.

Progress: [██████████] 100%

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
| 10 | Chat Message Loading Optimization | Phase 8, Phase 9 | CLOAD-01..06 | Planned (4 plans, ready to execute) |

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
- [Phase 10]: Portable pagination contract (hydrateWindow/olderMessagesRequested/olderPageLoaded/olderPageLoadFailed events, ChatPaginationState) lands in packages/core first, proven by 17 JSON fixtures. — Plan 10-01 is the shared contract every later plan (Supabase read, actions.ts, hooks/store, chat-client UI) consumes.
- [Phase 10]: Plan 10-02 bounds the SSR message query (getAssignedConversation) to a 40+1 keyset window and adds loadOlderMessagesAction, backfillMessagesAction, and loadNewestMessagesAction as direct-select reads that never post to chat-command. — Closes the review-flagged gap where Plan 03's reconnect reset fallback would otherwise need an unbounded refetch, while keeping the AGENTS.md read/write API boundary intact.
- [Phase 10]: Plan 10-03's useChatRealtime keeps applyGapBackfill as an optional prop that falls back to the existing required refreshConversation when unset, rather than a hard rename — chat-client.tsx (Plan 04's UI-wiring scope) still only passes refreshConversation; the fallback lets the bounded reconnect path activate the moment a page injects backfillMessagesAction into useChatMessages, with zero breakage before Plan 04 wires the UI
- [Phase 10]: Reconnect coalescing tracks first-subscribe PER realtime channel (a Set keyed by channel identity), not one shared boolean, since messages/reads/reactions each fire their own initial post-mount SUBSCRIBED — closes the cross-AI review's HIGH-severity gap; only a channel's second-or-later SUBSCRIBED is eligible to backfill, and all three share one in-flight lock so a simultaneous reconnect produces exactly one bounded backfill instead of three full refetches
- [Phase 10]: Plan 10-04 gates the 'Reconnecting…' pill on a genuine prior connect (previous-status render-time comparison, not a ref-read or setState-in-effect), so an ordinary initial chat load never reads as a reconnect. — Avoids react-hooks/refs and react-hooks/set-state-in-effect lint failures while keeping the first-load experience calm per states.md.
- [Phase 10]: loadOlderAndPreserveScroll is the single wrapped callback both the IntersectionObserver sentinel and the 'Load earlier messages' button call; the raw Promise-returning loadOlderMessages is never called directly from the UI. — Guarantees neither trigger path can bypass the manual scrollHeight-diff restore (CLOAD-04).
- [Phase 09]: Overall live realtime capture is inconclusive because raw WebSocket frames, callback status transitions, and sender HTTP response status were unavailable. — The protocol requires an inconclusive result when transport/request capture cannot be completed.
- [Phase 09]: Functional message delivery was not reproduced as failing; both independent-session messages rendered exactly once without receiver refresh. — Database rows and receiver DOM counts confirmed both sends, including after fresh receiver restoration.
- [Phase 09]: Missing community avatar and timestamp are separate presentation behavior, not a delivery root cause. — Same-sender grouping suppresses avatar and MessageMeta without a time-gap cutoff; layout changes remain separate scoped work.
- [Phase 09]: resetChatStoreForTests() now delegates to clearChatStore() so the test reset path and the real sign-out clear path are provably the same code. — Prevents drift between what tests reset and what production logout actually clears (closes CR-01).
- [Phase 09]: clearChatStore() is called after signOut() and before router.push('/login') inside LogoutButton.handleLogout. — Ensures no stale conversation slice is readable by the next signed-in account once the soft navigation to /login completes.
- [Phase 09]: Removed the /chat route file (kept shared chat internals under chat/ as a module folder); narrowed app-shell.tsx immersive check to /channels only. — channels/[id]/page.tsx already imports from ../../chat/*, so relocating internals would be unnecessary churn; deleting only the dead route resolves the VERIFICATION Gap 4 route-scope drift.
- [Phase 09]: CSTATE-02/CSTATE-06 (REQUIREMENTS.md), D-09 (09-CONTEXT.md), and the Phase 9 goal (ROADMAP.md) now carry dated 2026-07-10 supersede notes pointing at the community room /channels/general. — Notes are additive blockquotes; original requirement/decision/goal wording is preserved so history stays auditable, and re-verification measures the shipped surface instead of the removed 1-on-1 route.
- [Phase 09]: Plan 09-09: markMessageFailed restores composer.draft from the failed body only when the draft is empty; a non-empty (newer) draft is never overwritten, and use-chat-composer.ts no longer clears the draft after a failure (closes WR-01).
- [Phase 09]: Plan 09-10: message-subscription cleanup resets realtime status to idle and resets seenFirstSubscribeRef/backfillInFlightRef per conversationId; read-state payloads dispatch once via mergeReadState only. — Closes WR-05 (stale connected status mislabels a revisit as reconnecting) and WR-06 (duplicate mergeReadState dispatch) from the Phase 09 code review.

### Todos / open questions

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
| Phase 10 P01 | 21min | 3 tasks | 7 files |
| Phase 10 P02 | 18min | 2 tasks | 5 files |
| Phase 10 P03 | 17min | 3 tasks | 6 files |
| Phase 10 P04 | 12min | 3 tasks | 9 files |
| Phase 09 P05 | 23min | 2 tasks | 1 files |
| Phase 09 P07 | 7min | 2 tasks | 4 files |
| Phase 09 P08 | 8min | 2 tasks | 7 files |
| Phase 09 P09 | 9min | 2 tasks | 7 files |
| Phase 09 P10 | 18min | 2 tasks | 2 files |

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
| 260708-oxs | Remove iOS and Android native app code and all references | 2026-07-08 | 7aa64b36 | [260708-oxs-remove-ios-and-android-native-app-code-a](./quick/260708-oxs-remove-ios-and-android-native-app-code-a/) |
| 260706-rsd | Remove stale color wording and retire unvalidated learning-flow implementations | 2026-07-06 | f099a9e | [260706-rsd-remove-stale-color-language-and-re](./quick/260706-rsd-remove-stale-color-language-and-re/) |
| 260708-doh | Fix getServerSnapshot caching infinite loop in chat-store useChatStore | 2026-07-08 | d56fc795 | [260708-doh-fix-getserversnapshot-caching-infinite-l](./quick/260708-doh-fix-getserversnapshot-caching-infinite-l/) |
| 260708-du5 | Redesign chat UI from 1-on-1 messaging to community-room (Discord-like) experience | 2026-07-08 | 4e9d52c4 | [260708-du5-redesign-chat-ui-from-1-on-1-messaging-t](./quick/260708-du5-redesign-chat-ui-from-1-on-1-messaging-t/) |
| 260708-eoo | Port Discord community-chat idioms into ChatClient using existing FISH design tokens only | 2026-07-08 | cb088b0a | [260708-eoo-port-discord-community-chat-idioms-into-](./quick/260708-eoo-port-discord-community-chat-idioms-into-/) |
| 260708-exm | Replace inline message action rows with hover-revealed action bar following the community design reference | 2026-07-08 | a8df0c45 | [260708-exm-replace-inline-message-action-rows-with-](./quick/260708-exm-replace-inline-message-action-rows-with-/) |
| 260708-knl | Align community reply preview with the reference — avatar on header row, spline from avatar into preview | 2026-07-08 | 0146deba | [260708-knl-align-community-reply-preview-with-the-r](./quick/260708-knl-align-community-reply-preview-with-the-r/) |
| 260708-mjs | Remove the card/box wrapping the chat thread and restyle message reaction counters to match the Discord reference | 2026-07-08 | 4261f40c | [260708-mjs-remove-the-card-box-wrapping-the-chat-th](./quick/260708-mjs-remove-the-card-box-wrapping-the-chat-th/) |
| 260708-n53 | Make the chat occupy the full shell pane width and height, simplify its tailwind classes, and remove redundant wrapper divs | 2026-07-08 | ec419638 | [260708-n53-make-the-chat-occupy-the-full-shell-pane](./quick/260708-n53-make-the-chat-occupy-the-full-shell-pane/) |
| 260708-nr2 | Redesign chat emoji reactions: screenshot-style pills, monochrome tokens, any-emoji grouped searchable picker, cursor-pointer, DB persistence | 2026-07-08 | 3a3f0dcf | [260708-nr2-redesign-chat-emoji-reactions-screenshot](./quick/260708-nr2-redesign-chat-emoji-reactions-screenshot/) |
| fast | Fix reaction ack wiping sender name to "Member"; shrink message timestamp to caption size | 2026-07-08 | 768d08b2 | — |
| fast | Emoji panel semantic size tokens + vertical flip near viewport bottom | 2026-07-08 | b349327d | — |
| fast | Portal emoji picker to body (fixes clipping in real chat scrollport); /kit/chat-live harness renders real ChatClient without auth | 2026-07-08 | 19ca8286 | — |
| 260708-pgh | Adopt Base UI: emoji picker on Popover (portal, collision flip, focus return) + per-category Tabs | 2026-07-08 | 747c7e21 | [260708-pgh-adopt-base-ui-emoji-picker-popover-refac](./quick/260708-pgh-adopt-base-ui-emoji-picker-popover-refac/) |
| fast | Emoji picker bottom monochrome icon tabs (no h-scroll) + shared ui/ScrollArea with thin auto-fading scrollbar | 2026-07-08 | e7161ece | — |
| fast | Emoji picker search simplified to quiet pill (inline icon, aria-label, no ring flash on open) | 2026-07-08 | 5dd2dfbb | — |
| fast | Emoji picker polish: 24px glyph token, circular active tabs, --shadow-popover replaces border, calm input focus border | 2026-07-08 | 62e612b7 | — |
| fast | Unclip emoji picker edge tabs: 28px circle, px-nudge list padding, focus ring moved onto the circle | 2026-07-08 | 6374a35e | — |
| fast | Borderless reaction pills via new --color-surface-3 step; emoji panel height 337px so resting grid ends on a full row | 2026-07-08 | d145169e | — |
| fast | Chat type drops to 14px ui-sm (body + author name), avatar gutter widens to gap-sm; twMerge taught custom text size/color groups | 2026-07-08 | a45be3c3 | — |
| 260709-8aa | Chat log: shared ScrollArea + conditional stick-to-bottom scroll with new-messages pill | 2026-07-08 | b9d76d0e | [260709-8aa-chat-log-shared-scrollarea-conditional-s](./quick/260709-8aa-chat-log-shared-scrollarea-conditional-s/) |
| 260709-p06 | Add seed data for testing long/formatted chat message rendering, plus a self-contained MessageBody rich-text renderer | 2026-07-09 | 98d33b60 | [260709-p06-add-seed-data-for-testing-long-formatted](./quick/260709-p06-add-seed-data-for-testing-long-formatted/) |
| 260709-qag | Remove the dev-only chat kit entirely (outdated 1:1-messaging mock demo); seed real long-form community messages into the general channel via scripts/seed.ts | 2026-07-09 | 76580eef | [260709-qag-remove-the-dev-only-chat-kit-entirely-an](./quick/260709-qag-remove-the-dev-only-chat-kit-entirely-an/) |

## Session Continuity

**Last session:** 2026-07-10T05:15:00.745Z

- **Last activity:** 2026-07-10
- **Stopped at:** Completed 09-10-PLAN.md
- **Next action:** Run `$gsd-verify-work 09` to complete the visual calm and native docs readability checks.

---
*State initialized: 2026-07-02 at roadmap creation. v1.1 re-scoped: 2026-07-06.*
