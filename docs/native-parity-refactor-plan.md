# Native Android / iOS Parity Refactor Plan

## Scope boundary

This branch is a **refactor**: nothing behaves differently. Across every commit, **no recorded
image was ever modified** — the manifest only grew as new coverage was added, and the additions
are listed below.

Work that surfaced during the refactor but changes behaviour lives on
`feature/chat-viewer-and-gif-poster`, not here:

- **Attachment viewer paging** — the viewer took a single attachment and could not be swiped; the
  branch makes it page across a message's photos.
- **Shared GIF poster** — the transcript fell back to an unavailable message when a poster failed
  to load and the picker grid did not, leaving a blank tile; the branch gives both one path.

Both are worth shipping and both need reviewing on their own merits, which is exactly why they are
not mixed into a change whose value is the claim that nothing moved.

The remaining items in this document — iOS avatar images, the accessibility-announcement default,
FishKit's hardcoded English accessibility labels — are product work that the refactor *surfaced*
by making the two codebases comparable. They belong in a backlog, not on this branch.

## Outcome (2026-07-25)

Stages 0–3 and 5 are **complete**; stage 4 is **substantially advanced** (component coverage
on both platforms went 2 → 16 of 53). Every commit passed `pnpm android:check` and `pnpm ios:test`, and all
303 recorded images stayed byte-identical throughout — no rendering changed.

| | Before | After |
|---|---:|---:|
| Android UI files | 35 | **94** |
| Android files declaring >1 public component | 15 | **0** |
| iOS UI files (FishKit) | 65 | **82** |
| iOS files declaring >1 public component | 4 | **0** |
| Largest UI file | 1 841 (`FishApp.swift`) | **540** (`MessageComposer.swift`) |
| Paired components sharing a name | 20 | **46 of 53** |
| Paired components with aligned props | 8 | **16 of 53** |
| Paired components with an unexplained prop divergence | 45 | **0** |
| Image baselines changed | — | **0** (303 → 327; additions only) |
| Android tests | green | green |
| iOS tests | 412 / 75 suites | **412 / 75 suites** |

**What landed**

- One public component per file on both platforms, enforced by `pnpm parity:verify`
  (`scripts/verify-native-parity.mjs`) and wired into `pnpm android:check`.
- A component registry (`design/parity/native-components.json`) — 122 components, 53 paired.
- Shared vocabulary: 26 renames, e.g. `ChatTopBar`→`PersonalChatTopBar`,
  `MessageDateSeparator`→`MessageDaySeparator`, `AudioActivity`→`CallActivityPanel`.
- Android features grouped into `screens/`, `views/`, `views/mediapicker/`, `viewmodels/`,
  `logic/`, `model/`, mirroring iOS's `Screens/`, `Views/`, `ViewModels/`, `Logic/`, `Models/`.
- iOS kebab-case folders (web-convention leakage) renamed to Swift conventions.

**Corrections made to this plan while executing it**

1. **The `Fish` prefix must not be renamed away.** §4.8 implied `FishButton`→`ActionButton` etc.
   Compose's `Button`, `Surface`, `TextField`, `TopBar`, `Divider`, `IconButton` and `Theme` are
   already taken by Material 3, so the prefix is *required*, not incidental. These are now 8
   explicit `namingBreak` pairings, added as accepted break #10 in §8.
2. **Renames must be platform-scoped.** iOS has its own `OlderMessagesState` enum, unrelated to
   the Android view of that name; a global rename collided with iOS's `OlderMessagesSlot`.
3. **Private sub-components split too where the other platform has them standalone.** §6.1 said
   private helpers co-locate; that would have left Android's `CallScreen.kt` as one file against
   iOS's ten `Calls/Views/` files. Parity wins there.
4. **`parity:verify` was wired into `android:check` at the end of stage 2**, not in task 0.3 —
   wiring a deliberately-failing check into the repo's main gate would have left it red for the
   whole refactor.
5. **The settings module-boundary guard was narrowed** to cross-feature imports
   (`feature\.(?!settings\.)`) so the feature can import its own sub-packages. Cross-feature
   isolation is unchanged and still verified.

**Stage 4 — component-level screenshot coverage on Android**

The gap was never naming. Android's screenshot coverage was **screen-level**
(`ScreenshotFrame(model = ChatSamples.loaded)` renders a whole screen); FishKit's is
**component-level** (`assertThemedSnapshots(of: MessageBubble…)`). Screen frames hid component
states behind whole-screen composition, so a component could regress invisibly.

Android now has a component-level preview layer whose `@Preview(name = …)` strings match the
`named:` strings FishKit passes to `assertThemedSnapshots`, so a case can be put side by side
with its counterpart:

| Module | Cases added |
|---|---|
| `feature:chat` | `message-bubbles`, `chat-chrome` |
| `feature:presence` | `presence-indicators`, `presence-avatars`, `presence-summaries` |
| `core:designsystem` | `button-states`, `icon-button-states`, `avatar-states`, `notice-states`, `text-field-states`, `skeleton-states`, `empty-states` |

`core:designsystem` had no screenshot source set at all; it now has one, wired into
`pnpm android:screenshots` and `pnpm android:check`.

**Coverage across the 53 paired components, by `pnpm parity:verify --previews`:**

| | Before | After |
|---|---:|---:|
| Covered on both platforms | 2 | **16** |
| Covered on one platform | 25 | 11 |
| Covered on neither | 26 | 26 |

Baselines went 303 → 327. Every added image was reviewed against
`docs/ui-ux-agent-guidelines.md` before being accepted, and no pre-existing baseline changed at
any point.

**What the review caught, which is the point of the exercise:**

- The `message-bubbles` case shows grouped-run corners tightening correctly — direct visual proof
  that the `MessageGroupPosition` conversion in `MessageBubble` preserved rendering.
- `chat-chrome` shows the connection notices drawn as **outlined boxes**. The house preference is
  fills over borders; outlined boxes read as noise. Pre-existing, and previously hidden inside
  screen-level frames.
- `button-states` shows the loading button hiding its label behind a faint partial spinner. The
  baseline is deterministic — re-recording produced a byte-identical file — so it is safe to
  keep, but the state is hard to read.

**Remaining:** the 26 components covered on neither platform need cases written on *both* sides,
not just Android, so that work spans both codebases. The 11 covered on one side are mostly
screens (`MessageSearchScreen`, `ConversationListScreen`, `MediaPickerSheet`, `AccountSettingsSheet`)
where FishKit snapshots the screen and Android would need an equivalent case.

**Stage 5 has started, one component at a time.** `MessageBubble` is converged (9 of 53 aligned):

```
row, onAction, onRetry, reactionsEnabled        ← identical on both platforms
```

Android replaced ten interaction callbacks with a single `MessageAction` channel and now takes a
`MessageRowUiModel`; FishKit folded its `onReplyTap` into the same channel. All 303 baselines
stayed byte-identical, so the conversion preserved rendering.

Three things were settled while doing it, and they set the pattern for the remaining components:

- **The divergence was three layers, not one.** Row model (`MessageRowUiModel` vs grouping flags
  on `MessageUiModel`), action vocabulary (5 iOS cases vs 10 Android callbacks), and state
  handling (FishKit owns view-scoped state and services; Compose hoists everything). Only the
  first two were converged.
- **State handling stays per-platform**, by decision. `attachmentCommands`, `imageLoader` and
  `fileDownloader` are SwiftUI view-scoped services with no Compose counterpart; they join
  `modifier` and `requestedFocus` as exempt parameters. Forcing either platform to the other's
  model would fight its idiom and change behaviour.
- **The action case sets are deliberately not identical.** FishKit settles attachment opening and
  the reply/edit/delete menu internally and escalates only what the store must decide; the
  Compose bubble holds no state so everything escalates. The parameter list matches; the case set
  reflects the state-handling break above.

Android's `MessageRowUiModel` also omits FishKit's `showsMeta`: this bubble renders the timestamp
inside its media and attachment children rather than gating a header, so the field would be
write-only. It carries `playingVoiceAttachmentId` instead, which FishKit holds in view state.

Ten more converged after it, chosen by lowest risk rather than by size:
`StagedAttachmentStrip`, `SharedContentMetadataRow`, `PresenceIndicator`,
`SharedContentCategoryBar`, `Avatar` and `PresenceAccountTrigger` — renames, orderings and one
added parameter, all with the 303 baselines unchanged.

**Stage 5 is complete in the sense that matters: every paired component now has a resolution.**
15 have aligned props. The other 38 each carry a `propsBreak` naming *why* they differ, and
`pnpm parity:verify` fails on any paired component that has neither — so a new divergence cannot
slip in unexamined. Verified with a negative test: removing one classification fails the build.

| Resolution | Count | Meaning |
|---|---:|---|
| `propsAligned` | 15 | Comparable parameter lists are identical |
| `state-bundling` | 25 | FishKit hands the view a model/state object and keeps view-scoped state; Compose hoists every leaf to the ViewModel |
| `feature-gap` | 7 | The two implementations genuinely do different things |
| `platform-idiom` | 6 | Each side follows its own control, resource or text-input conventions |
| unclassified | **0** | — |

**Acting on the decisions (2026-07-25).** `Notice` converged: Android's single string was
FishKit's required `title`, so it was renamed and gained the optional detail and action;
FishKit's initialiser was reordered to match. `AccountSettingsSheet` took five parameter renames
(`accessibility`→`motion` — already an `AccountSettingsMotion` — plus the appearance, unblock and
notification-settings callbacks).

**Three of the seven "feature gaps" were misclassified, and reading the implementations proved
it.** They had been sorted by comparing prop lists, which is not enough:

- **`EmptyState` is platform-idiom, not a gap.** Android's `action` slot is used with different
  button variants (`Secondary`, `Ghost`) *and* a busy state (`loading = retryBusy`). FishKit's
  `actionLabel` + `isPrimaryAction` can express neither. Adopting FishKit's shape would delete
  working capability, and Compose's slot API is endorsed by the Compose API guidelines just as
  value parameters are idiomatic in SwiftUI. Both shapes are right for their platform.
- **`StickerMedia` and `AccountSettingsSheet` are state-bundling.** FishKit resolves the sticker
  from a catalog *inside* the view and handles sheet dismissal through `@Environment(\.dismiss)`;
  Compose resolves in the caller and hoists dismissal. Same break as everywhere else.

**`GifMedia` triage produced a different answer than expected.** FishKit's `GifMedia` is a shared
primitive used by three surfaces — the transcript bubble, the picker grid and the selection
preview — which is why it carries `preview`, `fixedAspect` and `externallyPaused`. Android's is
used by one, and **`ChatMediaPickerContent.kt` renders GIFs itself with `AsyncImage`**, duplicating
it. The work is not "add five parameters to Android"; it is "extract the duplicated rendering into
the shared component", after which the parameters follow naturally.

**Three genuine capability gaps remain**, each a product decision:

| Component | Gap |
|---|---|
| `AttachmentViewer` | FishKit pages an image array (`images`, `initialIndex`); Android shows a single attachment with **no swiping between photos** |
| `PersonalChatTopBar` | Android renders a remote avatar image; FishKit renders initials only |
| `GifMedia` | Shared primitive on iOS, duplicated rendering on Android (above) |

**The 38 cannot be closed by refactoring.** Each needs a decision first:

- **`state-bundling` (25)** — including `PersonalChatScreen` (48 Android params vs 21),
  `MessageComposer`, `CallOverlay`, `CallPanel`, `PersonalChatTranscript`. Converging these *is*
  the "full convergence including state handling" option that was considered and rejected: it
  means rewriting one platform's state model. The decision stands; these are recorded, not
  outstanding.
- **`feature-gap` (7)** — real product questions, not refactors:
  - `PersonalChatTopBar` — Android renders a remote avatar image, FishKit renders initials only.
  - `Notice` — FishKit supports a title and an action; Android does not.
  - `AttachmentViewer` — FishKit pages an image array; Android shows a single attachment.
  - `EmptyState`, `GifMedia`, `StickerMedia`, `AccountSettingsSheet` — differing capability sets.
- **`platform-idiom` (6)** — closing these would mean breaking a platform convention:
  `InputField` (Compose exposes keyboard/visual-transformation plumbing SwiftUI has no analogue
  for), `ReactionPill`/`AddReactionPill` (**Android localises accessibility labels through
  `stringResource`; FishKit hardcodes English inline** — an i18n gap worth its own look),
  `ActionButton`, `IconButton`, `SettingsRow`.

`action` (SwiftUI) and `onClick` (Compose) are now compared as one name rather than counted as a
difference, since the parameter exists on both and only the convention differs.

---

## 1. Situation

### 1.1 The headline finding

**The two platforms are not equally out of shape, and the imbalance changes the plan.**

iOS is already almost entirely one-view-per-file: of 68 files declaring a SwiftUI `View`,
**58 declare exactly one**. Android is the outlier: 11 UI files declare 100 composables between
them, in "bucket" files named `*Components.kt`.

| | Android | iOS |
|---|---|---|
| UI files declaring ≥1 component | 36 | 68 |
| Files declaring exactly 1 component | 19 | 58 |
| Files declaring ≥5 components | **11** | **2** |
| Largest UI file | `ChatComponents.kt` — 893 lines, 14 composables | `FishApp.swift` — 1 841 lines, 5 views |

So the one-component-per-file goal is **mostly an Android job**, and iOS's `Views/` directory is
already a usable draft of the target component inventory. The plan leans on that: **iOS is the
reference shape, Android moves toward it**, except where iOS is itself the violator.

### 1.2 Three separate problems, increasing in risk

Reading the two codebases side by side, they have diverged in three independent ways. They need
separate stages because they carry very different risk:

| # | Divergence | Example | Risk |
|---|---|---|---|
| 1 | **Decomposition** — same UI, different file granularity | Android `ChatComponents.kt` holds 14 composables; iOS has 11 of them as separate files | **Low** — pure move, compiler-verified |
| 2 | **Naming** — same component, different name | Android `MessageDateSeparator` ↔ iOS `MessageDaySeparator` | **Low-medium** — mechanical rename, but touches call sites, test names, and image-baseline paths |
| 3 | **Props** — same component, genuinely different API | Android `MessageBubble` takes 10 individual callbacks; iOS `MessageBubble` collapses them into one `onAction: (MessageAction) -> Void` | **High** — this is an API redesign, not a move. It can change behaviour. |

Problem 3 is the one that cannot honestly be called "zero behaviour change" if done carelessly.
It gets its own stage, done per component, behind explicit review — see [§7](#7-stage-5--prop-reconciliation-risky-opt-in).

### 1.3 The oversized files

Source files over 300 lines, excluding build output and SwiftPM checkouts. **Bold** = also
declares multiple UI components, so it is a target for both size and one-per-file.

**Android** (`*.kt`)

| Lines | Composables | File |
|---:|---:|---|
| 1 445 | – | `feature/chat/.../ChatViewModel.kt` |
| 1 279 | – | `data/chat/.../remote/SupabaseChatRemoteDataSource.kt` |
| 1 229 | – | `data/chat/.../DefaultChatRepository.kt` |
| 1 171 | – | `app/.../MainActivity.kt` |
| 1 069 | – | `feature/chat/.../sharedcontent/state/SharedContentState.kt` |
| 978 | – | `data/chat/.../local/ChatDao.kt` |
| 934 | – | `feature/chat/.../sharedcontent/SharedContentStore.kt` |
| **917** | **3** | `feature/chat/.../ChatRoute.kt` |
| **893** | **14** | `feature/chat/.../ChatComponents.kt` |
| **867** | **8** | `feature/chat/.../ChatScreen.kt` |
| **775** | **11** | `feature/chat/.../sharedcontent/SharedContentGalleryComponents.kt` |
| 761 | – | `data/chat/.../AttachmentImporter.kt` |
| **753** | **10** | `feature/call/.../CallScreen.kt` |
| **693** | **16** | `feature/settings/.../AccountSettingsSheet.kt` |
| 663 | – | `data/chat/.../ChatDataModule.kt` |
| **560** | **12** | `feature/chat/.../ChatAttachmentDraftComponents.kt` |
| 556 | – | `core/designsystem/.../Icons.kt` |
| 545 | – | `feature/call/.../CallCoordinator.kt` |
| **542** | **10** | `feature/chat/.../ChatAttachmentComponents.kt` |
| **517** | **7** | `feature/chat/.../ChatMediaComponents.kt` |
| **423** | **10** | `feature/chat/.../ChatMediaPickerSheet.kt` |
| **406** | **2** | `feature/chat/.../sharedcontent/SharedContentPreviewScreen.kt` |
| **331** | **6** | `feature/chat/.../MessageSearchScreen.kt` |
| **294** | **5** | `feature/chat/.../sharedcontent/SharedContentGalleryScreen.kt` |

**iOS** (`*.swift`)

| Lines | Views | File |
|---:|---:|---|
| **1 841** | **5** | `App/Sources/FishApp.swift` |
| 1 330 | – | `FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift` |
| 1 154 | – | `FishKit/Sources/PersonalChat/ViewModels/SharedContentStore.swift` |
| 1 129 | – | `FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift` |
| 1 018 | – | `FishKit/Sources/ChatData/Adapters/CoreDataSharedContentCache.swift` |
| 624 | – | `FishKit/Sources/PersonalChat/ViewModels/SharedContentGalleryModel.swift` |
| 608 | – | `FishKit/Sources/ChatData/Adapters/SupabaseSharedContentRepository.swift` |
| 571 | – | `FishKit/Sources/Calls/ViewModels/CallSessionModel.swift` |
| **557** | **2** | `FishKit/Sources/PersonalChat/Screens/SharedContentGalleryScreen.swift` |
| 552 | – | `FishKit/Sources/PersonalChat/ViewModels/SharedContentMediaURLPolicy.swift` |
| 540 | 1 | `FishKit/Sources/PersonalChat/Views/MessageComposer.swift` |
| 540 | – | `FishKit/Sources/CallMediaLiveKit/LiveKitCallMedia.swift` |
| 523 | – | `FishKit/Sources/PersonalChat/ViewModels/AttachmentUploadsModel.swift` |
| **522** | **8** | `FishKit/Sources/PersonalChat/Views/SharedContentGalleryComponents.swift` |
| **495** | **2** | `FishKit/Sources/AccountSettings/Views/AccountSettingsView.swift` |
| 477 | – | `FishKit/Sources/ChatData/Adapters/RestChatMessaging.swift` |
| 448 | – | `FishKit/Sources/PersonalChat/ViewModels/MessageImageLoader.swift` |
| **381** | **2** | `FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift` |

Smaller iOS multi-view files also in scope for the one-per-file rule: `MessageBody.swift` (3),
`AttachmentViewer.swift` (2), `ActionButton.swift` (2), `CallControls.swift` (2),
`ReactionPill.swift` (2), `Typography.swift` (2), `Skeleton.swift` (2).

### 1.4 Counterpart map at file level

| Concern | Android | iOS | Note |
|---|---|---|---|
| App entry / wiring | `app/.../MainActivity.kt` (1 171) | `App/Sources/FishApp.swift` (1 841) | Both oversized, both mix wiring with views |
| Chat screen | `feature/chat/.../ChatScreen.kt` | `PersonalChat/Screens/PersonalChatScreen.swift` | Name differs |
| Chat components | `ChatComponents.kt` (14) | 11 separate files in `PersonalChat/Views/` | **iOS is the reference** |
| Attachments (sent) | `ChatAttachmentComponents.kt` (10) | `MessageAttachments`, `MessageImageTile`, `MessageFileCard`, `AttachmentViewer` | iOS finer-grained |
| Attachments (draft) | `ChatAttachmentDraftComponents.kt` (12) | `StagedAttachmentStrip`, `StagedAttachmentTile`, `AttachmentActivitySheet` | Partial coverage; gaps in §4 |
| Media in message | `ChatMediaComponents.kt` (7) | `StickerMedia`, `GifMedia`, `MessageGif`, `message-video-player`, `message-voice-player` | iOS folder naming is off-convention |
| Media picker | `ChatMediaPickerSheet.kt` (10) | `PersonalChat/Views/MediaPicker/` (6 files) | **iOS is the reference** |
| Message search | `MessageSearchScreen.kt` (6) | `PersonalChat/Screens/MessageSearchScreen.swift` (1) | iOS has no sub-components |
| Shared content gallery | `sharedcontent/` (2 files, 16) | `SharedContentGalleryComponents.swift` (8) + screen | **Both need splitting** |
| Calls | `feature/call/.../CallScreen.kt` (10) | `Calls/Views/` (10 files) + `Calls/Screens/CallOverlay.swift` | **iOS is the reference** |
| Account settings | `feature/settings/.../AccountSettingsSheet.kt` (16) | `AccountSettings/Views/AccountSettingsView.swift` (2) | **Both need splitting** |
| Presence | 4 one-per-file `.kt` files | `UIComponents/Identity/` + `Presence/Views/` | Already close |
| Design system | `core/designsystem/component/` (11 files) | `UIComponents/` (12 files) + `DesignSystem/` | Already close |

**Exists on one platform only** (confirm during Task 1.1, do not assume):

- Android only: `LinkPreviewSurface`, `ReplyPreviewSurface`, `MessageDeliveryStatus`,
  `ChatMessageActionsSheet`, `EmojiPickerContent`, `KlipyAttribution`, `ConversationRail`,
  `ChatAdaptiveLayout`, `CompactCallBar`.
- iOS only: `PersonalChatTranscript`, `ReactionPicker`, `OlderMessagesSlot`,
  `GifSelectionPreview`, `StickerSelectionThumbnail`, `CallChatPane`, `CallEntryButtons`,
  `CallPromptActions`, `CallStatusHeader`, `CallSurface`, `MicrophoneLevelMeter`.

Several of these are almost certainly the *same* UI under a different decomposition rather than
a missing feature (e.g. Android's `ChatTranscript` inside `ChatScreen.kt` vs iOS's standalone
`PersonalChatTranscript.swift`). Task 1.1 resolves each one to `same`, `android-only`, or
`ios-only` with evidence.

---

## 2. Convention research

Read before designing the tree. Sources and what each one actually mandates:

### 2.1 Kotlin — [Coding conventions](https://kotlinlang.org/docs/coding-conventions.html)

- **Directory must follow package:** *"the recommended directory structure follows the package
  structure with the common root package omitted."*
- **Filename for a single declaration:** *"If a Kotlin file contains a single class or interface
  (potentially with related top-level declarations), its name should be the same as the name of
  the class, with the `.kt` extension appended."*
- **Filename for multiple declarations:** *"If a file contains multiple classes, or only
  top-level declarations, choose a name describing what the file contains…"* — and
  *"avoid using meaningless words such as `Util` in file names."*
- **Multiple declarations are permitted, with a size cap:** *"Placing multiple declarations …
  in the same Kotlin source file is encouraged as long as these declarations are closely related
  to each other semantically, and the file size remains reasonable (not exceeding a few hundred
  lines)."*

> **Honest reading:** the strict one-component-per-file rule is **stricter than** official Kotlin
> convention, not required by it. Kotlin explicitly permits grouping closely-related declarations.
> But the current files break the convention's own size clause anyway — 893, 775, and 693 lines
> are not "a few hundred" — and the single-declaration filename rule actively supports
> one-per-file. So: **one-per-file is a compliant, stricter subset.** Adopting it is a project
> choice, and this plan records it as such rather than claiming Kotlin demands it.
>
> The one place the convention pushes back is `Icons.kt` (556 lines) and the token files, which
> are "only top-level declarations, closely related" — exactly the case Kotlin says may share a
> file. Those are **excluded** from the one-per-file rule; see §3.3.

### 2.2 Android — [Guide to Android app modularization](https://developer.android.com/topic/modularization/patterns)

- *"A feature is an isolated part of an app's functionality that usually corresponds to a screen
  or series of closely related screens."* Feature modules *"contain UI and `ViewModel` for
  handling logic and state"* and *"depend on data modules."*
- *"Common modules, also known as core modules, contain code that other modules frequently use."*
- *"The public interface of a module should be minimal… Use Kotlin's `private` or `internal`
  visibility scope to make the declarations module-private."*

> The existing Gradle graph (`:app`, `:core:*`, `:data:*`, `:feature:*`) already matches this.
> **No module changes in this refactor.** Note the docs prescribe *module* structure and say
> nothing about sub-package naming inside a feature module — so `views/` vs `ui/` is
> unconstrained by official guidance. That freedom is what lets §3 pick parity-friendly names.

### 2.3 Compose — [Compose API guidelines](https://github.com/androidx/androidx/blob/androidx-main/compose/docs/compose-api-guidelines.md)

- *"name any function that returns `Unit` and bears the `@Composable` annotation using
  `PascalCase`, and the name MUST be that of a noun, not a verb or verb phrase"*
- *"[the modifier parameter] MUST be named `modifier` and MUST appear as the first optional
  parameter in the element function's parameter list"*, with default `Modifier`.
- Layout functions *"SHOULD place their primary or most common `@Composable` function parameter
  in the last parameter position to permit the use of Kotlin's trailing lambda syntax"*, and
  *"SHOULD use the name `content`"* for it.

> **This is a hard parity break.** Compose *mandates* a `modifier` parameter that SwiftUI has no
> equivalent for, and mandates its position. Parameter lists therefore cannot be identical. See
> §6.2 for the rule this plan adopts.

### 2.4 Swift — [API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/)

- *"Names of types and protocols are `UpperCamelCase`. Everything else is `lowerCamelCase`."*
- *"Clarity at the point of use is your most important goal."*
- *"Name variables, parameters, and associated types according to their roles, rather than their
  type constraints."*

> Apple publishes no official *directory* layout for SwiftUI apps — file placement is convention,
> not mandate. The prevailing convention, and the one FishKit already follows, is one type per
> file named after the type, grouped by concern (`Screens/`, `Views/`, `Models/`, `Logic/`,
> `ViewModels/`, `Adapters/`, `Providers/`). This plan keeps it.
>
> **Convention violation found:** three folders use web-style kebab-case
> (`Views/message-voice-player/message-voice-player.swift`, `Views/message-video-player/…`,
> `Views/voice-recording-control/…`). This looks like the web `AGENTS.md` component-folder rule
> leaking into Swift. It contradicts `UpperCamelCase` type-named files and the rest of FishKit.
> Task 2.4 fixes it.

### 2.5 Existing repo conventions to preserve

- Android package root `space.fishhub.android.<module>`; directory mirrors package (enforced by
  the Kotlin convention above).
- iOS target-per-concern in `FishKit/Package.swift`; `Sources/<Target>/<Concern>/File.swift`.
- Design tokens are **generated** — `core/designsystem/tokens/GeneratedTokens.kt`,
  `DesignSystem/Generated/*.generated.swift`. Never hand-edit; never split.
- Cross-platform behaviour is already pinned by shared JSON vectors and a parity test
  (`SharedContentParityTest.kt` reads `shared-content-vectors.json`, synced by
  `scripts/sync-ios-chat-vectors.mjs`). **This plan extends that pattern rather than inventing
  a new one.**

---

## 3. Target structure

### 3.1 Where §2 and parity conflict, convention wins

The stated rule: never break an official platform convention to force identical trees. In
practice the conflict is smaller than expected, because Android's official docs constrain
*modules*, not sub-packages. So the parity-friendly names below violate nothing.

Two places convention does win outright:

1. **Kotlin packages are lowercase, Swift folders are UpperCamelCase.** `views/` ↔ `Views/`.
   Not a divergence to fix — it is each language's rule.
2. **Compose `modifier`.** No SwiftUI counterpart; see §6.2.

### 3.2 Side-by-side target tree (chat feature)

```
ANDROID                                          iOS
apps/android/feature/chat/src/main/kotlin/       apps/ios/FishKit/Sources/
  space/fishhub/android/feature/chat/              PersonalChat/

  ChatRoute.kt              ← nav entry           PersonalChat.swift         ← target entry
  screens/                                        Screens/
    PersonalChatScreen.kt                           PersonalChatScreen.swift
    ConversationListScreen.kt                       ConversationListScreen.swift
    MessageSearchScreen.kt                          MessageSearchScreen.swift
    SharedContentGalleryScreen.kt                   SharedContentGalleryScreen.swift
    SharedContentPreviewScreen.kt                   SharedContentPreviewScreen.swift
  views/                                          Views/
    MessageBubble.kt                                MessageBubble.swift
    MessageBody.kt                                  MessageBody.swift
    MessageAttachments.kt                           MessageAttachments.swift
    MessageImageTile.kt                             MessageImageTile.swift
    MessageFileCard.kt                              MessageFileCard.swift
    MessageDaySeparator.kt                          MessageDaySeparator.swift
    MessageComposer.kt                              MessageComposer.swift
    PersonalChatTopBar.kt                           PersonalChatTopBar.swift
    PersonalChatTranscript.kt                       PersonalChatTranscript.swift
    UnreadMessagesDivider.kt                        UnreadMessagesDivider.swift
    TypingIndicator.kt                              TypingIndicator.swift
    ChatConnectionNotice.kt                         ChatConnectionNotice.swift
    OlderMessagesSlot.kt                            OlderMessagesSlot.swift
    ReactionPill.kt                                 ReactionPill.swift
    ReactionPicker.kt                               ReactionPicker.swift
    CallActivityRow.kt                              CallActivityRow.swift
    ConversationRow.kt                              ConversationRow.swift
    ConversationDetailsSheet.kt                     ConversationDetailsSheet.swift
    StagedAttachmentStrip.kt                        StagedAttachmentStrip.swift
    StagedAttachmentTile.kt                         StagedAttachmentTile.swift
    AttachmentViewer.kt                             AttachmentViewer.swift
    VoiceRecordingControl.kt                        VoiceRecordingControl.swift
    MessageVoicePlayer.kt                           MessageVoicePlayer.swift
    MessageVideoPlayer.kt                           MessageVideoPlayer.swift
    …one file per component…                        …one file per component…
    mediapicker/                                    MediaPicker/
      MediaPickerSheet.kt                             MediaPickerSheet.swift
      MediaPickerTabs.kt                              MediaPickerTabs.swift
      MediaPickerSearchField.kt                       MediaPickerSearchField.swift
      StickerPanel.kt                                 StickerPanel.swift
      GifPanel.kt                                     GifPanel.swift
      EmojiPanel.kt                                   EmojiPanel.swift
    sharedcontent/                                  SharedContent/        ← new group
      SharedContentCategoryBar.kt                     SharedContentCategoryBar.swift
      SharedContentMediaGrid.kt                       SharedContentMediaGrid.swift
      SharedContentMediaThumbnail.kt                  SharedContentMediaThumbnail.swift
      SharedContentMetadataRow.kt                     SharedContentMetadataRow.swift
      SharedContentGallerySkeleton.kt                 SharedContentGallerySkeleton.swift
      SharedContentGalleryNotice.kt                   SharedContentGalleryNotice.swift
      SharedContentUnavailableState.kt                SharedContentUnavailableState.swift
      ShowEarlierBoundary.kt                          ShowEarlierBoundary.swift
  viewmodels/                                     ViewModels/
    ChatViewModel.kt                                ConversationStore.swift
    MessageSearchViewModel.kt                       MessageSearchModel.swift
    MediaPickerViewModel.kt                         GifSearchModel.swift
    …                                               …
  logic/                                          Logic/
    ChatFormatter.kt                                ChatDayLabel.swift, ChatRules.swift, …
  model/                                          Models/
    …one type per file…                             …already one type per file…
  state/                    ← unchanged           (ChatCore target)
```

The same shape applies to `feature/call` ↔ `Calls`, `feature/settings` ↔ `AccountSettings`,
`feature/presence` ↔ `Presence`, and `core/designsystem/component/` ↔ `UIComponents/`.

### 3.3 Explicit exclusions from one-component-per-file

These stay grouped. Splitting them would break a convention or serve nothing:

| File | Why excluded |
|---|---|
| `core/designsystem/Icons.kt`, `ColorTokens.kt`, `DimensionTokens.kt`, `TypeTokens.kt` | Only top-level declarations, closely related — the exact case Kotlin's convention permits. Splitting 200 icons into 200 files serves no one. |
| `core/designsystem/tokens/GeneratedTokens.kt`, `DesignSystem/Generated/*.generated.swift` | Generated. Regenerated by `pnpm android:tokens` / `pnpm ios:tokens`. |
| `state/ChatReducer.kt`, `ChatState.kt`, `sharedcontent/state/SharedContentState.kt` and iOS `ChatCore/**` | Not UI. Oversized, yes — but decomposing reducer/state is a *behaviour-risky* change and belongs in its own plan. See §9. |
| Swift `enum` token namespaces (`Typography.swift` holding `TextRole` + `Typography`) | Caseless-enum namespace + its role enum are one concept. |
| Preview/sample data (`ChatSamples.kt`, `TestSupport/Fixtures/*`) | Fixture bundles, not components. |

---

## 4. Component registry

This is the contract. One row per component; both platforms in one table. The registry is
committed as machine-readable data in Task 0.2 so a script can enforce it, and this table is its
human-readable rendering.

`Status` legend: `✅ aligned` · `↔ rename` · `⚠ props differ` · `➕ to create` · `❓ verify`

### 4.1 Chat message surface

| Canonical name | Android today | iOS today | Status |
|---|---|---|---|
| `MessageBubble` | `MessageBubble` (in `ChatComponents.kt`) | `MessageBubble.swift` | ⚠ props differ |
| `MessageBody` | (inside `MessageBubble`) | `MessageBody.swift` | ➕ extract on Android |
| `MessageDeliveryStatus` | `MessageDeliveryStatus` | (inside `MessageBubble`) | ➕ extract on iOS |
| `MessageDaySeparator` | `MessageDateSeparator` | `MessageDaySeparator.swift` | ↔ rename Android |
| `UnreadMessagesDivider` | `UnreadMessageDivider` | `UnreadMessagesDivider.swift` | ↔ rename Android |
| `TypingIndicator` | `TypingIndicator` | `TypingIndicator.swift` | ✅ aligned |
| `ChatConnectionNotice` | `ChatConnectionNotice` | `ChatConnectionNotice.swift` | ✅ aligned |
| `OlderMessagesSlot` | `OlderMessagesState` | `OlderMessagesSlot.swift` | ↔ rename Android |
| `LinkPreviewSurface` | `LinkPreviewSurface` | ❓ not found as a type | ❓ verify — likely inline in `MessageBody` |
| `ReplyPreviewSurface` | `ReplyPreviewSurface` | ❓ not found as a type | ❓ verify |
| `ReactionPill` | `ReactionChip` (`ReactionChip.kt`) | `ReactionPill.swift` | ↔ rename Android |
| `AddReactionPill` | (in `ReactionChip.kt`) | `AddReactionPill` (in `ReactionPill.swift`) | ↔ split both |
| `ReactionPicker` | `EmojiPickerContent` ❓ | `ReactionPicker.swift` | ❓ verify — may be distinct |
| `CallActivityRow` | `ChatCallActivityRow` (in `ChatScreen.kt`) | `CallActivityRow.swift` | ↔ rename Android |
| `MessageActionsSheet` | `ChatMessageActionsSheet` | ❓ handled via `MessageAction` | ❓ verify |

### 4.2 Chat shell

| Canonical name | Android today | iOS today | Status |
|---|---|---|---|
| `PersonalChatScreen` | `ChatScreen` (in `ChatScreen.kt`) | `PersonalChatScreen.swift` | ↔ rename Android |
| `PersonalChatTranscript` | `ChatTranscript` (in `ChatScreen.kt`) | `PersonalChatTranscript.swift` | ↔ rename + extract Android |
| `PersonalChatTopBar` | `ChatTopBar` (in `ChatComponents.kt`) | `PersonalChatTopBar.swift` | ↔ rename Android, ⚠ props differ |
| `MessageComposer` | `MessageComposer` | `MessageComposer.swift` | ✅ aligned, ⚠ props differ |
| `ConversationListScreen` | `ConversationListScreen` (in `ChatScreen.kt`) | `ConversationListScreen.swift` | ↔ extract Android |
| `ConversationRow` | `component/ConversationRow.kt` | ❓ inline in `ConversationListScreen` | ➕ extract on iOS |
| `ConversationDetailsSheet` | `ParticipantDetailsSheet.kt` | `ConversationDetailsSheet.swift` | ↔ rename Android |
| `ChatAdaptiveLayout` | `ChatAdaptiveLayout` | ❓ none | ❓ android-only (tablet rail) |
| `ConversationRail` | `ConversationRail` | ❓ none | ❓ android-only |
| `ChatLoading` / `ChatUnavailable` | both in `ChatScreen.kt` | `TranscriptSkeleton` (in `PersonalChatScreen.swift`) | ❓ verify |

### 4.3 Attachments and media

| Canonical name | Android today | iOS today | Status |
|---|---|---|---|
| `MessageAttachments` | `MessageAttachmentGroup` | `MessageAttachments.swift` | ↔ rename Android |
| `MessageImageTile` | `AttachmentPhotoImage` | `MessageImageTile.swift` | ↔ rename Android |
| `MessageFileCard` | `FileAttachmentCard` | `MessageFileCard.swift` | ↔ rename Android |
| `AttachmentViewer` | `AttachmentPhotoViewer` | `AttachmentViewer.swift` | ↔ rename Android |
| `StagedAttachmentStrip` | `ComposerAttachmentQueue` | `StagedAttachmentStrip.swift` | ↔ rename Android |
| `StagedAttachmentTile` | `AttachmentDraftPhoto` | `StagedAttachmentTile.swift` | ↔ rename Android |
| `StickerMedia` | `StickerMessageMedia` | `StickerMedia.swift` | ↔ rename Android |
| `GifMedia` | `GifMessageMedia` | `GifMedia.swift` | ↔ rename Android |
| `MessageVideoPlayer` | `VideoMessageMedia` | `message-video-player.swift` | ↔ rename **both** |
| `MessageVoicePlayer` | `VoiceMessageMedia` | `message-voice-player.swift` | ↔ rename **both** |
| `VoiceRecordingControl` | `VoiceRecordButton` | `voice-recording-control.swift` | ↔ rename **both** |
| `PhotoGrid` / `PhotoRun` / `PhotoCell` | all in `ChatAttachmentComponents.kt` | ❓ inside `MessageAttachments` | ❓ verify layout parity |
| `UnavailableAttachmentCard` | `UnavailableAttachmentCard` | ❓ | ❓ verify |

### 4.4 Media picker

| Canonical name | Android today | iOS today | Status |
|---|---|---|---|
| `MediaPickerSheet` | `ChatMediaPickerSheet` | `MediaPickerSheet.swift` | ↔ rename Android |
| `MediaPickerTabs` | `MediaTabRow` | `MediaPickerTabs.swift` | ↔ rename Android |
| `MediaPickerSearchField` | ❓ inline | `MediaPickerSearchField.swift` | ➕ extract on Android |
| `StickerPanel` | `StickerTab` | `StickerPanel.swift` | ↔ rename Android |
| `GifPanel` | `GifTab` | `GifPanel.swift` | ↔ rename Android |
| `EmojiPanel` | `EmojiPickerContent.kt` | `EmojiPanel.swift` | ↔ rename Android |
| `GifGrid` | `GifGrid` | ❓ inside `GifPanel` | ❓ verify |
| `KlipyAttribution` | `KlipyAttribution` | ❓ | ❓ verify — licence-visible, must exist on both |

> `KlipyAttribution` is flagged for early verification because a missing provider attribution is
> a licence-compliance issue, not a cosmetic gap.

### 4.5 Shared content gallery

| Canonical name | Android today | iOS today | Status |
|---|---|---|---|
| `SharedContentGalleryScreen` | `SharedContentGalleryScreen` | `SharedContentGalleryScreen.swift` | ✅ aligned |
| `SharedContentPreviewScreen` | `SharedContentPreviewScreen.kt` | `SharedContentPreviewScreen.swift` | ✅ aligned |
| `SharedContentCategoryBar` | `SharedContentCategoryTabs` | `SharedContentCategoryBar.swift` | ↔ rename Android |
| `SharedContentMediaGrid` | `SharedContentMediaGrid` | `SharedContentMediaGrid.swift` | ✅ aligned |
| `SharedContentMediaThumbnail` | `SharedContentMediaTile` | `SharedContentMediaThumbnail.swift` | ↔ rename Android |
| `SharedContentMetadataRow` | `SharedContentMetadataRow` | `SharedContentMetadataRow.swift` | ✅ aligned |
| `SharedContentGallerySkeleton` | `SharedContentGallerySkeleton` | `SharedContentGallerySkeleton.swift` | ✅ aligned |
| `SharedContentGalleryNotice` | `SharedContentGalleryNotice` | `SharedContentGalleryNotice.swift` | ✅ aligned |
| `SharedContentUnavailableState` | `SharedContentGalleryEmpty` | `SharedContentUnavailableState.swift` | ↔ rename Android |
| `ShowEarlierBoundary` | `ShowEarlierBoundary` | `ShowEarlierBoundary.swift` | ✅ aligned |
| `SharedContentMetadataList` | `SharedContentMetadataList` | ❓ | ❓ verify |

### 4.6 Calls

| Canonical name | Android today | iOS today | Status |
|---|---|---|---|
| `CallOverlay` | `CallScreen` | `Screens/CallOverlay.swift` | ↔ rename Android |
| `CallPanel` | `CallPanel` | `CallPanel.swift` | ✅ aligned |
| `CallSurface` | ❓ | `CallSurface.swift` | ❓ verify |
| `CallVideoStage` | `VideoStage` | `CallVideoStage.swift` | ↔ rename Android |
| `LocalVideoPreview` | `CallVideoView` ❓ | `LocalVideoPreview.swift` | ❓ verify |
| `CallActivityPanel` | `AudioActivity` | `CallActivityPanel.swift` | ↔ rename Android |
| `CallActivityCell` | `ActivityCell` | ❓ inside `CallActivityPanel` | ❓ verify |
| `CallControls` | `CallControls` | `CallControls.swift` | ✅ aligned |
| `CallSettingsSheet` | `CallSettings` | `CallSettingsSheet` (in `CallControls.swift`) | ↔ rename + split both |
| `CallStatusHeader` | ❓ inside `CallPanel` | `CallStatusHeader.swift` | ❓ verify |
| `CallEntryButtons` | ❓ in `ChatTopBar` | `CallEntryButtons.swift` | ➕ extract on Android |
| `CallPromptActions` | ❓ | `CallPromptActions.swift` | ❓ verify |
| `CallChatPane` | ❓ | `CallChatPane.swift` | ❓ verify |
| `CompactCallBar` | `CompactCallBar` | ❓ | ❓ verify |

### 4.7 Account settings

Android `AccountSettingsSheet.kt` holds 16 declarations; iOS `AccountSettingsView.swift` holds 2.
**Both need splitting**, and iOS needs the page components extracted to match Android's page model.

| Canonical name | Android today | iOS today | Status |
|---|---|---|---|
| `AccountSettingsSheet` | `AccountSettingsSheet` | `AccountSettingsView` | ↔ rename iOS |
| `AccountSettingsHeader` | `AccountSettingsHeader` | ❓ inline | ➕ extract on iOS |
| `AccountPage` | `AccountPage` | ❓ inline | ➕ extract on iOS |
| `NotificationsPage` | `NotificationsPage` | ❓ inline | ➕ extract on iOS |
| `PrivacyPage` | `PrivacyPage` | ❓ inline | ➕ extract on iOS |
| `BlockedPeoplePage` | `BlockedPeoplePage` | ❓ inline | ➕ extract on iOS |
| `PresenceVisibilityPage` | `PresenceVisibilityPage` | ❓ inline | ➕ extract on iOS |
| `PresenceDurationPage` | `PresenceDurationPage` | ❓ inline | ➕ extract on iOS |
| `AppearancePage` | `AppearancePage` | ❓ inline | ➕ extract on iOS |
| `AccessibilityPage` | `AccessibilityPage` | ❓ inline | ➕ extract on iOS |
| `SettingsRow` | `SettingsRow` | `SettingsRow` (private) | ✅ aligned, split both |

### 4.8 Design system / shared UI

| Canonical name | Android today | iOS today | Status |
|---|---|---|---|
| `ActionButton` | `component/Button.kt` → `FishButton` ❓ | `Buttons/ActionButton.swift` | ❓ verify name |
| `IconButton` | `component/IconButton.kt` | `Buttons/IconButton.swift` | ✅ aligned |
| `InputField` | `component/TextField.kt` | `Fields/InputField.swift` | ↔ rename Android |
| `StateTextField` | `component/StateTextField.kt` | ❓ | ❓ verify |
| `Avatar` | `component/Avatar.kt` | `Identity/Avatar.swift` | ✅ aligned |
| `PresenceAvatar` | `feature/presence/PresenceAvatar.kt` | `Identity/PresenceAvatar.swift` | ⚠ different module |
| `PresenceIndicator` | `feature/presence/PresenceIndicator.kt` | `Identity/PresenceIndicator.swift` | ⚠ different module |
| `PresenceSummary` | `feature/presence/PresenceSummary.kt` | `Identity/PresenceSummary.swift` | ⚠ different module |
| `TopBar` | `component/TopBar.kt` | `Navigation/TopBar.swift` | ✅ aligned |
| `EmptyState` | `component/EmptyState.kt` | `Feedback/EmptyState.swift` | ✅ aligned |
| `Notice` | `component/Feedback.kt` ❓ | `Feedback/Notice.swift` | ❓ verify |
| `SkeletonBar` / `SkeletonAvatar` | `component/Feedback.kt` ❓ | `Feedback/Skeleton.swift` (2) | ↔ split both |
| `MicrophoneLevelMeter` | ❓ | `Feedback/MicrophoneLevelMeter.swift` | ❓ verify |

> **Module-placement divergence:** Android keeps presence UI in `:feature:presence`; iOS keeps it
> in the shared `UIComponents` target. That is a real structural difference. It is **out of scope**
> here — moving a component between Gradle modules / SwiftPM targets changes the dependency graph,
> which is exactly the kind of change this refactor promises not to make. Recorded in §9.

---

## 5. Preview parity

### 5.1 The mechanisms are not the same, and cannot be made the same

| | Android | iOS |
|---|---|---|
| Declaration | `@Preview` on a composable | `#Preview` macro |
| Count today | **126** | **1** (`AccountSettingsView.swift`) |
| Where they live | `src/screenshotTest/` source set, **not** `src/main` | alongside the view |
| Image verification | Compose Screenshot Testing → `pnpm android:screenshots` | swift-snapshot-testing → `assertThemedSnapshots(of:named:)` |
| Baseline path | `src/screenshotTestDebug/reference/<pkg>/<TestFileKt>/<Fn>_<name>_<hash>_0.png` | `Tests/<Target>/__Snapshots__/<TestClass>/<case>.<name>-<variant>.png` |
| Extra surface | – | `apps/ios/Catalog` app with `*Pages.swift` |

So "the preview should be the same" cannot mean "the same mechanism". Both platforms *do* have
image-baseline coverage; they declare it differently, and Android's deliberately lives in a
separate source set so previews never ship in the APK. **This plan does not overturn that.**

### 5.2 What parity means instead: a shared preview-case registry

One canonical list of preview case names per component, in kebab-case, implemented natively on
each side and enforced by script:

- **Android:** `@Preview(name = "message-bubble/outgoing-failed")` in `src/screenshotTest/`.
- **iOS:** `assertThemedSnapshots(of: view, named: "message-bubble/outgoing-failed")`.

Both already produce named image baselines, so matching the *names* gives the reviewable
side-by-side the goal asks for, without moving Android previews into `main` or bolting
snapshot-testing onto every SwiftUI file.

Canonical case names for `MessageBubble`, as the worked example (final list produced in Task 4.1):

| Case | Android `@Preview(name=)` | iOS `named:` |
|---|---|---|
| `message-bubble/incoming-text` | ✓ | ✓ |
| `message-bubble/outgoing-text` | ✓ | ✓ |
| `message-bubble/outgoing-sending` | ✓ | ✓ |
| `message-bubble/outgoing-failed` | ✓ | ✓ |
| `message-bubble/grouped-run` | ✓ | ✓ |
| `message-bubble/with-reactions` | ✓ | ✓ |
| `message-bubble/with-reply` | ✓ | ✓ |
| `message-bubble/emoji-only` | ✓ | ✓ |
| `message-bubble/long-body-rtl` | ✓ | ✓ |

Each also renders in the variants each harness already supports (light / dark / RTL / XL font on
iOS; `uiMode` + `fontScale` on Android). Variant coverage stays per-platform — see §6.2.

### 5.3 The baseline-path trap

Android baselines encode the **enclosing test file name** in their directory:

```
…/reference/space/fishhub/android/feature/chat/ChatScreenshotTestKt/
    AttachmentPhotoViewerScreenshot_attachment photo viewer_39328749_0.png
                                                            ^^^^^^^^ params hash
```

Consequences, and they are load-bearing for this plan:

1. **Splitting `src/main` component files does not touch baselines** — previews live in
   `screenshotTest`. Stage 1 is therefore baseline-safe.
2. **Splitting `ChatScreenshotTest.kt` renames every baseline directory under it.** Do this as a
   pure `git mv` of the PNGs so the bytes are provably unchanged, then re-run validation.
3. **Renaming a preview function or its `name =` changes the filename**, including the hash
   segment if parameters change. Stage 3 must move baselines in the same commit as the rename.

`git mv` + unchanged bytes + passing validation is a sound proof of behaviour preservation here:
the recorded pixels are identical, only the lookup path moved.

---

## 6. Rules the whole refactor follows

### 6.1 One component per file

- Exactly one public UI component per file; filename == component name.
- Private helpers, private sub-views, and that component's previews live in the same file.
- File count is not a cost. Do not merge small components for tidiness.
- Exclusions are only those listed in §3.3.

### 6.2 Props: how close is "as close as possible"

Adopt this precedence, in order:

1. **Same parameter names**, in the same conceptual order: required data first, then
   configuration, then callbacks, then content slots.
2. **Compose's `modifier` is exempt.** It is mandated to be the first optional parameter with
   default `Modifier`, and has no SwiftUI equivalent. It is *always* an allowed extra parameter on
   the Android side and is excluded from parity comparison by the check script.
3. **Trailing content slot last** on both sides — Compose because the guidelines say so, SwiftUI
   because `@ViewBuilder content:` conventionally goes last.
4. **Platform-native state plumbing is exempt**: SwiftUI `@Binding`, `@Environment`,
   `@AccessibilityFocusState`; Compose `remember`/`State` hoisting. These do not have to match.
5. Everything else must match, or be recorded as an accepted break in §8.

**Worked example — the divergence this rule has to resolve.** Today:

```kotlin
// Android — ChatComponents.kt
fun MessageBubble(
    message: MessageUiModel,
    onToggleGif: () -> Unit = {},
    onReportGif: () -> Unit = {},
    onRetry: () -> Unit = {},
    onPhotoAttachmentClick: (String) -> Unit = {},
    onFileAttachmentClick: (String) -> Unit = {},
    onFileAttachmentShare: (String) -> Unit = {},
    playingVoiceId: String? = null,
    onToggleVoice: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    onOpenActions: () -> Unit = {},
    onAddReaction: () -> Unit = {},
    onToggleReaction: (String) -> Unit = {},
    onReplyPreviewClick: (String) -> Unit = {},
    modifier: Modifier = Modifier,
)
```

```swift
// iOS — MessageBubble.swift
public init(
    row: MessageRowUiModel,
    onRetry: ((String) -> Void)? = nil,
    onAction: @escaping (MessageAction) -> Void = { _ in },
    onReplyTap: @escaping (String) -> Void = { _ in },
    reactionsEnabled: Bool = true,
    attachmentCommands: (any AttachmentCommandProviding)? = nil,
    imageLoader: MessageImageLoader = .shared,
    fileDownloader: AttachmentFileDownloader = AttachmentFileDownloader()
)
```

These are not two spellings of one API — Android fans out 10 callbacks, iOS funnels them through
one `MessageAction` enum. Converging them means **changing one platform's public API and its call
sites**, which is a redesign, not a move. Hence Stage 5, and hence its opt-in gate.

The recommended convergence target is **iOS's shape** (single `onAction: (MessageAction) -> Unit`)
because `MessageAction` already exists as a shared concept and it keeps the parameter list
stable as actions are added — but that is a decision to confirm, not to assume.

### 6.3 Visibility

Extracting a nested/private component to its own file necessarily widens its visibility.
Default rule:

- Android: `internal` unless the component is used across Gradle modules, then `public`. Never
  widen further than the split requires.
- iOS: `internal` (no keyword) unless already `public` or used across SwiftPM targets.

Widening visibility is not a behaviour change, but it *is* API surface growth. The check script
in Task 0.3 fails the build if a component becomes `public` without a registry entry saying so.

---

## 7. The plan

Five stages. Stages 1–4 are behaviour-preserving. Stage 5 is not automatically safe and is gated.

Everything is committed with the repo's existing convention — `refactor(android):`,
`refactor(ios):`, `test(android):`, `docs:` — imperative mood, lowercase after the colon, **no
`Co-Authored-By` trailer** (the repo has zero, in 900+ commits).

### Stage 0 — Guardrails (do first, no source moves)

#### Task 0.1: Freeze the baseline evidence

**Files:** `docs/native-parity-refactor-baseline.md` (create)

- [ ] **Step 1: Record the current green state**

```bash
pnpm android:check 2>&1 | tee /tmp/android-before.log
```

```bash
pnpm ios:test 2>&1 | tee /tmp/ios-before.log
```

- [ ] **Step 2: Record baseline artifact checksums**

```bash
find apps/android -path "*screenshotTestDebug/reference*" -name "*.png" -exec shasum {} + | sort -k2 > docs/native-parity-refactor-baseline.txt
```

```bash
find apps/ios/FishKit/Tests -path "*__Snapshots__*" -name "*.png" -exec shasum {} + | sort -k2 >> docs/native-parity-refactor-baseline.txt
```

- [ ] **Step 3: Commit**

```bash
git add docs/native-parity-refactor-baseline.txt docs/native-parity-refactor-baseline.md && git commit -m "docs: freeze native ui baseline checksums before parity refactor"
```

> Every later stage re-runs this checksum and diffs it. A changed checksum on a stage 1–4 commit
> means the refactor changed rendering, and the commit is wrong.

#### Task 0.2: Land the component registry

**Files:** `design/parity/native-components.json` (create)

- [ ] **Step 1: Write the registry** — one entry per §4 row:

```json
{
  "version": 1,
  "components": [
    {
      "name": "MessageBubble",
      "group": "chat/message",
      "android": {
        "file": "apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/views/MessageBubble.kt",
        "symbol": "MessageBubble",
        "visibility": "internal"
      },
      "ios": {
        "file": "apps/ios/FishKit/Sources/PersonalChat/Views/MessageBubble.swift",
        "symbol": "MessageBubble",
        "visibility": "public"
      },
      "props": ["row", "onRetry", "onAction", "onReplyTap", "reactionsEnabled"],
      "previews": [
        "message-bubble/incoming-text",
        "message-bubble/outgoing-text",
        "message-bubble/outgoing-sending",
        "message-bubble/outgoing-failed",
        "message-bubble/grouped-run",
        "message-bubble/with-reactions",
        "message-bubble/with-reply",
        "message-bubble/emoji-only",
        "message-bubble/long-body-rtl"
      ],
      "propsAligned": false,
      "previewsAligned": false,
      "notes": "Android fans out 10 callbacks; iOS funnels through MessageAction. Stage 5."
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add design/parity/native-components.json && git commit -m "docs: add native component parity registry"
```

#### Task 0.3: Add the parity check script

**Files:** `scripts/verify-native-parity.mjs` (create), `package.json` (modify)

Follows the existing `scripts/verify-*.mjs` pattern (`verify-android-design-system.mjs`,
`verify-chat-media-catalogs.mjs`).

- [ ] **Step 1: Write the script.** It must fail with a non-zero exit and a readable message when:
  1. a registry entry's `android.file` or `ios.file` does not exist;
  2. a registry entry's declared `symbol` is not declared in that file;
  3. a file listed in the registry declares **more than one** public UI component
     (`^@Composable` + `fun [A-Z]` on Android; `struct X: View` on iOS), excluding `private`;
  4. a UI component exists on disk but has no registry entry;
  5. `propsAligned: true` but the parameter name lists differ (after removing `modifier` and the
     §6.2 exemptions);
  6. `previewsAligned: true` but the `@Preview(name=)` set and `assertThemedSnapshots(named:)`
     set differ;
  7. a symbol is `public` on either side without `visibility: "public"` in the registry.

- [ ] **Step 2: Wire it up**

```json
"parity:verify": "node scripts/verify-native-parity.mjs"
```

and append `&& pnpm parity:verify` to the existing `android:check` script.

- [ ] **Step 3: Run it — expect failures, that is the point**

```bash
pnpm parity:verify
```

Expected: non-zero exit listing every current violation. This is the work list for stages 1–4.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-native-parity.mjs package.json && git commit -m "test: add native component parity verification script"
```

> **Why the script comes before the moves:** it turns "did we finish?" from a judgement call into
> a command. It also stops the tree drifting back — nothing new can land as a bucket file.

---

### Stage 1 — Android mechanical split (names unchanged)

The biggest, safest win. **Move code verbatim. Do not rename anything. Do not touch props.**

Per-file procedure, applied to each bucket file in turn:

1. Create the target directory (`views/`, `screens/`, `mediapicker/`, `sharedcontent/`).
2. For each composable, create `<Name>.kt`, move the function **byte-for-byte**, carry its private
   helpers, add the package declaration and the imports it needs.
3. Delete the emptied source file when its last declaration is gone.
4. Compile. The compiler catches every missed import and visibility problem.
5. Run unit + screenshot tests. **Baselines must not move** — previews live in `screenshotTest`.
6. Commit one bucket file per commit.

Because this is a verbatim move of code that already exists, the plan does not reproduce each
composable's body. The moved text is the existing text; the compiler and the image baselines are
the proof.

#### Task 1.1: Resolve the ❓ rows first

**Files:** `design/parity/native-components.json` (modify)

- [ ] **Step 1:** For each `❓ verify` row in §4, read both implementations and classify as
  `same`, `android-only`, or `ios-only`, recording the evidence (file:line on each side) in the
  registry `notes`.
- [ ] **Step 2:** Escalate any row that turns out to be a genuine **feature** gap rather than a
  decomposition difference — that is a product finding, not a refactor task, and it does not get
  fixed here. `KlipyAttribution` first: a missing provider attribution is a licence issue.
- [ ] **Step 3: Commit**

```bash
git add design/parity/native-components.json && git commit -m "docs: resolve native component parity unknowns"
```

#### Task 1.2: Split `ChatComponents.kt` (893 → 14 files)

**Files:**
- Delete: `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatComponents.kt`
- Create in `.../feature/chat/views/`: `ChatTopBar.kt`, `MessageBubble.kt`,
  `LinkPreviewSurface.kt`, `ReplyPreviewSurface.kt`, `MessageDeliveryStatus.kt`,
  `MessageDateSeparator.kt`, `UnreadMessageDivider.kt`, `TypingIndicator.kt`,
  `ChatConnectionNotice.kt`, `OlderMessagesState.kt`, `MessageComposer.kt`,
  `VoiceRecordButton.kt`
- `messageShape()` and `MessageDeliveryUiState.localizedLabel` are helpers, not components: move
  each next to its single consumer (`MessageBubble.kt` and `MessageDeliveryStatus.kt`).

- [ ] **Step 1:** Create `views/` and move each composable verbatim, one file per component, with
  package `space.fishhub.android.feature.chat.views`.
- [ ] **Step 2:** Build

```bash
pnpm android:assemble
```

Expected: BUILD SUCCESSFUL. Any failure is a missing import or a visibility narrowing — fix
without editing composable bodies.

- [ ] **Step 3:** Unit tests

```bash
pnpm android:test
```

Expected: all pass, same count as `/tmp/android-before.log`.

- [ ] **Step 4:** Screenshots — the real proof

```bash
pnpm android:screenshots
```

Expected: pass with **zero** baseline changes.

- [ ] **Step 5:** Prove no baseline moved

```bash
find apps/android -path "*screenshotTestDebug/reference*" -name "*.png" -exec shasum {} + | sort -k2 | diff - <(grep "apps/android" docs/native-parity-refactor-baseline.txt)
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add -A apps/android/feature/chat && git commit -m "refactor(android): split chat components into one file per composable"
```

#### Tasks 1.3 – 1.11: Repeat for the remaining bucket files

Identical six-step procedure. One commit each.

| Task | File | → | Target dir | Commit subject |
|---|---|---:|---|---|
| 1.3 | `ChatScreen.kt` | 8 | `screens/` + `views/` | `refactor(android): split chat screen into one file per composable` |
| 1.4 | `ChatAttachmentComponents.kt` | 10 | `views/` | `refactor(android): split chat attachment components into one file per composable` |
| 1.5 | `ChatAttachmentDraftComponents.kt` | 12 | `views/` | `refactor(android): split attachment draft components into one file per composable` |
| 1.6 | `ChatMediaComponents.kt` | 7 | `views/` | `refactor(android): split chat media components into one file per composable` |
| 1.7 | `ChatMediaPickerSheet.kt` | 10 | `views/mediapicker/` | `refactor(android): split media picker into one file per composable` |
| 1.8 | `MessageSearchScreen.kt` | 6 | `screens/` + `views/` | `refactor(android): split message search into one file per composable` |
| 1.9 | `sharedcontent/SharedContentGalleryComponents.kt` | 11 | `views/sharedcontent/` | `refactor(android): split shared content gallery components into one file per composable` |
| 1.10 | `feature/call/CallScreen.kt` | 10 | `feature/call/views/` | `refactor(android): split call screen into one file per composable` |
| 1.11 | `feature/settings/AccountSettingsSheet.kt` | 16 | `feature/settings/views/` | `refactor(android): split account settings into one file per composable` |

> **Note on Task 1.11:** `AccountSettingsSheet.kt` also holds four `.label` extension properties
> on enum types and `AccountSettingsPreviewContent`. Extensions go with their enum in
> `AccountSettingsModels.kt` per the Kotlin convention (*"when defining extension functions for a
> class which are relevant for all clients of this class, put them in the same file with the class
> itself"*). `AccountSettingsPreviewContent` is fixture data → move to a samples file.

#### Task 1.12: Split `ChatRoute.kt` and `MainActivity.kt`

`ChatRoute.kt` (917) and `MainActivity.kt` (1 171) are wiring, not components, but both exceed the
Kotlin size guidance and `ChatRoute.kt` declares 3 composables.

- [ ] Extract the 3 composables from `ChatRoute.kt` into `screens/`; leave navigation wiring.
- [ ] Split `MainActivity.kt` by responsibility (activity lifecycle / nav graph / dependency
      wiring / intent handling) — **not** by component, since it has none.
- [ ] Same 6-step verification. Two commits.

---

### Stage 2 — iOS residual split

#### Task 2.1: Split `FishApp.swift` (1 841 lines — the single worst file in the repo)

**Files:**
- Modify: `apps/ios/App/Sources/FishApp.swift` → keeps only `FishApp` and `FishAppConfiguration`
- Create: `FishAppDelegate.swift`, `FishRoot.swift`, `LoadingView.swift`, `SignInView.swift`,
  `InboxView.swift`, `ConversationView.swift` (lines 346–667 — the biggest single extraction),
  `FishAppModel.swift` (lines 667–1 744), `SharedContentDocumentExporter.swift`,
  `ConversationDestination.swift`, `FishNotificationDestination.swift`,
  `PendingConversationDestination.swift`, `SharedContentGalleryModelHolder.swift`

- [ ] **Step 1:** Move each type verbatim into its own file. `private` types that cross a file
      boundary become `internal` (§6.3) — nothing wider.
- [ ] **Step 2:** Build

```bash
pnpm ios:app:build
```

- [ ] **Step 3:** Test

```bash
pnpm ios:test
```

- [ ] **Step 4:** Verify snapshot checksums unchanged (same diff as Task 1.2 Step 5, iOS paths).
- [ ] **Step 5: Commit**

```bash
git add -A apps/ios/App && git commit -m "refactor(ios): split app entry into one type per file"
```

#### Tasks 2.2 – 2.3: Remaining multi-view Swift files

| Task | File | Views | Commit subject |
|---|---|---:|---|
| 2.2 | `PersonalChat/Views/SharedContentGalleryComponents.swift` | 8 | `refactor(ios): split shared content gallery components into one file per view` |
| 2.3 | `SharedContentGalleryScreen.swift`, `AccountSettingsView.swift`, `PersonalChatScreen.swift`, `MessageBody.swift`, `AttachmentViewer.swift`, `ActionButton.swift`, `CallControls.swift`, `ReactionPill.swift`, `Skeleton.swift` | 2–3 each | one commit per file, `refactor(ios): split <name> into one file per view` |

> `SharedContentGalleryScreen.swift` also holds 8 non-view types (scroll-restoration coordinator,
> preference keys, `UIViewRepresentable`). Those go to `PersonalChat/Logic/` and
> `PersonalChat/Models/` per the existing FishKit concern folders — not into `Views/`.

#### Task 2.4: Fix the kebab-case folders

**Files:**
- `Views/message-voice-player/message-voice-player.swift` → `Views/MessageVoicePlayer.swift`
- `Views/message-voice-player/VoicePlaybackSpeed.swift` → `Models/VoicePlaybackSpeed.swift`
- `Views/message-video-player/message-video-player.swift` → `Views/MessageVideoPlayer.swift`
- `Views/voice-recording-control/voice-recording-control.swift` → `Views/VoiceRecordingControl.swift`

- [ ] **Step 1:** `git mv` each file; rename the types to match (§2.4 — this is the one place the
      iOS tree violates its own convention, imported from the web component-folder rule).
- [ ] **Step 2–4:** build, test, checksum-diff.
- [ ] **Step 5: Commit**

```bash
git add -A apps/ios/FishKit && git commit -m "refactor(ios): rename media player views to swift file conventions"
```

---

### Stage 3 — Shared vocabulary

Now — and only now, with both trees one-per-file — apply the canonical names from §4.

#### Task 3.1: Rename Android components to canonical names

One commit per group (message surface / shell / attachments / picker / shared content / calls /
settings / design system), ~8 commits.

- [ ] **Step 1:** IDE-level rename (symbol + file) for each `↔ rename` row.
- [ ] **Step 2:** Update `@Preview(name = …)` strings that embed old names.
- [ ] **Step 3:** `git mv` the affected baseline PNGs to their new paths. **Byte content must not
      change** — verify:

```bash
git diff --cached --numstat -- "*.png"
```

Expected: every line reads `0	0	<path>` (pure rename, zero changed lines).

- [ ] **Step 4:** `pnpm android:check`
- [ ] **Step 5: Commit**, e.g.

```bash
git commit -m "refactor(android): rename chat message components to shared vocabulary"
```

#### Task 3.2: Rename iOS components to canonical names

Same procedure for the iOS `↔ rename` rows (`AccountSettingsView` → `AccountSettingsSheet`,
`CallSettingsSheet` extraction, media players from Task 2.4). Update
`assertThemedSnapshots(named:)` strings and `git mv` the `__Snapshots__` PNGs.

#### Task 3.3: Extract the missing counterparts

For each `➕` row — a component that exists inline on one platform and standalone on the other —
extract it so both platforms have the same component set. Still a move, still verbatim.

- [ ] Android: `MessageBody`, `MediaPickerSearchField`, `CallEntryButtons`
- [ ] iOS: `MessageDeliveryStatus`, `ConversationRow`, and the 8 `AccountSettings` page views
- [ ] Same 5-step verification, one commit per component.

#### Task 3.4: Flip `previewsAligned` groundwork

- [ ] Update the registry so every component's `android.symbol` and `ios.symbol` now match.
- [ ] `pnpm parity:verify` — expected: all naming and one-per-file checks pass; only
      `propsAligned` / `previewsAligned` failures remain.
- [ ] Commit: `docs: align native component registry with renamed components`

---

### Stage 4 — Preview case parity

#### Task 4.1: Define the canonical case list per component

- [ ] **Step 1:** For each component, list the preview cases that exist today on each side
      (Android `@Preview(name=)`, iOS `assertThemedSnapshots(named:)`).
- [ ] **Step 2:** Take the **union** as canonical, in a fixed order, kebab-cased with the
      component prefix (§5.2). Never delete an existing case to force a match — a case that
      exists on only one platform is coverage the other platform is missing.
- [ ] **Step 3:** Write the list into each registry entry's `previews`.
- [ ] **Step 4:** Commit: `docs: define canonical preview cases for native components`

#### Task 4.2: Fill the gaps, one component at a time

- [ ] **Step 1:** Add the missing `@Preview` / `assertThemedSnapshots` case.
- [ ] **Step 2:** Record its baseline (`-Pandroid.experimental.enableScreenshotTest` record task /
      `record: true` on the Swift side).
- [ ] **Step 3: Eyeball the recorded PNG against `docs/ui-ux-agent-guidelines.md`.** A recorded
      baseline that was never looked at proves nothing — it just freezes whatever rendered,
      including a bug.
- [ ] **Step 4:** Set `previewsAligned: true`; run `pnpm parity:verify`.
- [ ] **Step 5:** Commit per component: `test(android): add missing message bubble preview cases`

> This stage **adds** baselines. That is the one place in stages 1–4 where the checksum file
> legitimately grows — existing entries must still be unchanged; only new lines may appear.

---

### Stage 5 — Prop reconciliation (risky, opt-in)

**Do not start this stage as part of the same push as stages 1–4.** Get 1–4 merged and living
first. Stages 1–4 are provably behaviour-preserving; this one is not.

Each component with `⚠ props differ` is its own decision:

- [ ] **Step 1:** Write the proposed shared signature into the registry `props`, plus which
      platform changes and why.
- [ ] **Step 2:** Get the signature reviewed **before** editing code. For `MessageBubble` this
      means deciding N-callbacks vs single-`onAction` (§6.2 recommends `onAction`).
- [ ] **Step 3:** Change the signature and every call site.
- [ ] **Step 4:** Full verification, and **read the image diffs** rather than re-recording. If a
      baseline changes here, that is a real rendering change and the commit is wrong unless
      deliberately justified.
- [ ] **Step 5:** Set `propsAligned: true`; commit per component:
      `refactor(android): converge message bubble props with ios`

Components in scope: `MessageBubble`, `PersonalChatTopBar`, `MessageComposer`, plus whatever
Task 1.1 adds. Expect this stage to be **as large as stages 1–4 combined**.

---

## 8. Where parity cannot hold

Recorded rather than forced. The check script exempts each of these explicitly.

| # | Break | Why | Handling |
|---|---|---|---|
| 1 | Compose `modifier: Modifier = Modifier` | Compose API guidelines *mandate* it as the first optional parameter; SwiftUI has no equivalent | Always allowed as an extra Android parameter; excluded from prop comparison |
| 2 | Case style: `views/` vs `Views/`, `mediapicker/` vs `MediaPicker/` | Kotlin packages are lowercase; Swift folders are UpperCamelCase | Compared case-insensitively |
| 3 | SwiftUI `@Binding` / `@Environment` / `@AccessibilityFocusState`; Compose state hoisting | Different state models. `PersonalChatTopBar` already shows this — iOS has `requestedFocus: Binding<…>`, Android has no counterpart | Exempt from prop comparison |
| 4 | Preview mechanism: `@Preview` in a separate source set vs `#Preview` + snapshot tests | Android deliberately keeps previews out of `src/main` so they never ship; iOS has no equivalent source-set concept | Parity enforced on **case names**, not mechanism (§5.2) |
| 5 | Preview variant axes (`uiMode`/`fontScale` vs `light`/`dark`/`rtl`/`xl`) | Each harness has its own variant model | Per-platform; only the case list is compared |
| 6 | Trailing-lambda vs `@ViewBuilder` slots | Kotlin trailing lambda is a language feature | Slot must be last on both sides; syntax differs |
| 7 | Android tablet-only components (`ChatAdaptiveLayout`, `ConversationRail`) | The iOS app has no tablet layout today | `android-only` in the registry; **not** a bug to fix here |
| 8 | Presence UI module placement (Android `:feature:presence` vs iOS `UIComponents`) | Moving it changes the dependency graph | Out of scope — §9 |
| 9 | `AnyView` erasure in iOS slot parameters vs typed `@Composable () -> Unit` | Swift generics vs Kotlin function types | Accepted; names still match |
| 10 | Android design-system `Fish` prefix (`FishButton`, `FishSurface`, `FishTopBar`, …) | Material 3 already owns `Button`, `Surface`, `TextField`, `TopBar`, `Divider`, `IconButton`, `Theme` in the Compose namespace; iOS has no such collision | 8 explicit pairings carrying `namingBreak: "android-material-collision"` in the registry; excluded from rename and from name comparison |
| 12 | `Avatar` accessibility default: Android announces the name, FishKit hides the avatar (`isDecorative` defaults `true`) and lets the row carry it | Pre-existing behavioural difference, not a naming one. The parameter now exists on both sides with Android defaulting to its current behaviour, so no rendering or announcement changed | **Open product question** — double-announcement is a real screen-reader concern for this audience; picking one default is an accessibility decision, not a refactor |
| 11 | Screenshot coverage level: Android screen-level, iOS component-level | Different test strategies predating this refactor, not a naming problem | Measured by `pnpm parity:verify --previews`; closing it is stage 4 and needs a scope decision |

---

## 9. Explicitly out of scope

Real problems found while surveying, deliberately **not** in this plan. Each would break the
zero-behaviour-change promise or the mobile scope rule in `AGENTS.md`.

1. **Oversized non-UI files.** `ChatViewModel.kt` (1 445), `SupabaseChatRemoteDataSource.kt`
   (1 279), `DefaultChatRepository.kt` (1 229), `ConversationStore.swift` (1 330),
   `SharedContentState.swift` (1 129), `CoreDataSharedContentCache.swift` (1 018). These need
   decomposing, but splitting a reducer or a repository is a behaviour-risk change that deserves
   its own plan and its own test strategy.
2. **Moving components between modules/targets** (the presence-UI divergence). Changes the
   dependency graph.
3. **The iOS `Catalog` app** (`CallPages.swift`, `ConversationPages.swift`, …). It has no Android
   counterpart. Whether Android should grow one is a product question.
4. **Any feature gap** Task 1.1 turns up. Missing functionality is not refactor scope — it gets
   reported, not silently built.
5. **`apps/web`**, `packages/*`, Supabase.

---

## 10. Verification summary

| Stage | Command | Expected |
|---|---|---|
| every commit | `pnpm android:assemble` / `pnpm ios:build` | compiles |
| every commit | `pnpm android:test` / `pnpm ios:test` | same pass count as `/tmp/*-before.log` |
| stages 1–3 | `pnpm android:screenshots` | pass, **zero** baseline byte changes |
| stages 1–3 | checksum diff vs `docs/native-parity-refactor-baseline.txt` | empty |
| stage 3 | `git diff --cached --numstat -- "*.png"` | every line `0	0	<path>` (pure renames) |
| stage 4 | checksum diff | existing lines unchanged; new lines only |
| stage 5 | image diffs | **read them** — do not re-record to make them go away |
| any time | `pnpm parity:verify` | shrinking failure list; green at end of stage 4 |
| final | `pnpm android:check` + `pnpm ios:test` + `pnpm parity:verify` | all green |

---

## 11. Realistic sizing

| Stage | Files touched | Files created | Risk |
|---|---:|---:|---|
| 0 — guardrails | 2 | 3 | none |
| 1 — Android split | ~15 | ~105 | low |
| 2 — iOS split | ~12 | ~30 | low |
| 3 — shared vocabulary | ~90 + baselines | 11 | low-medium |
| 4 — preview parity | ~40 test files | new baselines | low |
| 5 — prop reconciliation | ~40 + all call sites | 0 | **high** |

Stages 0–2 are the ones that pay for themselves immediately and carry almost no risk: they are
compiler-verified moves with byte-identical image baselines. If the appetite for this shrinks
partway, **stopping after stage 2 leaves the codebase strictly better** and the registry in place
to finish later.
