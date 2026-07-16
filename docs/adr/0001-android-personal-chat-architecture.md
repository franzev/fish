# ADR 0001: Native Android personal-chat architecture

- Status: Accepted; module layout amended by ADR 0002
- Date: 2026-07-16
- Scope: Android one-to-one text messaging

## Context

FISH removes choices for neurodivergent professionals. The Android chat must
preserve the sparse web language, work through interruptions and weak
connections, and remain extensible without introducing group/call concepts into
the personal-chat model.

## Decision

Use Kotlin, Jetpack Compose, and a small layered Gradle build:

1. Generate Android semantic tokens from `design/tokens/fish.tokens.json` and
   expose them only through `FishTheme` and reusable FISH components. Disable
   dynamic color and elevation so system wallpaper and Material defaults cannot
   change product hierarchy.
2. Keep composables stateless. A conversation-scoped ViewModel maps a pure
   Kotlin reducer to immutable presentation models and survives recreation with
   `SavedStateHandle` plus Room-backed drafts.
3. Keep the reducer free of Android/provider imports and replay the shared JSON
   protocol vectors. This gives behavioral parity without running TypeScript on
   Android.
4. Put FISH-owned repository contracts in `data:chat:api`. Keep Room, Ktor, and
   the Supabase community SDK in `data:chat:impl` so provider changes do not
   reach UI or domain state.

   The separate Gradle modules in this item were later consolidated by ADR
   0002. The `ChatRepository` seam and internal provider isolation remain.
5. Treat Supabase/Postgres and RLS as authorization authority. Use direct RLS
   reads, Edge Functions for sends/read commands, and Room only as an observable
   cache.
6. Use optimistic, idempotent sends with explicit failure and manual retry.
   Preserve drafts offline; never silently queue an offline send.
7. Show a conversation list only for users already authorized for more than one
   personal conversation. Compact windows navigate list-to-detail; expanded
   windows use a two-pane list/detail layout capped at a readable transcript
   width.
8. Generate Baseline/Startup Profiles and maintain macrobenchmarks. Keep
   diagnostics structurally redacted: operation, outcome, duration, and failure
   category only.

## Consequences

- More Gradle modules and mapping code exist than in a single-module app, but
  dependency rules are mechanically verifiable and future provider/UI changes
  stay local.
- Local cache enables fast/offline reading but never grants authorization; a
  reconnect refresh can revoke stale access.
- The release has one primary chat action—Send—and no generic flags or
  placeholders for group chat, calls, or media.
- Live two-user validation, hardware performance thresholds, and target-user
  review remain deployment gates because they require external accounts,
  devices, and people rather than additional implementation.
