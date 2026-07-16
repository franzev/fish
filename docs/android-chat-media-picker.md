# Android chat media picker

The Android emoji, GIF, and sticker picker is implemented inside the existing
`:feature:chat` and `:data:chat` modules. It intentionally reuses the shipped
Supabase message schema and Edge Functions; there is no Android-only backend or
Gradle module.

## Shared contracts

- `packages/core/src/chat-media/emoji-groups.json` is generated from
  `unicode-emoji-json` and provides web-compatible search names and slugs.
- `packages/core/src/chat-media/sticker-catalog.json` is the single metadata
  catalog for the 32 bundled stickers.
- Android packages the existing web sticker directory as an asset source, so
  the WebP files are not duplicated.
- `pnpm chat-media:verify` compares catalog IDs with `chatStickerIds`, the
  `send-message` allowlist, the latest database constraint, and bundled files.

## Android ownership

`MediaPickerViewModel` owns tab/query state, 300 ms GIF search debounce,
cursor pagination, deduplication, loading/error/empty states, connectivity, and
the picker-wide animation preference. `ChatViewModel` owns pending composer
media, mutual exclusion, selection revisions, idempotent retry IDs, confirmed
share registration, and GIF reporting. Sheet visibility, scroll position,
focus, and the single active transcript player stay local to Compose.

`OutgoingMessageContent` permits text, GIF-only, sticker-only, and text plus
one media item while rejecting empty content and GIF/sticker combinations.
Room schema 2 stores `sticker_id` and forward-compatible `gif_json`; migration
`MIGRATION_1_2` is always registered and destructive fallback is not enabled.

Supabase page loads batch-fetch `message_gifs`. Realtime message changes fetch
their optional GIF before entering Room, and send acknowledgements are enriched
with the submitted GIF because the RPC returns a base message row. Invalid
provider metadata is never exposed; a safe cache marker keeps the message
readable as “GIF unavailable.” Unknown sticker IDs similarly remain readable as
“Sticker unavailable.”

## Motion and accessibility

The empty emoji search uses AndroidX `EmojiPickerView`; searched emoji use the
shared catalog. The native picker receives an empty recent provider, so FISH
does not add recents or favorites. GIF picker previews animate only while the
system animator setting permits it and can be paused together. Composer and
transcript GIFs remain posters until Play is pressed. Transcript playback is
muted, looping, releases on disposal, pauses on lifecycle stop, and only one
message can play at once.

The sheet is a Material 3 `ModalBottomSheet` with platform back, scrim, swipe,
IME, and inset handling. The close, media, playback, send, and overflow controls
use the 48 dp FISH touch target or larger. Stickers include descriptive TalkBack
copy, KLIPY attribution remains visible, and reporting gives a calm notice
without a confirmation dialog.

## Verification

Run from the repository root:

```bash
pnpm chat-media:verify
pnpm android:verify-design
pnpm android:test
pnpm android:screenshots
pnpm android:instrumented
pnpm android:check
```

Instrumented migration/accessibility tests and screenshots require the same
device/emulator setup described in `apps/android/README.md`. Before release,
repeat a two-account Android/web interoperability pass against the target
Supabase project and confirm KLIPY search, share registration, attribution, and
reporting with production public keys.
