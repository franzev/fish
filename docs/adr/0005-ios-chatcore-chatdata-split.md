# ADR 0005: Split native iOS chat state from transport

Status: accepted  
Date: 2026-07-18

## Context

Web direct chat already has portable reducer and selector behavior while the
iOS presentation was provider-free. Reimplementing state transitions inside a
SwiftUI model would make retries, hydration, pagination, receipts, and message
actions drift between platforms.

## Decision

FishKit has two Foundation-only chat foundations:

- `ChatCore` owns pure `Sendable` state, reducer events, selectors, ordering,
  merge behavior, reply previews, snippets, unread math, and shared JSON vector
  replay.
- `ChatData` owns provider-neutral ports and live adapters for REST, Edge
  Functions, Supabase Realtime, attachments, directory previews, and attention.

`PersonalChat` owns the one `@MainActor @Observable ConversationStore` that
orchestrates those boundaries and maps them into stateless views.

## Consequences

Provider SDKs cannot enter reducer or UI types. Web and iOS replay the same
chat-state and media-merge fixtures. Network behavior remains replaceable in
tests without creating a second application state model.
