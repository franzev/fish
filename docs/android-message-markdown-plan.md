# Android message markdown implementation plan

Status: Implemented (2026-07-28). Written from a three-way audit of direct
chat across web, iOS, and Android.

---

## Outcome

An Android message bubble renders the same small markdown subset that web and
iOS already render. A coach who sends `**Try this**` sees bold text on every
client instead of literal asterisks on one of them.

## Why this is the next feature

A full direct-chat feature audit across the three clients found **no other
behavioural gap between the native apps**. Reactions, replies, typing, receipts,
edit, delete, search, attachments, voice, GIFs, presence, calling, offline cache,
offline outbox, push, quiet, pagination, shared content, copy, and unread state
are all built end to end on both platforms. Markdown rendering is the single
exception: web parses it (`apps/web/features/chat/components/message-body/message-body-parser.ts`),
iOS parses it (`apps/ios/FishKit/Sources/PersonalChat/Logic/MessageMarkdown.swift`),
and Android renders the raw string as plain text
(`apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/views/MessageBubble.kt:143`).

The parity registry already records the gap. `design/parity/native-components.json`
lists `MessageBody`, `MarkdownBlockView`, and `MarkdownListView` as
`"only": "ios"`. This plan pairs those three entries.

This is also a message-*integrity* problem, not a polish problem: the sender and
the receiver are looking at different text. For an audience that is reading in a
second language, stray `**` and `` ` `` characters are noise the product is
supposed to remove.

## Current baseline (verified 2026-07-28)

- Android renders the body as one `Text(text = body, style = FishTheme.typography.body)`
  inside the bubble `Column` (`views/MessageBubble.kt:130-152`). That single call
  is the entire swap point.
- Android has **no** markdown, `AnnotatedString`, `buildAnnotatedString`, or
  `SpanStyle` usage anywhere in `feature/chat` or `core/designsystem`.
- Android has **no** emoji-only handling. Web (`EMOJI_ONLY_RE`) and iOS
  (`Logic/EmojiOnlyMessage.swift`) both render an emoji-only message at display
  size.
- The bubble's accessibility string interpolates the raw body
  (`views/MessageBubble.kt:55-60`), so TalkBack currently reads the asterisks
  aloud.
- `LocalUriHandler` is already used in this file for link-preview taps
  (`views/MessageBubble.kt:222-228`), so link opening has an established
  precedent to reuse.
- Compose BOM is `2026.06.01`, so `LinkAnnotation.Url` + `withLink` are
  available; no deprecated `ClickableText` is needed.
- iOS's composition is `MessageBody` → `MarkdownBlockView` → `MarkdownListView`,
  with `MessageBody` owning the emoji-only text style and the foreground colour
  (`Views/MessageBody.swift`). Android mirrors that shape.

## Grammar being ported

Fixed and already specified twice. Blocks: fenced code (optional language),
headings `#`–`###`, blockquote, ordered/unordered lists with one level of
nesting, paragraph. Inline: `` `code` ``, `**bold**`, `*italic*`, `_italic_`,
`[label](href)`. Links are sanitised to `http:`, `https:`, and `mailto:` only;
anything else renders as its label text. No HTML, ever.

## Execution order

Each step ends in a working, shippable state. Steps 1 and 2 add unused code and
change nothing the user sees; step 4 is where behaviour changes.

1. Port the parser to Kotlin (pure logic, fully tested, unused).
2. Port emoji-only detection (pure logic, unused, independently revertible).
3. Add the Compose renderers (new components, not yet mounted).
4. Mount `MessageBody` in the bubble and fix the accessibility string.
5. Screenshot coverage, registry pairing, and full verification.

---

## Step 1 — Port the markdown grammar to Kotlin

### Goal

`feature/chat/.../logic/MessageMarkdown.kt` exposing a sealed block/inline tree
and `MessageMarkdownParser.parse(body: String): List<MessageMarkdownBlock>`,
plus `sanitizedHref(String): String?`. Output shape matches
`MessageMarkdown.swift` case for case.

### Why it is necessary

Rendering cannot be correct unless the grammar is identical. Keeping the parser
pure — no Compose, no Android framework types — means it is testable under
`pnpm android:test` with no device, and it is the only part of this feature with
real edge cases.

### Dependencies and assumptions

- No new libraries. Kotlin's `Regex` covers every pattern the other two
  implementations use; they are all plain regex, not Unicode-property regex.
- Ports the five regexes verbatim from `message-body-parser.ts:41-45` and
  `MessageMarkdown.swift:187-214` so all three stay legible as one grammar.
- Assumes the nesting rule matches iOS: a deeper-indented list attaches to the
  previous item as `children`, and a marker-kind change ends the list.

### Lean implementation

Mirror the Swift file's structure directly — same function names, same order:

```kotlin
sealed interface MessageMarkdownInline {
    data class Text(val text: String) : MessageMarkdownInline
    data class Bold(val text: String) : MessageMarkdownInline
    data class Italic(val text: String) : MessageMarkdownInline
    data class Code(val text: String) : MessageMarkdownInline
    data class Link(val label: String, val href: String) : MessageMarkdownInline
}

data class MessageMarkdownListItem(
    val content: List<MessageMarkdownInline>,
    val children: MessageMarkdownList? = null,
)

data class MessageMarkdownList(val ordered: Boolean, val items: List<MessageMarkdownListItem>)

sealed interface MessageMarkdownBlock {
    data class Code(val language: String?, val content: String) : MessageMarkdownBlock
    data class Heading(val level: Int, val content: List<MessageMarkdownInline>) : MessageMarkdownBlock
    data class Blockquote(val lines: List<List<MessageMarkdownInline>>) : MessageMarkdownBlock
    data class Bullets(val list: MessageMarkdownList) : MessageMarkdownBlock
    data class Paragraph(val lines: List<List<MessageMarkdownInline>>) : MessageMarkdownBlock
}
```

`parse` walks lines with an index, in the same precedence order as the other two
ports: fence → heading → blockquote → list → paragraph. `parseInline` uses one
alternation `Regex` and walks `findAll` matches, emitting the gap text between
matches as `Text`, exactly as `MessageMarkdown.swift:146-175` does.

### Working-state checkpoint

New file plus its test. Nothing imports it. The app builds and behaves exactly
as before.

### Verification

- New `feature/chat/src/test/kotlin/.../logic/MessageMarkdownTest.kt` mirroring
  the cases in `apps/ios/FishKit/Tests/PersonalChatTests/MessageMarkdownTests.swift`
  one for one, plus the inline cases from `message-body-parser.test.ts`.
- Cover explicitly: nested list attachment, ordered vs unordered switch ending a
  list, fence with and without a language, unterminated fence, `javascript:` and
  relative hrefs falling back to label text, and inline runs mixing code/bold/link.
- `pnpm android:test`.

---

## Step 2 — Port emoji-only detection

### Goal

`logic/EmojiOnlyMessage.kt` with `isEmojiOnly(body: String): Boolean`, matching
web's `EMOJI_ONLY_RE` and iOS's `EmojiOnlyMessage`.

### Why it is necessary

A message that is only emoji renders at display size on web and iOS and at body
size on Android. It is the same bubble, the same code path, and closing it here
avoids a second pass over this file later.

### Dependencies and assumptions

- **This is the one step with a real unknown.** Web's regex leans on
  `\p{Extended_Pictographic}`, `\p{Regional_Indicator}`, and `\p{Emoji_Modifier}`.
  Java/Kotlin regex supports only a limited set of Unicode binary properties, and
  these are expected to be absent — but no JDK was available on this machine to
  confirm it, so **the first action in this step is a two-minute probe**:
  `Pattern.compile("\\p{IsExtended_Pictographic}")` in a scratch test. If it
  compiles, port the regex verbatim and skip the fallback below.
- Implement by iterating code points instead: strip whitespace, then accept only
  code points that are emoji presentation, regional indicators, emoji modifiers,
  keycap sequences, variation selectors, and ZWJ. Reject if any other code point
  appears or if the result is empty.
- Assumes `minSdk` is high enough for `String.codePoints()`; the actions sheet
  already calls it (`views/ChatMessageActionsSheet.kt:165`), so it is available.

### Working-state checkpoint

Second unused pure file. Still no behaviour change. **If this step proves
fiddly, drop it** — steps 3–5 do not depend on it, and the markdown gap is the
larger one. Keeping it separate is deliberate for exactly that reason.

### Verification

Unit test with the web test's cases (`message-body-parser.test.ts:26-29`):
`" 👩🏽‍💻 "` true, `"🇵🇭"` true, `"1"` false, `"😀 😀"` false, plus `""` false
and `"😀 hi"` false.

---

## Step 3 — Add the Compose renderers

### Goal

Three new files under `feature/chat/.../views/`, one public composable each, as
the parity checker requires:

- `MessageBody.kt` — `MessageBody(body: String, isOutgoing: Boolean)`; parses,
  lays blocks out in a `Column` with `FishTheme.spacing.sm`, and picks
  `display` vs `body` typography via `isEmojiOnly`.
- `MarkdownBlockView.kt` — renders one block.
- `MarkdownListView.kt` — renders a list, recursing for nesting.

### Why it is necessary

This is the rendering itself, and splitting it this way is not decomposition for
its own sake: `pnpm parity:verify` fails the build on a file declaring more than
one public component, and these three names already exist in the registry as
iOS-only entries waiting for an Android counterpart.

### Dependencies and assumptions

- Step 1; step 2 if it landed (otherwise `MessageBody` just always uses `body`).
- **Design tokens only.** Map iOS's treatment onto existing Android tokens:
  `heading`/`label` for headings, `ui` for code, `caption` for the code-fence
  language, `display` for emoji-only, `body` otherwise; `surface` for the
  incoming code-block fill (the incoming bubble itself is `surfaceAlt`, so the
  fence needs a genuinely distinct token or it disappears into its own
  bubble — matching iOS's `surface`/`surface2` pair, which are two different
  values for exactly this reason), `onPrimary`-at-reduced-alpha for outgoing,
  `muted` for the language caption; `FishTheme.spacing.*` and
  `FishTheme.radii.control` for the code-block corner. No new token is
  introduced by this plan.
- Inline styling uses `buildAnnotatedString` with `SpanStyle`
  (`FontWeight.Bold`, `FontStyle.Italic`, `FontFamily.Monospace`) and
  `withLink(LinkAnnotation.Url(href))` for links. `withLink` is the reason no
  click-position plumbing or `ClickableText` is needed; it also gives TalkBack a
  real link role for free.
- Code blocks scroll horizontally (`Modifier.horizontalScroll`), matching iOS's
  `ScrollView(.horizontal)`, so a long line never forces the bubble wide.

### Working-state checkpoint

The components exist and compile. `MessageBubble` still renders plain `Text`, so
the app is unchanged. Add a `@Preview` for each so they can be inspected in
isolation before being mounted.

### Verification

`pnpm android:lint` and `pnpm android:assemble`. Inspect the previews in Android
Studio for the treatment of each block kind in both themes.

---

## Step 4 — Mount it in the bubble and fix the accessibility string

### Goal

The bubble renders `MessageBody(body = message.body, isOutgoing = message.isOutgoing)`
for real messages, and the accessibility `contentDescription` reads plain text
rather than markdown syntax.

### Why it is necessary

Steps 1–3 are inert without this. The accessibility half is not optional: the
bubble's `clearAndSetSemantics` block currently feeds the raw body into
`R.string.message_accessibility`, so TalkBack reads "star star Try this star
star". Fixing it in the same step keeps the sighted and screen-reader
experiences from diverging.

### Dependencies and assumptions

- Steps 1 and 3.
- The deleted-message placeholder stays a plain `Text` with the existing muted
  colour. It is a localised string, not user content, and must never be parsed.
- The `if (message.deleted || message.body.isNotBlank())` gate is unchanged.
- Assumes flattening for accessibility is a plain-text join of the parsed tree.
  Add `MessageMarkdownParser.plainText(body: String): String` in step 1's file
  for this — it is a few lines over the same tree and avoids a second regex pass.

### Lean implementation

In `views/MessageBubble.kt`, replace the single `Text(...)` at :143 with a branch:
the deleted placeholder keeps today's `Text`; otherwise `MessageBody(...)`. The
`body` local used for semantics becomes
`MessageMarkdownParser.plainText(message.body)` for non-deleted messages.

### Working-state checkpoint

The feature is live and shippable. Bold, italic, code, links, lists, quotes,
headings, and fenced code all render in the transcript on Android.

### Verification

- `pnpm android:test` — existing `ChatViewModelTest` and the accessibility test
  must stay green.
- `pnpm android:instrumented` for `ChatAccessibilityTest`; extend it with one
  case asserting the announced text for a markdown body contains no `*` or
  `` ` `` characters.
- Manual: send a message containing each block kind between two accounts and
  confirm it matches the web and iOS rendering of the same string.

---

## Step 5 — Screenshot coverage, registry, and full verification

### Goal

Recorded light and dark baselines for markdown bubbles, the three registry
entries paired, and a clean `pnpm android:check`.

### Why it is necessary

This repo treats recorded images as the parity contract, and
`pnpm parity:verify` runs inside `android:check` — leaving the registry stale
fails the build. The screenshots are also the only artefact that shows the
markdown treatment is calm rather than busy.

### Dependencies and assumptions

- Step 4.
- Assumes new baselines are recorded, then **reviewed by eye**. A record-mode
  pass proves nothing on its own; each new PNG gets checked against
  `docs/ui-ux-agent-guidelines.md` before it is committed.

### Lean implementation

- Extend `MessageBubbleStates()` in
  `feature/chat/src/screenshotTest/kotlin/.../ChatComponentScreenshotTest.kt`
  with one incoming and one outgoing markdown message covering bold, inline
  code, a link, a two-item list, and a fenced block. Both existing light and
  dark previews pick them up; no new preview function is needed.
- In `design/parity/native-components.json`, change `MessageBody`,
  `MarkdownBlockView`, and `MarkdownListView` from `"only": "ios"` to paired
  entries with the new Android `file`/`symbol`/`visibility`, keeping the
  existing `props` lists (`body`/`isOutgoing`, `block`/`isOutgoing`,
  `list`/`isOutgoing`) aligned.

### Verification

`pnpm android:check` end to end (design verify, parity verify, unit tests,
release assemble, screenshot validation), then a visual pass over every changed
or added PNG.

---

## Deferred until there is a concrete need

- **Tables, images, strikethrough, task lists, and autolinked bare URLs.**
  None are in the shared grammar. Adding any of them is a three-platform change
  and a product decision, not an Android one.
- **Syntax highlighting in code blocks.** iOS and web both render code
  unhighlighted; matching them is the parity requirement.
- **More than one level of list nesting.** All three parsers stop there.
- **Markdown in conversation-list previews, search results, and notifications.**
  Those are single-line summaries where plain text is the better read; iOS does
  not parse them either.
- **Markdown in the composer** — live preview, a formatting toolbar, or
  syntax-aware editing. Sending stays plain typing; only rendering changes.
- **A shared JSON vector fixture for markdown.** The repo uses fixture vectors
  for reducer state, but markdown parity is currently held by hand-written tests
  on each platform. Mirroring iOS's test file is the smaller, consistent move.
  Promote to a shared vector only if the three implementations actually drift.
- **Extracting a shared markdown contract into `packages/core`.** The natives
  cannot consume TypeScript, so this would mean a code generator for two ~200
  line files that have not changed since they were written.

## Assumptions and tradeoffs

- **No markdown library, deliberately.** The instinct to prefer an existing
  library is right in general and wrong here. The requirement is not "render
  markdown", it is "render exactly the subset web and iOS already render, and
  nothing else". A general library (commonmark-java and friends) would render
  raw HTML, tables, and autolinks that the other two clients do not, which turns
  a parity fix into a new parity break — and would still need a custom Compose
  renderer, since none of them emit `AnnotatedString`. The grammar is ~200 lines
  and already specified twice; a third instance is cheaper and safer than
  configuring a library into a smaller subset than it wants to be.
- **Porting a third copy instead of sharing one.** Accepted cost: a grammar
  change now means three edits. It is the pattern the repo already chose for
  iOS, and the mitigation is the mirrored test files, which fail loudly on drift.
- **Monospace comes from the platform, not the design system.** There is no mono
  token in `TypeTokens`, and iOS gets its mono from the system too
  (`inlinePresentationIntent = .code`). `FontFamily.Monospace` matches that. If
  a branded mono is ever wanted, it belongs in the design system and lands on
  both platforms at once.
- **Blockquote treatment is the one place worth a decision.** iOS draws a
  1px stroked border (`MarkdownBlockView.swift:34-40`), but the standing
  preference in this codebase is fills over outlines. This plan mirrors iOS so
  the two natives agree today; switching both to a `surfaceAlt` fill or a
  leading rule is a small, separate change that should touch iOS and Android
  together rather than being smuggled in here.
- **Emoji-only detection is approximate.** The code-point approach will not be
  byte-identical to the JS regex for exotic sequences. It is a text-size
  decision, so a rare miss degrades to normal body size — which is exactly
  today's behaviour, and why the step is separable.
- **Scope is the transcript bubble only.** Every other surface that shows a
  message body keeps rendering plain text, matching iOS.
