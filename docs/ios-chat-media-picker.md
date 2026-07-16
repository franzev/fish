# iOS chat media picker

The iOS emoji, GIF, and sticker picker is implemented inside the existing
`FishKit` package: picker models, logic, and views live in `PersonalChat`,
and a new `ChatData` target holds the provider-neutral GIF types, the
`GifProviding` port, and the live KLIPY adapter. It reuses the shipped
Supabase message schema contracts; there is no iOS-only backend. The planning
document is `docs/ios-chat-media-picker-plan.md`.

## Shared contracts

- `packages/core/src/chat-media/emoji-groups.json` and
  `sticker-catalog.json` are synced verbatim into
  `PersonalChat/Resources/ChatMedia/` (with the 32 sticker WebPs) by
  `pnpm ios:chat-media`, because SwiftPM cannot reference files outside the
  package. `pnpm ios:chat-media:check` and the extended
  `pnpm chat-media:verify` fail on drift.
- `ChatGif` mirrors `packages/core/src/chat.ts` field-for-field; a Codable
  test pins the exact wire key set. `KlipyGifProvider` sends the same
  parameters as the web client (`client_key=fish_chat`, `contentfilter=high`,
  `media_filter=preview,tinymp4,mp4`, limit ≤ 24, query ≤ 50 chars) and drops
  any result whose media host fails the server's
  `static\d*.klipy.com` allowlist.
- New shared tokens: `Metrics.emojiGlyph/stickerTile/chatGifSelection/`
  `chatGifMaxWidth` and `AspectRatio.gifTile`, generated from
  `design/tokens/fish.tokens.json`.

## iOS ownership

`GifSearchModel` (`PersonalChat/ViewModels/`, the app's first `@Observable`)
owns tab-independent GIF state: 300 ms debounce with an injected `Clock`
(immediate on clear), cursor pagination with id-level deduplication,
generation-stamped staleness guards, loading/ready/empty/notice states, and
the session pause-all preference. Views render its `GifPanelState` value
projection, so panels stay stateless and snapshot-deterministic.

The host owns staged media through a `ComposerSelection` binding —
`.none` / `.gif(ChatGif, searchQuery:)` / `.sticker(ChatSticker)` — which
encodes GIF/sticker mutual exclusion in the type. Text combines with either.
Sheet visibility is local `@State` in `PersonalChatScreen`. Send, retry
restore, idempotent `clientRequestId`s, `registerShare`, GIF reporting, and
realtime hydration belong to the future ChatData/Supabase milestone; the
`onSend` surface consumes draft + selection as defined in the plan.

`MessageUiModel` gained `media: MessageMedia?`
(`.sticker(id:)` / `.gif` / `.gifUnavailable`). Unknown sticker ids render
"Sticker unavailable" and invalid GIF metadata renders "GIF unavailable" —
persisted messages stay readable on old clients. Emoji-only bodies render at
display size, matching web.

## Motion and accessibility

There is no system emoji picker view on iOS, so browse and search both use
the shared catalog — identical vocabulary to web. GIFs are MP4 renditions:
posters render first (file posters synchronously, remote over a surface
fill), playback is a muted looping `AVPlayerLayer` created on appear and torn
down on disappear, and only visible tiles hold players. Reduce Motion (or the
picker's pause-all toggle) keeps everything on posters until an explicit
play; transcript GIFs carry their own play/pause control and a visible
"Via KLIPY" attribution link.

The picker is a detent sheet (`.medium`/`.large`) with an explicit
"Close expression picker" control; every control keeps the web accessible
names, 44 pt targets, and token-pure styling (guard-enforced, including the
new ChatData import rules). Message bubbles remain one combined VoiceOver
element whose label weaves in the media description; GIF playback and
attribution stay separately focusable.

## Verification

Run from the repository root:

```bash
pnpm ios:tokens:check
pnpm ios:chat-media:check
pnpm chat-media:verify
pnpm ios:guard
pnpm ios:test
pnpm ios:catalog
```

The catalog's "Media picker" page renders every tab offline via
`FixtureGifProvider` (pages/empty/failing/unavailable behaviors) and is swept
by `performAccessibilityAudit`. Set `KLIPY_API_KEY` when generating the
catalog project for live KLIPY search with a bundle-restricted debug key.
Before release, repeat a two-account iOS/web interoperability pass against
the target Supabase project and confirm KLIPY search, share registration,
attribution, and reporting with production keys.
