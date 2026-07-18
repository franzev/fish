# ADR 0006: Keep Supabase Realtime inside ChatData adapters

Status: accepted  
Date: 2026-07-18

## Context

Chat needs authenticated Postgres changes and broadcasts. The rest of the iOS
feature should not depend on Supabase SDK types, and URLSession remains simpler
for bounded REST and Edge Function calls.

## Decision

`supabase-swift` is linked only to `ChatData`. `SupabaseChatRealtime` and the
signed-in client are internal implementation details. The public boundary is
`ChatRealtimeProviding`, `ChatRealtimeSubscription`, typed events, and
connection streams. `ChatLiveSession` exposes protocol existentials and
provider-neutral configuration, never a Supabase client.

Every subscription authenticates before joining. Postgres channels are ready
only after system `ok`; the typing channel is ready after its subscribed state.
One lifecycle coordinator coalesces the four channels into a single disconnect
and one reconnect signal per recovery.

## Consequences

Feature and view targets remain SDK-free. REST adapters keep explicit timeout
and calm-failure behavior. A future shared realtime module should be created
only if calls adopt the same SDK and a second concrete consumer appears.
