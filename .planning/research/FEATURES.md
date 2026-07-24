# Feature Research

**Domain:** Per-conversation shared-content gallery for native direct messaging
**Project:** FISH v1.3 Shared conversation content
**Researched:** 2026-07-22
**Confidence:** HIGH

## Product Recommendation

Build a destination named **Shared content**, not a general content browser. It belongs to one direct conversation, opens from both the conversation header and conversation details, and contains only items that already came through that conversation's shipped sending contracts.

Use four plain, stable category labels in this order: **Media**, **Files**, **Links**, and **Voice**. Show only categories that contain at least one current item; when exactly one category exists, omit the category control entirely. Do not add an **All** category in v1.3: it repeats the same items, adds a fifth choice, and makes mixed content harder to scan. Keep the category order identical on iOS and Android.

| Category | Include now | Explicitly exclude |
|---|---|---|
| Media | Processed photo attachments; MP4 video attachments; provider GIF messages; bundled sticker messages | Avatars, call video, link-preview images, emoji-only text, reactions, new media capture/upload behavior |
| Files | PDF, plain text, CSV, DOCX, XLSX, PPTX attachments; unknown future `file` kinds as a readable unavailable/file fallback | Arbitrary binaries, ZIP archives, legacy Office formats, executables, new upload MIME types |
| Links | Exactly the first safe public HTTP(S) URL in a message, matching the existing `firstPublicHttpUrl` contract; preview metadata when available | Private/local URLs, non-HTTP schemes, multiple-URL indexing, locations, contacts, calendar items |
| Voice | Existing voice-message attachment contract: `audio/mp4` only | General audio files, music library items, transcripts, waveform generation, any new recorder/sender pipeline |

This classification is grounded in the shipped Android/iOS models and migrations. Video and voice sending already exist in the repository; v1.3 may surface those existing messages but must not create or modify either sending pipeline.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a messaging shared-content view. Missing these makes the gallery feel incomplete or unsafe.

| Feature | Why Expected | Complexity | Notes |
|---|---|---:|---|
| Conversation-scoped access | Messaging galleries conventionally show content from the conversation the user is viewing, never a cross-account catalog | HIGH | Every read must remain behind conversation-membership RLS. Never accept a client-supplied user filter as authorization. Empty/not-found responses must not reveal that another conversation exists. |
| Two agreed entry points | Users look in both the active conversation header and its details view | MEDIUM | Header entry is a quiet navigation control with the accessible name “Shared content.” Details uses a labeled row. Neither is a primary action. Preserve a normal back route to the originating conversation/details view. |
| Clear content categories | Apple Messages and Signal group shared content by familiar type | MEDIUM | Use Media, Files, Links, Voice. Media includes photo, video, GIF, and sticker. Avoid icons without labels. Do not expose empty categories as dead choices. |
| Newest-first, deterministic ordering | Users usually seek something shared recently and expect stable scroll position | HIGH | Sort by source-message `created_at DESC, message_id DESC`, then attachment `position ASC` within the same message. Use keyset pagination, not an unbounded transcript fetch or offset pagination. |
| Visible sender and date context | Shared content is meaningful because of who sent it and when | MEDIUM | Every item detail shows sender and localized date/time. Media tiles should expose concise visible metadata below the preview; at large text sizes, reflow to a one-column row. Accessibility labels include type/name, sender, and date without repeating visible control roles. |
| Preview or safe open | Tapping an item should reveal the content, not an unexplained action menu | HIGH | Photos, video, GIFs, and stickers open a native preview. Voice opens or continues in an accessible player. Files open through the existing verified download and system viewer boundary. Links open with the existing external-link safety policy. No autoplay for video, GIF, or voice by default. |
| Jump to source message | Users need the surrounding coaching context | HIGH | “Go to message” loads a bounded window around the source message when it is outside the local transcript, then focuses it. A brief non-color highlight may orient the user; remove motion when Reduce Motion is enabled. If the message disappeared, keep the gallery stable and say “That message is no longer available.” |
| Context-appropriate native actions | Users expect the platform share/save behavior they already know | HIGH | Use the iOS activity view and Android Sharesheet; do not build custom target pickers. See the action matrix below. Refresh expired signed URLs behind the action. Preserve the gallery if the native sheet is cancelled. |
| Sender-only deletion of the source message | Permissions and consequences must match chat, not invent attachment ownership rules | HIGH | Only the source-message sender sees **Delete message**. The command uses the existing `delete_chat_message` boundary. Other members never see a disabled or teasing delete action. Do not allow deleting one attachment independently. |
| Truthful destructive confirmation | A gallery item may be only one part of a multi-item or text-plus-media message | MEDIUM | Confirm the real consequence: deleting the message for everyone removes its text, every attachment/GIF/sticker/link associated with it, and the gallery entries. Name the number/type of affected items when more than one exists. Safe action is visually dominant; destructive action is explicit but not primary-styled. |
| Realtime consistency | Deletion or new content in chat should not leave stale gallery entries | HIGH | Insert only server-confirmed sent content. On message deletion, remove every index item sharing that source-message ID and preserve scroll position. On reconnect, perform a bounded reconciliation. Never surface pending local drafts/uploads in shared content. |
| Complete loading, empty, offline, and failure states | A blank or contradictory gallery erodes trust | HIGH | Follow the state contract below. Cached content remains visible through transient failures. Retry only the failed boundary and prevent duplicate requests. |
| Cross-platform semantic parity | Clients and coaches may switch devices; privacy and permissions cannot differ | HIGH | iOS and Android share category membership, ordering, eligibility, deletion effects, pagination semantics, state meanings, and calm copy intent. Native presentation and platform action labels may differ where the operating system differs. |
| Mobile accessibility baseline | A gallery is unusable if unlabeled grids, media, or hidden gestures block navigation | HIGH | Minimum 44×44 interaction targets; Dynamic Type/font scaling and RTL; VoiceOver/TalkBack reading order; visible focus; named controls; no color-only status; no gesture-only action; reduced motion; playback controls with state/value; decorative thumbnails silent. |

### Native Action Matrix

Do not display Share, Save, and Download as three permanent buttons on every tile. Item tap is the one obvious action; the preview or a labeled overflow/action sheet exposes only actions that make sense for that content.

| Content | Primary item behavior | Secondary native actions | Not offered |
|---|---|---|---|
| Photo | Full-screen preview | Share; Save to Photos/gallery; Save to Files/device when the platform provides it; Go to message; sender-only Delete message | Open in browser |
| MP4 video | Preview with user-initiated playback | Share; Save video; Save/download to Files/device; Go to message; sender-only Delete message | Autoplay |
| GIF | Preview with play/pause and reduced-motion/static-poster behavior | Share link or export rendition only if provider terms permit; Go to message; sender-only Delete message | Unverified provider-media download |
| Sticker | Static preview using bundled accessible description | Share/export only if FISH has rights to redistribute the bundled asset; Go to message; sender-only Delete message | Treating sticker as a new attachment upload |
| Voice message | Player with play/pause, elapsed/duration, and existing speed behavior | Share; Save/download audio; Go to message; sender-only Delete message | General audio-library browsing, transcript generation |
| PDF/text/CSV/Office file | Verified download, then system viewer | Share; Save/download to user-chosen location; Go to message; sender-only Delete message | In-app editing |
| Link | Open through trusted external-link policy | Share link; Copy link; Go to message; sender-only Delete message | Save/download, unless the destination itself provides it |
| Unavailable item | Stable placeholder naming the item/type when known | Go to message; sender-only Delete message | Preview, share, save, or download |

“Save” means placing media in the platform media library where appropriate. “Download” means writing a file through the platform's user-visible file/storage flow. Where the platform presents these as one system action, show one action rather than duplicating terminology.

### Required State Contract

| State | Required behavior | Accessibility / recovery |
|---|---|---|
| Initial loading | Layout-stable skeletons matching the active category; no blank screen; category controls wait until eligibility is known | Expose one polite loading status, not an announcement per tile |
| Loaded | Newest items first; metadata visible; lazy thumbnail/media loading; bounded page size | Screen reader order follows visual order; loading more does not move focus |
| Loading earlier | Keep loaded items interactive; append a quiet stable progress row | Announce “Loading earlier shared content” once |
| Conversation empty | “No shared content here yet.” No upload/send call to action | No decorative action gallery and no blame |
| Category empty after in-session deletion | Keep the selected category until the user leaves; say “No [category] left in this conversation.” On next open, omit the empty category | Prevent an unexpected tab jump immediately after deletion |
| Offline with cache | Show cached items and a persistent quiet notice: “Offline. Showing saved shared content.” | Cached preview/share/save may work; network-required actions explain why they are unavailable |
| Offline without cache | “Shared content isn’t available offline yet.” No false empty state | Retry becomes available on reconnect; announce reconnection once |
| Initial request failure | Calm inline notice plus one Retry action | “Shared content didn’t load. Check your connection and try again.” Preserve back navigation |
| Earlier-page failure | Keep all loaded items; stable end-of-list notice plus Retry | Never clear the gallery or auto-retry indefinitely |
| Thumbnail/preview failure | Item-sized placeholder; retain sender/date/name and source navigation | “Preview unavailable” is text, not only an icon |
| Signed URL expired | Refresh once transparently; if refresh fails, retain the item and offer Retry | Do not expose provider codes or expired URLs |
| Delete in progress | Confirmation dismisses into a busy state for that source message; prevent duplicate deletion | Do not remove content until server acceptance; announce completion/failure |
| Delete failure | Keep every affected item and show calm guidance | “That message wasn’t deleted. Try again.” |
| Deleted remotely | Remove all items tied to the source message; preserve nearby position | If focused, move focus to the next logical item and announce removal |
| Source unavailable during jump | Stay in Shared content with the item state reconciled | “That message is no longer available.” |
| Native open/share cancelled | Return unchanged to the same item/category/scroll position | Cancellation is not an error and produces no toast |

### Differentiators (Competitive Advantage)

These are valuable because they reinforce FISH's calm, coaching-centered model rather than expanding its product surface.

| Feature | Value Proposition | Complexity | Notes |
|---|---|---:|---|
| Dead-choice removal | Users see only populated categories, and no category control when only one type exists | MEDIUM | Category order remains stable. This follows Apple Messages' established behavior while reducing navigation choices. |
| Context-first retrieval | Sender/date are not hidden, and every item returns directly to its coaching conversation context | HIGH | “Go to message” is more important than rich gallery management. Preserve a return path back to the same gallery position. |
| Consequence-aware deletion | The confirmation explains the whole source message and all affected shared items | MEDIUM | Prevents the common false impression that one gallery tile can be deleted independently. Especially important for batches of up to five attachments. |
| Calm offline continuity | Cached items remain useful, while unavailable actions are honest and local | HIGH | Never label “offline with no cache” as an empty conversation. Never clear thumbnails solely because a refresh failed. |
| Cognitive-accessible media collection | Plain labels, stable order, reduced motion, no autoplay, and one obvious item action | MEDIUM | Treat this as core accessibility for neurodivergent English learners, not visual polish. |
| Contract-tested parity | One fixture-backed classification/action/state contract drives native implementations | HIGH | Extend the existing cross-platform contract style with fixtures covering MIME/category mapping, deletion fan-out, pagination, and offline states. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Global “all conversations” gallery | Convenience and storage management | Violates per-conversation/direct-chat scope, raises cross-conversation privacy risk, and creates another mobile destination | Keep Shared content conversation-scoped |
| New video/audio-file/voice sending | Gallery makes missing formats visible | Explicitly outside v1.3; creates capture, permission, upload, moderation, storage, and accessibility scope | Surface only already persisted MP4 video and `audio/mp4` voice messages |
| Upload/send from Shared content | Seems like a convenient shortcut | Turns retrieval into a competing composer, duplicates chat, and adds a primary action | Return to the conversation to send |
| Search, sort, and filter builders | Helps very large histories | Adds controls before real gallery volume proves the need; message search already exists | Newest-first categories plus Go to message; measure usage before adding search |
| Bulk select, bulk share, bulk download, bulk delete | Power-user efficiency | High cognitive and permission complexity; mixed MIME sharing is discouraged on Android; bulk deletion hides source-message fan-out | One item/source message at a time in v1.3 |
| Per-attachment deletion | Seems precise | Existing delete contract is message-level; would leave ambiguous text/batch state and require a new backend mutation model | Delete the source message for everyone with explicit consequence copy |
| “Delete for me” or recipient delete | Familiar in some messengers | Conflicts with agreed sender-only deletion and creates divergent local histories | Only sender can Delete message for everyone; recipients have no delete control |
| Custom share-target picker | Branding and control | Duplicates platform behavior, increases choice design, and loses trusted ranking/accessibility | iOS activity view and Android Sharesheet |
| Automatic saving/downloading | Fast repeat access | Consumes storage/data, surprises users, and broadens privacy exposure | Explicit per-item save/download; cache only for bounded app continuity |
| Albums, favorites, pins, labels, and collections | Organization | Turns a calm retrieval view into content management and duplicates future learning/product surfaces | Preserve sender/date and source context; validate a real need first |
| AI/OCR/object search, summaries, or transcripts | Powerful discovery | Unvalidated AI/learning behavior, privacy cost, large implementation surface | Defer; first validate direct categories and message jump with clients/coaches |
| Counts, badges, scores, or “most shared” rankings | Signals activity | Adds judgement/attention pressure and no task value | Quiet category labels; optional non-prominent total only if usability testing requires it |
| Autoplay, animated grids, or looping GIF walls | Makes media feel lively | Distracting, data-heavy, and hostile to reduced-motion users | Static poster in grid; user-initiated playback in preview |
| Call recordings or call-activity gallery entries | Calls are part of chat history | No supported recording content contract; call activity is history, not shared content | Leave call rows in the transcript |
| Avatars, reactions, and emoji-only messages | They are visual assets | They are message decoration/text, not shared content users retrieve as files | Keep them in chat and existing search only |
| Multiple links per message in v1.3 | More complete URL discovery | Current contract stores/previews the first safe public URL only; expanding extraction changes indexing and security semantics | Index exactly the first safe public HTTP(S) URL now; research multi-link support later |

## Feature Dependencies

```text
[Conversation membership + RLS]
    └──requires──> [Conversation-scoped gallery query]
                       ├──requires──> [Canonical content classification]
                       ├──requires──> [Deleted/pending content exclusion]
                       └──requires──> [Keyset pagination + category eligibility]

[Gallery item identity = source message id + content discriminator/position]
    ├──requires──> [Sender/date context]
    ├──requires──> [Jump-to-message window fetch]
    └──requires──> [Delete-source-message fan-out]

[Preview/open]
    └──requires──> [Signed URL refresh + current verified download boundary]
                       └──enables──> [Native share/save/download]

[Local gallery cache]
    └──enables──> [Offline-with-cache state + stable reconnect recovery]

[Cross-platform fixtures]
    └──guards──> [Category, ordering, state, permission, and deletion parity]

[New sending pipelines] ──conflicts──> [v1.3 retrieval-only scope]
```

### Dependency Notes

- **The gallery query requires an explicit backend read contract.** Reusing the transcript's bounded message window would omit older shared content; loading the whole transcript would regress performance. Prefer a conversation-scoped, RLS-protected SQL function/view with keyset pagination that returns source-message identity, sender/date, content discriminator, stable attachment metadata, and category-availability flags.
- **Link indexing must match the existing security contract.** The current sender pipeline recognizes the first safe public HTTP(S) URL. A metadata fetch failure must not cause an otherwise valid shared link to disappear; persist or derive the canonical URL independently of preview metadata. Do not broaden schemes or private-host rules in the gallery.
- **Jump to message requires an around-message fetch.** The current transcript loads a bounded newest window. A gallery item can point outside it, so native stores need a bounded fetch around a permitted source message plus deterministic focus behavior.
- **Deletion fan-out is message-based.** A single message may contribute several attachment tiles and a body/link. A successful `delete_chat_message` event invalidates them all. The server, not gallery UI state, remains authoritative.
- **Native export depends on verified local bytes.** Reuse the existing signed-URL refresh, trusted-host, byte-size, MIME, and signature validation before handing files to platform viewers or share sheets. User-visible save destinations need separate platform adapters.
- **GIF/sticker export depends on rights.** Preview and source navigation are safe launch behavior. Enabling media export requires confirmation that provider and bundled-asset terms permit redistribution.
- **Offline parity requires bounded persistence.** Android already persists chat/attachment metadata locally; iOS has draft/cache pieces but the gallery needs an equivalent, identity-scoped metadata cache. Purge on account identity change.

## MVP Definition

### Launch With (v1.3)

- [ ] Conversation header entry and conversation-details entry on Android and iOS
- [ ] Media, Files, Links, and Voice classification for the exact shipped types listed above
- [ ] RLS-protected, newest-first keyset paging independent from transcript paging
- [ ] Preview/open with sender and localized date context
- [ ] Go to message, including bounded around-message loading and graceful missing-source recovery
- [ ] Platform-native, type-appropriate share/save/download actions
- [ ] Sender-only Delete message confirmation and full source-message fan-out
- [ ] Realtime insert/delete reconciliation and identity-safe cache handling
- [ ] Complete loading, partial, empty, offline, failure, retry, and expired-URL states
- [ ] VoiceOver/TalkBack, large text, RTL, reduced motion, target-size, and no-autoplay coverage
- [ ] Fixture-backed iOS/Android parity tests for classification, permissions, ordering, states, and deletion

### Add After Validation (v1.x)

- [ ] Gallery search — only if real conversation volume makes categories insufficient; begin with local filename/hostname/sender search, not AI
- [ ] Multi-select share/save — only if observed repeated one-by-one use justifies the cognitive and mixed-MIME complexity
- [ ] Pin/favorite — only if clients and coaches repeatedly need to retrieve the same items and message context is insufficient
- [ ] Multiple links per source message — only after a shared extraction/storage/security contract is designed and migrated
- [ ] Explicit download management — only if large histories create a proven storage/data problem

### Future Consideration (v2+)

- [ ] Cross-conversation storage management — requires an explicit mobile scope change and privacy design
- [ ] Transcripts, OCR, semantic search, or AI summaries — requires coach validation, consent/privacy design, and evaluation work
- [ ] New file/media sending formats — separate milestone with sending, security, storage, moderation, and accessibility requirements

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---:|---:|---:|
| Secure conversation-scoped gallery query | HIGH | HIGH | P1 |
| Four-category classification contract | HIGH | MEDIUM | P1 |
| Header + details entry | HIGH | MEDIUM | P1 |
| Sender/date and accessible item identity | HIGH | MEDIUM | P1 |
| Preview/open | HIGH | HIGH | P1 |
| Go to source message | HIGH | HIGH | P1 |
| Native share/save/download | HIGH | HIGH | P1 |
| Sender-only source-message deletion | HIGH | HIGH | P1 |
| Loading/empty/offline/error recovery | HIGH | HIGH | P1 |
| Cross-platform fixture parity | HIGH | HIGH | P1 |
| Search | MEDIUM | HIGH | P2 after validation |
| Multi-select/bulk actions | LOW | HIGH | P3 |
| Pins/favorites | LOW | MEDIUM | P3 |
| Cross-conversation gallery | LOW for current scope | HIGH | Do not build |
| New sender pipelines | Out of scope | HIGH | Do not build |

**Priority key:**

- P1: Must have for v1.3 launch
- P2: Add only after observed need
- P3: Future consideration
- Do not build: Conflicts with agreed milestone or native scope

## Competitor Feature Analysis

| Feature | Signal | Apple Messages | FISH v1.3 approach |
|---|---|---|---|
| Entry | Contact name → chat settings → Shared media / All Media | Contact/group at top → content categories | Direct quiet header entry plus labeled details row, as already agreed |
| Categories | Android: Media, Files, Audio, All; iOS: Media, Audio | Photos, Links, Documents and other populated types; absent categories are hidden | Media, Files, Links, Voice; populated categories only; omit category control when one remains; no redundant All |
| Preview | Select an item; swipe through media | Open the selected attachment/content | Type-appropriate native preview with no autoplay and accessible controls |
| Save/share | Platform-specific save/share actions | Attachment share sheet supports copy/save/print as appropriate | Native system actions, filtered by content type; no custom target chooser |
| Source context | Limited in the cited shared-media article | “From [Name]” and shared-content surfaces can return to Messages context | Sender/date always available; explicit Go to message is P1 |
| Delete | Sender may delete a recently sent message for everyone; best effort | Attachment actions include delete within Messages semantics | Existing FISH server command; sender only; no arbitrary time window added; confirmation names whole-message consequences |
| Calmness adaptation | Broad utility categories and bulk storage tools | Many system-wide content types and pinning | Only direct-conversation retrieval; no bulk tools, pins, global gallery, or new sending |

## Scope Boundary Checklist

| In v1.3 | Out of v1.3 |
|---|---|
| Native Android and iOS direct conversations only | Web gallery, home/dashboard, community, marketplace, lessons, assignments |
| Existing persisted sent content only | Pending drafts/uploads and failed local sends |
| Photo, current MP4 video, GIF, sticker, supported files, first safe public link, current voice messages | New video, arbitrary audio-file, or voice capture/sending pipelines |
| Member read via RLS; sender-only source-message deletion via existing Edge Function/RPC | Client-side authorization, recipient deletion, attachment-only deletion |
| Preview/open, context, source jump, native export actions | Editing files/media, forwarding workflow, upload shortcut |
| Bounded paging/cache/reconciliation | Whole-history eager fetch, automatic permanent download |
| Equivalent behavior and permissions across platforms | Pixel-identical UI or custom replacements for native system sheets |

## Confidence Assessment

| Area | Confidence | Basis |
|---|---|---|
| Supported content inventory | HIGH | Direct inspection of current Android/iOS models, validation rules, migrations, send contracts, and native attachment viewers |
| Category recommendation | HIGH | Cross-checked against current Signal and Apple Messages official support plus FISH's choice-reduction rules |
| Native share/save behavior | HIGH | Current Apple and Android official platform documentation plus existing repository adapters |
| Deletion semantics | HIGH | Existing `delete_chat_message` RPC and native sender-only action checks; agreed milestone scope |
| Loading/offline/error contract | HIGH | FISH's authoritative UI guide and shipped bounded/reconnect chat patterns |
| GIF/sticker export rights | MEDIUM | Implementation assets/providers are known, but redistribution terms were not established in repository documentation; verify before export |
| Multiple-link exclusion | HIGH | Current code explicitly selects the first safe public HTTP(S) URL per message |

The required `gsd-tools` research-plan and confidence-classification seam was unavailable in this environment (`command not found`). Confidence above therefore comes from direct repository evidence and current official primary sources rather than seam-generated tiers or cached digests.

## Sources

### Repository evidence

- [Project scope and active milestone](../PROJECT.md)
- [FISH product and native-mobile rules](../../AGENTS.md)
- [FISH UI/UX guidelines](../../docs/ui-ux-agent-guidelines.md)
- [Android chat domain models](../../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/model/ChatModels.kt)
- [Android gallery-relevant UI classifications](../../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatModels.kt)
- [Android attachment safety and open/share boundary](../../apps/android/app/src/main/kotlin/space/fishhub/android/AttachmentFileOpener.kt)
- [iOS attachment rules](../../apps/ios/FishKit/Sources/ChatData/Logic/AttachmentValidationRules.swift)
- [iOS message and attachment contracts](../../apps/ios/FishKit/Sources/ChatData/Models/ChatMessage.swift)
- [iOS native activity sheet](../../apps/ios/FishKit/Sources/PersonalChat/Views/AttachmentActivitySheet.swift)
- [Existing message deletion RPC](../../supabase/migrations/0013_realtime_chat_features.sql)
- [Voice attachment contract](../../supabase/migrations/0055_chat_voice_messages.sql)
- [Link preview and first-safe-URL contract](../../supabase/functions/_shared/link-preview.ts)
- [Video attachment contract](../../supabase/migrations/0060_chat_video_attachments.sql)

### Current external primary sources

- [Signal Support: View and save media or files](https://support.signal.org/hc/en-us/articles/360007317471-View-and-save-media-or-files) — current retrieval categories and save behavior
- [Signal Support: Delete for everyone](https://support.signal.org/hc/en-us/articles/360050426432-Delete-for-everyone) — sender action and whole-message deletion convention
- [Apple Support: Share content in Messages on iPhone](https://support.apple.com/en-gb/guide/iphone/iphb66cfeaad/ios/26) — conversation-details categories, hidden empty categories, share/save behavior
- [Apple Support: Search within your text messages on iPhone](https://support.apple.com/en-ie/111116) — current Photos/Links/Documents categories and attachment actions; published 2025-10-03
- [Apple HIG: Activity views](https://developer.apple.com/design/human-interface-guidelines/activity-views) — use the standard share control/sheet and avoid duplicate common actions
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) — Dynamic Type, control sizing, labeling, cognitive accessibility, and reduced motion
- [Android Developers: Send simple data to other apps](https://developer.android.com/training/sharing/send) — Android Sharesheet, MIME-specific sharing, URI permissions, and warning against custom share sheets/mixed MIME bulk share
- [Android Developers: Storage Access Framework](https://developer.android.com/guide/topics/providers/document-provider) — system file open/save locations and user-controlled document providers
- [Android Developers: Accessibility principles](https://developer.android.com/guide/topics/ui/accessibility/principles) — concise descriptions, action labels, and accessible lazy collections

---
*Feature research for: FISH v1.3 per-conversation Shared content on native Android and iOS*
*Researched: 2026-07-22*
