# ADR 0004: Native Android presence

- Status: Accepted
- Date: 2026-07-17

## Context

Web presence is an app-wide, privacy-sensitive capability backed by Supabase
sessions, sanitized snapshots, RLS, Realtime, and the `presence-command` Edge
Function. Android needs parity on its current direct-chat surfaces without
inventing profile screens or creating a second backend contract.

The Android app already uses a manual application composition root. Chat and
calling expose provider-neutral repository interfaces while their Supabase and
media adapters remain internal.

## Decision

Add `:data:presence` and `:feature:presence`. `:data:presence` owns the public
presence models/repository and the internal Supabase adapter. The repository is
application-scoped, in-memory, revision ordered, and responsible for one random
per-process session, heartbeat/retry serialization, auth transitions,
authoritative refreshes, subject revocation, and Realtime recovery.

`ProcessLifecycleOwner` defines availability. A started/visible app, including
picture-in-picture, maintains presence. A fully hidden app ends the session
best-effort. Process death is handled by the backend's 90-second stale cutoff.
No foreground service, WorkManager, Room, DataStore, or push wake-up is used.

`:feature:presence` owns the 15-second presentation clock, local stale/expiry
rules, optimistic status commands, locale/system-time formatting, reusable
Compose indicators, and the account/status/duration sheet. `:feature:chat`
depends on it for current Android surfaces. Manual constructor injection remains
the composition mechanism; adding Hilt for one feature would create a second DI
model without improving ownership.

Diagnostics may contain only operation, result, duration, and broad failure
category. They must never contain user or relationship identifiers, modes, or
timestamps.

## Consequences

- Presence does not claim background liveness and may show Offline up to 90
  seconds after abrupt process death.
- Multiple devices remain correctly aggregated by the backend.
- Android uses system locale and 12/24-hour settings for last-seen copy.
- Android avatars remain initials until a native avatar URL pipeline exists.
- Web friend and coach/client profile placements remain out of scope until the
  corresponding Android screens exist.
- Release requires migrations 0034, 0035, and 0048 plus `presence-command` in
  the target Supabase project; this decision adds no migration.
