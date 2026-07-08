# Channels + a simplified chat shell — design

**Date:** 2026-07-09
**Status:** Draft for review
**Area:** FISH web · `/chat` → `/channels`

## Summary

Introduce a lightweight **channels** concept (seeded with a single channel, `general`) and
rebuild the chat shell around it, simplifying the header, sidebar, and composer at the same time.
The layout moves to a **two-column shape** (icon rail + channel column + thread), routed at
`/channels/[id]`. The composer is redesigned to a borderless, Discord-style bar, and search gains
a filter surface. Several composer affordances and the whole search-filter surface are **UI-only
stubs** in this pass — the shell ships now, the subsystems land later.

## Product-rule reconciliation

FISH's governing rules are *remove choices, not add them* and *assigned, never chosen*. Channels,
polls, GIFs, and filters all look like the multi-choice UI those rules push against, so scope is
deliberately constrained to stay inside them:

- **One channel only.** `general` is seed data. There is no channel directory, no join flow, and
  no "pick a room" UI. With a single channel the surface reads as today's screen with a labeled
  column. Assignment/membership is explicitly out of scope (deferred, per the earlier decision to
  "not worry about who assigns").
- **Stubs, not features.** Upload File, Create Poll, GIF, and Stickers are present in the UI but
  show a calm "coming soon" `notice` — no new subsystems are built. This keeps us from shipping
  learning/community features a coach hasn't validated.
- **Search filters are a power tool, kept quiet.** The filter popover/dialog is UI-only and does
  not query. It stays out of the way (behind a search icon), so the resting screen is not busier
  than today.
- **One primary action preserved.** The only `Button variant="primary"` on the screen remains
  **Send** (and it only appears when there is text). Every other composer control is a
  ghost/icon button.

## Scope

**In scope**
- A `channels` data concept seeded with one channel (`general`), backed by the existing demo
  community conversation.
- Routing at `/channels/[id]`; `/chat` redirects to the `general` channel.
- Two-column shell: slim icon rail + channel column + thread (desktop); responsive reflow on mobile.
- Simplified thread header (collapsed search, dropped subtitle line + notification badge).
- Redesigned composer: borderless input, `+` menu (Upload File / Audio Recording / Create Poll),
  right-side GIF · sticker · emoji, conditional Send button.
- Search filter surfaces (quick Popover + responsive Filters dialog/sheet) — **UI-only**.
- Wiring **Emoji** and **Audio Recording** for real (both have existing groundwork).

**Out of scope (this pass)**
- Channel membership/assignment, channel creation, multiple channels, channel directory.
- File upload storage + attachment rendering; poll data model + voting; GIF provider; sticker sets.
- Any real search querying/filtering behind the filter UI.
- Coach vs client differentiation of the filter UI (build once for both; revisit if needed).

## Layout & routing (decision: Layout B)

Desktop shell, left → right:

1. **Icon rail** (slim, ~64px): logo, primary nav (client: Home · Profile; coach: Clients), and
   the user avatar + logout pinned to the bottom. This is the simplified version of today's
   `app-shell.tsx` rail.
2. **Channel column** (~150–200px): a quiet uppercase "Community" heading and the channel list
   with `# general` active. Unread indication lives here (moved off the header badge).
3. **Thread**: header + message log + composer.

**Routing**
- New route group: `apps/web/app/(authenticated)/channels/[id]/page.tsx`.
- `[id]` is the channel's id (uuid). The seeded `general` channel has a stable id.
- `apps/web/app/(authenticated)/chat/` redirects to `/channels/{generalId}` (keep the redirect so
  existing links/nav don't break), or the nav points directly at the channel. The existing
  `ChatClient`, actions, realtime, store, and hooks are reused unchanged where possible — only the
  data-loading entry point and the presentational shell change.
- The kit harness (`apps/web/app/kit/chat-live/page.tsx`) is updated to render the new shell so
  chat-interior changes stay verifiable without auth.

## Data model

Today `kind: "community"` is a demo bridge: a single fixed conversation id
(`11111111-1111-4111-8111-111111111111`) any authenticated profile can read
(`supabase/migrations/0014_demo_community_conversation.sql`). We keep that bridge as the message
backing store and layer a minimal channel concept on top:

- **New migration** adds a `channels` table: `id uuid pk`, `slug text unique` (e.g. `general`),
  `name text`, `created_at`, and a `conversation_id` reference (or an equivalent mapping) pointing
  the `general` channel at the demo community conversation. Seed exactly one row.
- No membership table. RLS for `general` continues to rely on the existing demo-community read
  policy — every authenticated user can read/post, as today.
- `ClientChatData` (`apps/web/lib/services/supabase/types.ts`) gains channel identity
  (`channelId`, `channelSlug`, `channelName`) so the header/column can render `# general` and the
  composer placeholder can read `Message #general`. The existing `kind` field stays.
- `getChatPageData` (`apps/web/lib/auth/server.ts`) / the service core
  (`apps/web/lib/services/supabase/core.ts`) resolve a channel by id and return its data.

This is intentionally the smallest schema that makes "channel" a first-class thing without
building membership. Growing to N channels later means adding rows + a membership/assignment
table, not reworking this shape.

## Shell simplification detail

**Sidebar / rail (`components/shell/app-shell.tsx`)**
- Keep the two-column arrangement (rail + channel column) — confirmed acceptable.
- Rail trimmed to logo, primary nav, avatar/logout. "Community" nav item now resolves to the
  channels route.

**Thread header (`chat-client.tsx`)** — Header option A:
- Shows `# general · 4 members` and a **search icon** on the right.
- Clicking search opens the filter Popover (below). The always-open search input is removed.
- **Dropped:** the redundant subtitle line and the `NotificationBadge` (unread now shown on the
  channel row in the column).
- Presence/typing/recording indicators are retained as today.

## Composer redesign (`chat-client.tsx` footer)

A single rounded `bg-surface-2` bar, **no border and no focus ring on the input** (per request):

- **Left:** `+` button → **Base UI** menu with three items: **Upload File**, **Audio Recording**,
  **Create Poll** (Tabler icons).
- **Middle:** borderless `textarea`, placeholder `Message #{channelName}` (e.g. `Message #general`).
- **Right:** three Tabler icon buttons — **GIF**, **sticker**, **emoji**.
- **Send:** primary Send button appears only when the draft is non-empty (preserves the one-primary
  rule and gives mobile a tap target).

**Behavior**
- **Emoji** → reuse the existing `EmojiPickerButton`; inserts into the draft (wired for real).
- **Audio Recording** → wire to the existing `localRecording` state/flow (wired for real).
- **Upload File / Create Poll / GIF / Sticker** → show a calm `Alert tone="notice"` "coming soon"
  message; no-op otherwise (stub).

**Accessibility note:** the input drops its visible border per request, but we keep a subtle
`focus-within` treatment on the composer container so keyboard focus remains visible (the a11y
floor requires visible focus). To confirm in review.

## Search filters (UI-only, Base UI)

Clicking the header search icon opens a **Base UI Popover** with quick filters:
`From a specific user (from:)`, `Sent in a specific channel (in:)`,
`Includes a specific type of data (has:)`, `Mentions a specific user (mentions:)`, and
`More filters`.

`More filters` opens a full **Filters** surface (Base UI `Dialog`), responsive:
- **Desktop:** centered dialog.
- **Mobile:** bottom sheet (same component, responsive positioning) — honours the responsive
  contract and 56px targets.
- Fields: **From**, **In**, **Has**, **Mentions**, **Date** (Add date). Footer: **Clear filters**,
  **Cancel**, **Apply** (Apply is the monochrome primary, not Discord purple).
- **Dropped from Discord's version:** Author Type (no bots in FISH) and Pinned (no pinning feature).

Everything renders in monochrome tokens and performs no querying yet. All controls are inert
placeholders (selects show example text; Apply/Clear/Cancel close the surface without filtering).

## Responsive behavior

- **Desktop (≥ md):** rail + channel column + thread, as above.
- **Mobile:** the channel column becomes a **list screen** (list → thread idiom from the settled
  responsive contract). "Community" in the bottom nav opens the channel list; tapping `# general`
  opens the full-screen thread with a back affordance. With one channel this is a near-instant
  pass-through, but the structure is correct for when channels grow.
- Filters dialog → bottom sheet on mobile (above).

## Files likely touched

- `supabase/migrations/00XX_channels.sql` (new) — channels table + seed + mapping.
- `apps/web/lib/services/supabase/types.ts` — channel fields on `ClientChatData`.
- `apps/web/lib/services/supabase/core.ts` — resolve channel data.
- `apps/web/lib/auth/server.ts` — channel-aware page data.
- `apps/web/app/(authenticated)/channels/[id]/page.tsx` (new) — channel route.
- `apps/web/app/(authenticated)/chat/` — redirect to general channel.
- `apps/web/components/shell/app-shell.tsx` — rail trim + channel column + nav target.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` — header, composer, search trigger.
- `apps/web/components/chat/*` — new composer sub-components (composer bar, `+` menu, filter
  popover, filters dialog/sheet); reuse `EmojiPickerButton`.
- `apps/web/app/kit/chat-live/page.tsx` — update harness to the new shell.
- Tests alongside changed units (composer, channel routing, shell).

## Risks & open questions

- **Channel ↔ conversation mapping.** Simplest is to bind `general` to the existing demo
  conversation id. Confirm we're comfortable keeping the demo bridge rather than migrating to a
  real per-channel conversation now.
- **Borderless input focus.** Confirm the `focus-within` container treatment is acceptable for the
  a11y floor.
- **Coach vs client filter UI.** Built once for both this pass; may want to gate to coaches later.
- **Mobile channel-list screen** is derived from the responsive contract, not separately mocked —
  worth a glance in review.

## Non-goals restated

No streaks, scores, or grades. No client-facing menu of rooms. No new backend subsystems for
upload/poll/gif/sticker. No real search querying. This pass is shell + one channel + stubs.
