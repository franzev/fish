# ADR 0003: Native Android calling

- Status: Accepted
- Date: 2026-07-17
- Scope: Android one-to-one audio and video calling

## Context

FISH already uses Supabase as its application control plane and LiveKit as its web media plane. Android needs direct-chat outgoing calls and all authorized incoming calls while remaining reliable through background execution, process recreation, permission changes, and weak networks. A meeting-style SDK UI would conflict with the product rule to remove choices.

## Decision

1. Keep Supabase Auth, RLS, calls, participants, Edge Function commands, and Realtime as the durable authorization and lifecycle authority.
2. Use LiveKit's native Android SDK only as the media plane. Enable adaptive stream, dynacast, and simulcast; apply a capability-, connection-, preference-, and thermal-aware quality policy with 1080p as the ceiling.
3. Add `core:supabase`, `data:call`, and `feature:call`. Share one authenticated Supabase client with chat, keep provider types out of Compose, and make one coordinator own the call lifecycle.
4. Use Firebase Cloud Messaging HTTP v1 with Firebase Installation IDs for background Android call wake-up. Keep registrations command-only and service credentials server-side.
5. Integrate AndroidX Core Telecom, CallStyle notifications, a typed foreground service, runtime permissions, system audio routes, and video PiP at the app boundary.
6. Keep call UI stateless and FISH-owned. Enter from authorized direct chat, present one primary answer action, and avoid lobbies or pre-call device pickers.
7. Treat push and realtime deliveries as hints. Deduplicate them and reconcile against the authoritative call row on startup and reconnect.

## Consequences

- Android gains native system calling behavior without duplicating the web control plane or introducing a custom signaling server.
- Firebase becomes an Android delivery dependency, but only public app configuration ships in the APK and the database does not expose installation identifiers.
- The app can preserve audio when camera permission, bandwidth, or thermals cannot support video.
- Web and iOS share lifecycle/media contracts but keep platform-specific background and system-call adapters.
- Physical Android↔iOS calls, restrictive networks, OEM background policies, and hardware performance remain release gates because host tests cannot prove them.
