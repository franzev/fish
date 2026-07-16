# Native iOS (SwiftUI) personal chat foundation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A native, testable SwiftUI design-system and component foundation for FISH one-to-one personal chat — tokens, theme, reusable components, and a stateless personal-chat screen that renders every required state from sample data, before any networking or feature logic exists.

**Architecture:** One local Swift package (`FishKit`) with three product modules in a strict dependency line — `DesignSystem` (generated tokens, fonts, icons, motion) ← `UIComponents` (generic components) ← `PersonalChat` (chat models + chat components + stateless screen) — plus a `TestSupport` fixtures module and a debug-only XcodeGen catalog app that hosts everything for review and accessibility audits. Design tokens are generated from a cross-platform JSON manifest whose values are extracted verbatim from the implemented web CSS.

**Tech Stack:** Swift 6 (strict concurrency), SwiftUI, iOS 17.0 deployment floor, Swift Testing (unit), pointfree swift-snapshot-testing (visual regression), XCTest UI tests + `performAccessibilityAudit` (accessibility), Node ESM scripts via pnpm (token generation + source guards), XcodeGen (catalog app project).

**Status:** Proposed implementation plan · Prepared 2026-07-16 · Companion to `docs/android-personal-chat-foundation-plan.md` — the two plans share scope boundaries, the token manifest, and the component inventory. Names differ by platform convention: the Android plan's `Fish`-prefixed wrappers are idiomatic Compose (as in Google's Now in Android), while this plan uses unprefixed descriptive names because Swift modules are the namespace (see "Naming and structure conventions").

---

## Outcome and scope

The milestone is complete when a debug-only component catalog and a stateless `PersonalChatScreen` render every required state with sample data, in light and dark themes, at large Dynamic Type sizes and RTL, with passing token-parity, contrast, component, snapshot, and accessibility-audit checks.

It will **not** connect to Supabase, send a real message, authenticate a user, or introduce any group, call, media, notification, search, reaction, or conversation-creation behavior.

### Included

- `apps/ios` workspace scaffold: one Swift package + debug catalog app
- Cross-platform token manifest (`design/tokens/fish.tokens.json`) and iOS token generation
- Light/dark color system, typography (Lexend + Fraunces with Dynamic Type), spacing, sizes, shapes, icons, motion policy
- Reusable generic SwiftUI components (buttons, icon buttons, text field, avatar, notice, skeleton, empty state, top bar)
- Reusable one-to-one chat components (bubble, delivery status, separators, typing indicator, connection notice, pagination slot, composer, transcript)
- Stateless `PersonalChatScreen` + full screen-state fixture matrix
- Automated visual, semantic, accessibility, and token-policy checks; manual device checklist

### Excluded (release gates, not priorities)

- Supabase SDK, auth, repositories, Edge Function calls, Realtime, persistence, offline queues, push
- Swift port of the portable chat reducer (`packages/core/src/chat-state`) — that is follow-on milestone 1
- Production navigation, view models, conversation list, iPad list-detail layout
- Search, reactions, replies, edits, deletes, attachments, images, GIFs, stickers, voice notes
- Group chat, community chat, audio/video calls

No module, component parameter, placeholder action, or dependency for excluded features may be added. Do not create `isGroupChat`/`callsEnabled` style flags.

## Binding product constraints

Precedence when guidance conflicts:

1. `AGENTS.md` and `PRODUCT.md`
2. `DESIGN.md`, `DESIGN.json`, and implemented tokens in `apps/web/app/globals.css`
3. `docs/ui-ux-agent-guidelines.md`
4. Apple Human Interface Guidelines / platform guidance

Non-negotiables that shape every task below:

- **One primary action per screen.** In the chat thread it is **Send message**, and the send control appears only when the draft contains sendable text (matches the web contract). Back/retry/navigation use quiet treatments.
- **Assigned, never chosen.** No conversation gallery, picker, or new-conversation flow. A user with one authorized conversation opens it directly.
- **Monochrome hierarchy, zero shadows.** Separation by surface lightness steps, spacing, semantic borders, dividers, scrim. Never neumorphism/glass. The primary action is a full-contrast inversion, not a hue.
- **Copy never scolds.** Sentence case, plain verbs, outcome-specific labels ("Send message", not "OK"). Errors use calm desaturated tokens, never alarming red, never prefixed "Error".
- **Targets:** ≥ 44×44 pt for touch controls (Apple's HIG floor equals FISH's web floor — unlike Android, no upsizing is needed); 56 pt for the focused primary control; 20 pt icon glyphs.
- **State changes preserve geometry.** Focus, loading, validation, and selection must not shift nearby content (e.g. the reserved 144 pt older-messages slot).
- **Progress is visual, never a grade; reward-only gamification; no streaks.** (No progress UI ships in this milestone, but no component may leak a percentage-as-judgement.)
- **Reduced motion is honored everywhere**: durations collapse and loops stop (never flicker) under `accessibilityReduceMotion`.
- **Tokens only.** No raw color, spacing, type-size, radius, duration, or opacity literals outside generated token files — enforced by a guard script and tests.

## Architectural decisions and rationale

| Decision | Choice | Rationale |
| --- | --- | --- |
| UI toolkit | Pure SwiftUI, no UIKit view controllers in product code | SwiftUI is Apple's recommended UI framework and its accessibility, Dynamic Type, focus, and keyboard-avoidance defaults are strong. UIKit appears only inside the token layer (dynamic `UIColor` provider) and test harnesses. |
| Deployment floor | iOS 17.0 | Gives `defaultScrollAnchor`, `scrollPosition`, `@Observable` (needed in follow-on milestones), and modern Swift concurrency defaults, while covering effectively the whole active install base by mid-2026. Raising the floor later is cheap; lowering it is not. |
| Language mode | Swift 6, strict concurrency | Greenfield code; every UI model is a `Sendable` value type, so strictness costs nothing now and prevents a migration later when realtime state arrives. |
| Module strategy | One local SPM package (`FishKit`) with four targets, not four packages and not an Xcode-project-first layout | Targets give real visibility boundaries (`UIComponents` cannot import `PersonalChat`; nothing imports Supabase) with a single `Package.swift` to maintain. Matches the Android plan's "small multi-module foundation" without Gradle-level ceremony. New targets are added only when a real dependency boundary appears (chat-state, data). |
| App project | XcodeGen-generated debug catalog app; `.xcodeproj` is gitignored | The catalog is the only thing that needs an Xcode project (packages build/test headless). A 40-line `project.yml` is diffable and reviewable; a checked-in `.xcodeproj` is merge-conflict bait. The catalog is a dev tool — the client-facing "no menus" rule does not apply to it, and it never ships. |
| Token source of truth | `design/tokens/fish.tokens.json`, extracted from the implemented web CSS; a Node generator emits Swift | Web stays authoritative while native platforms are introduced (same staging as the Android plan — whichever native milestone lands first creates the manifest; the other consumes and extends it). Generation + a `--check` drift gate prevents iOS becoming a second hand-maintained token source. |
| Color implementation | OKLCH → sRGB conversion at generation time; dynamic light/dark `UIColor` providers wrapped in SwiftUI `Color` | The system resolves light/dark natively (matching web `light-dark()`), works in every rendering context, and keeps components ignorant of theme. Conversion happens once, offline, with known-answer tests — no runtime color math. |
| Theme access | Static token namespaces (`Palette`, `Spacing`, `Radius`, `Metrics`, `Typography`, `Motion`), not an Environment-injected theme object | FISH has exactly one brand theme; light/dark is handled inside dynamic colors, and reduced motion comes from the system environment. An Environment theme would add indirection with no current variation to justify it — and can be introduced later without touching call sites if theming ever becomes real. |
| Dynamic / system color, Liquid Glass | Opted out; FISH draws its own chrome (custom `TopBar`, no `UINavigationBar` styling dependence) | System materials and tinting would break the tested monochrome hierarchy and cross-platform parity — the same reasoning as Android disabling Material dynamic color. Custom chrome also isolates us from system design-language shifts (e.g. glass toolbars), which FISH explicitly prohibits behind core work. |
| Fonts | Bundled Lexend (body/UI) + Fraunces (headings) variable fonts, registered at runtime from the package bundle; sizes scale with Dynamic Type via `relativeTo:` | Preserves product identity and offline rendering, matches web/Android. Dynamic Type support is an accessibility floor for this audience; `Font.custom(_:size:relativeTo:)` keeps the fixed ladder while allowing system scaling without caps. |
| Icons | Curated Tabler outline SVGs (stroke retuned to 1.75) in an asset catalog behind a semantic `Icon` enum — not SF Symbols | Keeps the exact 20 px / 1.75-stroke visual language shared with web and Android, and keeps feature code independent of icon filenames. SF Symbols would fracture cross-platform parity and mix icon grammars. Rejected alternative recorded here deliberately. |
| Component state | Stateless views: models in, closures out; no view fetches its own store, client, or navigation | Mirrors Compose unidirectional data flow decision on Android; keeps previews/snapshots deterministic and guarantees the follow-on `@Observable` store can bind without rewriting any view. This is the single biggest rework-avoidance lever in the plan. |
| Touch targets | 44 pt floor, 56 pt primary | Apple HIG floor is 44 pt — identical to FISH's web token, so iOS keeps 1:1 parity (Android alone upsizes to its 48 dp platform floor). |
| Elevation | None. No `.shadow()` anywhere; scrim token for modal depth | Direct port of the web/Android rule; enforced by the guard script. |
| Initial device scope | iPhone-first, single-thread layout; content capped at the 720 pt chat width token and centered | Phase 1 has exactly one conversation and no list. `NavigationSplitView` list-detail arrives with the multi-conversation milestone; capping/centering the transcript now means that milestone adds panes without touching chat components. (Deliberate divergence from the Android plan, which builds its conversation row and adaptive panes in its foundation — on iOS those would be dead code for a phase with no conversation list.) |
| Unit tests | Swift Testing (`@Test`/`#expect`) | The current first-party framework in Xcode 16+; less boilerplate than XCTest for value-type logic. XCTest remains only where required (UI tests / accessibility audits). |
| Visual regression | pointfree `swift-snapshot-testing` (device-pinned image snapshots, light/dark/XL-type/RTL), baselines committed | Franz verifies with tests, not previews. Snapshot tests are the only automated way to hold the visual contract; the library is the de-facto standard, runs headless in package tests on a simulator, and supports Swift Testing natively (≥ 1.17). |
| Accessibility verification | `XCUIApplication.performAccessibilityAudit()` over catalog pages + semantics assertions in component tests | The iOS analog of Android's Compose accessibility checks: automated contrast/label/target/Dynamic-Type audits, with VoiceOver manual checks reserved for the acceptance wave. |
| Data layer (future) | `supabase-swift` behind FISH-owned repository protocols, adopted only in follow-on milestone 2 | Same port-and-adapter boundary as web (`docs/react-native-reusability-audit.md` documents the seam) and Android. No provider types may ever reach view or model code. |
| Naming | No product prefixes on types, files, or folders; descriptive domain nouns instead. The umbrella package keeps the single product name (`FishKit`) | Swift types are namespaced by their module — Objective-C-style prefixes are obsolete. Where a plain name would fight SwiftUI's vocabulary (`Button`, `TextField`, `Color`), the fix is a more specific name (`ActionButton`, `InputField`, `Palette`), never a prefix. Product-named umbrella packages follow Apple's own sample convention (`FoodTruckKit`, `BackyardBirdsUI`). See "Naming and structure conventions" below. |

### Naming and structure conventions (research notes, 2026-07)

What current guidance says, and the rules this plan derives from it:

**Prefixes are an Objective-C relic.** Swift types are automatically namespaced by their module; style guides are explicit that you should not add a class prefix, and rare cross-module collisions are resolved by qualifying with the module name (`SwiftUI.Button` vs a local type). The official API Design Guidelines add: clarity over brevity, and type names read as nouns. Caseless enums are the canonical Swift way to namespace groups of constants — which is exactly what design tokens are. Sources: [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/), [Kodeco Swift style guide](https://github.com/kodecocodes/swift-style-guide), [The power of namespacing in Swift](https://www.vadimbulavin.com/the-power-of-namespacing-in-swift/).

**Structure is feature-first, packaged locally.** Apple's guidance and sample projects (Backyard Birds, Food Truck) organize by feature rather than by type at the top level, extract reusable layers into local Swift packages (`BackyardBirdsUI`, `FoodTruckKit`), and keep `Models`/`Services`/`Shared`/`Resources` as the concern folders. Community modular practice mirrors this with plain, unprefixed module names — a styleguide/design-system module, feature modules, and a data layer reached only through protocols. Sources: [SwiftUI project structure based on Apple guidance](https://agenthicks.com/research/swiftui-project-structure-apple-guidance), [Modularizing iOS applications with SwiftUI and SPM (Nimble)](https://nimblehq.co/blog/modern-approach-modularize-ios-swiftui-spm), [Modern iOS modular architecture with SPM](https://ravi6997.medium.com/modern-ios-architecture-building-a-modular-project-with-swift-package-manager-033d8de9799f).

**State lives in @Observable models; view models earn their place.** Modern SwiftUI consensus: simple views observe models directly (`@Observable`, iOS 17+); screen-level view models appear only where they add real value (owning state, coordinating services, validating input) and never import SwiftUI so they stay testable. This matches this plan's stateless-views-now, `@Observable`-stores-later staging. Sources: [MVVM with @Observable](https://flyingharley.dev/posts/mvvm-architecture-in-swift-ui-from-observable-object-to-observable), [Hacking with Swift on MVVM in SwiftUI](https://www.hackingwithswift.com/books/ios-swiftui/introducing-mvvm-into-your-swiftui-project), [Clean Architecture for SwiftUI](https://nalexn.github.io/clean-architecture-swiftui/).

The rules as applied here:

1. **No `Fish` prefix on any type, file, or folder.** The one deliberate product name is the `FishKit` package (and the `app.fish.catalog` bundle id). The Android plan's `FishButton`-style names stay valid on Android — Compose idiom wraps Material components in product-prefixed wrappers (as Google's own Now in Android does); SwiftUI's module system makes that unnecessary here.
2. **Token namespaces are caseless enums with plain names:** `Palette`, `Spacing`, `Radius`, `Metrics`, `TypeScale`, `MotionDuration`, `Opacity`, `ChatRules`, `Icon`.
3. **Components take descriptive nouns.** When SwiftUI owns the obvious noun, pick a more specific one: `ActionButton` (not `Button`), `InputField` (not `TextField`), `Palette` (not `Color`). Suffix-less nouns follow Apple's own component naming (`Text`, `Label`, `Gauge`) — no `View` suffix, no prefixes.
4. **Targets are the separation of concerns:** `DesignSystem` (tokens only, no components) → `UIComponents` (reusable views, zero business logic) → `PersonalChat` (feature). `TestSupport` carries fixtures and is never a shipping dependency.
5. **Inside the feature module, folders split by concern:** `Models/` (immutable value types), `Logic/` (pure functions — grouping, labels, transcript building, rules), `Views/` (feature views), `Screens/` (screen compositions). `ViewModels/` is added in milestone 1; services arrive as a `ChatData` module behind protocols in milestone 2.
6. **Folders exist only when content does** — no empty scaffolding, and a shared utilities module is created only when a second consumer appears.

### Physical-use scene and theme choice

A client checks a coach's message on an iPhone between meetings — sometimes in a bright office, sometimes on a dim commute. iOS therefore follows the system light/dark appearance automatically via dynamic colors, will honor a future in-app preference by setting the window's `overrideUserInterfaceStyle` equivalent at the app layer (out of scope here), and never assumes one theme is the default. Every snapshot runs in both themes.

## Project structure (file map)

```text
design/
  tokens/
    fish.tokens.json               # cross-platform manifest (web values, verbatim)
    generate-ios-tokens.mjs        # oklch→sRGB + Swift codegen (pnpm ios:tokens)
    generate-ios-tokens.test.mjs   # node --test suite for the generator
  icons/
    LICENSE-tabler.txt             # MIT license text for bundled Tabler icons

scripts/
  ios-token-guard.mjs              # forbids raw colors/fonts/shadows in FishKit sources

apps/ios/
  FishKit/                         # umbrella package — the one deliberate product name
    Package.swift
    Sources/
      DesignSystem/                # tokens, fonts, icons, motion — no UI components
        DesignSystem.swift         # module overview doc
        Generated/                 # written by pnpm ios:tokens — never edited by hand
          Palette.generated.swift
          Tokens.generated.swift
        Typography/
          Fonts.swift              # runtime registration of the bundled fonts
          Typography.swift         # TextRole → Font mapping, .textStyle modifier
        Icons/
          Icon.swift               # semantic icon enum over the asset catalog
        Motion/
          MotionPolicy.swift       # reduced-motion-aware animation helpers
        Resources/
          Fonts/                   # Lexend + Fraunces TTFs + OFL licenses
          Icons.xcassets/          # Tabler imagesets (template, vector-preserving)
      UIComponents/                # reusable views only — zero business logic
        Buttons/
          ActionButton.swift
          IconButton.swift
        Fields/
          InputField.swift
        Identity/
          Avatar.swift
        Feedback/
          Notice.swift
          Skeleton.swift
          EmptyState.swift
        Navigation/
          TopBar.swift
      PersonalChat/                # the feature module
        Models/                    # immutable UI models — no provider or database types
          MessageUiModel.swift
          PersonalChatUiModel.swift
        Logic/                     # pure presentation logic — functions, no views
          MessageGrouping.swift
          ChatDayLabel.swift
          TranscriptBuilder.swift
          BubbleShape.swift
          ChatRules.swift
          MessageAccessibility.swift
        Views/                     # feature views composed from UIComponents
          MessageBubble.swift
          MessageDaySeparator.swift
          UnreadMessagesDivider.swift
          TypingIndicator.swift
          ChatConnectionNotice.swift
          OlderMessagesSlot.swift
          MessageComposer.swift
          PersonalChatTopBar.swift
          PersonalChatTranscript.swift
        Screens/
          PersonalChatScreen.swift
      TestSupport/
        Fixtures/
          PersonalChatFixtures.swift  # realistic coaching sample data, every screen state
    Tests/
      DesignSystemTests/           # contrast, fonts, icons, motion (+ __Snapshots__/)
      UIComponentsTests/           # component logic + snapshots
      PersonalChatTests/           # transcript logic, rules, chat snapshots
  Catalog/
    project.yml                    # XcodeGen; Catalog.xcodeproj is gitignored
    Sources/                       # debug-only catalog app (never ships)
    UITests/                       # performAccessibilityAudit sweep
```

Where future concerns live (documented now so growth needs no reshuffle; the folders are created when the code arrives, never as empty scaffolding):

- **View models** — `PersonalChat/ViewModels/` in follow-on milestone 1: `@Observable` screen-level stores that adapt reducer state to the UI models. They import the models and services, never SwiftUI.
- **Services / data** — a new `ChatData` module in follow-on milestone 2: repository protocols in `ChatData/Repositories/`, the `supabase-swift` adapter in `ChatData/Adapters/`. Feature code depends on the protocols only.
- **Utilities** — live next to their domain. A shared `CoreUtilities` target is created only when a second module genuinely needs the same helper (no junk-drawer module on day one).

Dependency direction (compiler-enforced by target dependencies):

```text
Catalog (app) ──▶ PersonalChat ──▶ UIComponents ──▶ DesignSystem
      │                                                  ▲
      └──────────▶ TestSupport (fixtures) ───────────────┘   (test/debug targets only)
```

## Design-token foundation

The manifest carries only the **shared subset** of `apps/web/app/globals.css` that native platforms consume (web keeps web-only tokens like skeleton word widths and picker panel sizes). Three layers, per the Android plan: reference values (OKLCH colors, pt dimensions, ms durations), semantic roles (bg, surface, primary, notice…), and component recipes (chat aliases, composer rules). Feature code consumes semantic/component tokens only.

Key mappings locked by this plan (verified against the implemented web components):

- **Chat aliases:** `message-outgoing-container → primary`, `on-message-outgoing → on-primary`, `message-incoming-container → surface`, `on-message-incoming → body`, `message-failed → error` (web `message-body.tsx` renders `mine ? "bg-primary text-on-primary" : "bg-surface text-body"`).
- **Type ladder (fixed):** display Fraunces 600 32/1.1 · heading Fraunces 600 20/1.15 · body Lexend 400 17/1.55 · ui Lexend 400 15/1.5 · label Lexend 500 14/1.45 · caption Lexend 400 13/1.4. Web px = iOS pt, 1:1.
- **Spacing roles:** 3xs 2 · 2xs 4 · nudge 6 · xs 8 · compact 10 · sm 12 · field-y 14 · md 16 · page 20 · lg 24 · xl 40 · 2xl 48 · 3xl 72 · 4xl 112. Swift names spell leading digits (`threeXs`, `twoXl`) — a documented, deterministic camelization.
- **Radii:** card 16 · chat 16 · control 12 · chat-inner 4 (connected bubble corners) · pill 999.
- **Sizes:** target-touch 44 · control-primary 56 · icon-glyph 20 · chat-header 64 · pagination-slot 144 · composer-max-height 160 · chat-content-max-width 720 · avatar-badge 20 · avatar-sm 32 · avatar-md 44 · avatar-profile 72 · motion-enter-offset 6 · motion-typing-offset 4 · skeleton-author-width 96.
- **Motion:** fade 200 ms · message 200 ms · typing 1200 ms (delays 0/150/300) · reaction 180 ms · progress 500 ms · skeleton 1400 ms. Ease-out, opacity/transform only, never bounce.
- **Chat rules:** max message length 4000, counter threshold 3900, message max-width fraction 0.85.

## Component API rules (every reusable view)

- State is passed in; user intent leaves through closures. No view resolves its own store, repository, navigation, or SDK.
- Public models are `Equatable`, `Sendable` value types with no provider or database types.
- Every interactive component defines default, pressed, focused, disabled, and (where it can enter them) loading/busy, error/notice, selected, and empty states — with geometry preserved across all of them.
- Every control has an accessible name describing its outcome ("Send message", "Try loading earlier messages again"). Icon-only controls take a required `accessibilityLabel` parameter — it is not optional API.
- Decorative icons, dots, and skeletons are hidden from assistive tech; meaning always lives in text.
- Text is caller-provided or localized copy; no view assembles user-facing strings from fragments that break translation or RTL.
- No raw values: colors, spacing, sizes, radii, fonts, durations, opacities come from `DesignSystem` tokens (guard-enforced).
- Every component ships with previews (light/dark) and tests for its states, including long-copy and large-Dynamic-Type where text is involved.

## Component inventory

| Layer | Component | Required variants and states |
| --- | --- | --- |
| UIComponents | `ActionButton` | primary, secondary, ghost · default, pressed, disabled, loading (geometry-stable, duplicate-tap-proof) |
| UIComponents | `IconButton` | solid, quiet · default, pressed, disabled, busy · 44 pt target, 20 pt glyph, required accessible name |
| UIComponents | `InputField` | default, focused (surface-step fill, no ring), disabled, supporting text, notice, error (reserved message slot) |
| UIComponents | `Avatar` | image, initials, neutral fallback · badge/sm/md/profile sizes · never infers gender |
| UIComponents | `Notice` | notice (monochrome), error, warning, success · icon + copy, optional single quiet action |
| UIComponents | `Skeleton` | text bar + avatar circle shapes · exact final geometry · calm opacity pulse, static under reduced motion |
| UIComponents | `EmptyState` | title, description, optional single action (primary or quiet) |
| UIComponents | `TopBar` | title, optional back, optional one quiet trailing action · 64 pt, safe-area aware |
| Chat | `MessageBubble` | incoming, outgoing, group-connected corners, long text, failed state, delivery status text, combined a11y element |
| Chat | `MessageDaySeparator` | Today, Yesterday, localized date · header trait |
| Chat | `UnreadMessagesDivider` | plain "New messages" · header trait, never a count-as-judgement |
| Chat | `TypingIndicator` | label + three restrained dots · one polite announcement · no loop under reduced motion |
| Chat | `ChatConnectionNotice` | connecting, reconnecting, offline · draft-preservation copy · no retry loop |
| Chat | `OlderMessagesSlot` | hidden, idle, loading skeleton, calm failure + manual retry · fixed 144 pt reserved geometry |
| Chat | `MessageComposer` | visible "Message" label, growing multiline field (internal scroll past 6 lines), 4000-char rule + stable counter, send only when sendable, busy, offline states |
| Chat | `PersonalChatTopBar` | participant avatar, name, static presence label, optional back · no calls, no overflow menu |
| Chat | `PersonalChatTranscript` | keyed lazy list, bottom-anchored, pagination slot, loading/empty states, 720 pt cap |
| Chat | `PersonalChatScreen` | stateless composition of top bar, transcript, notices, composer |

Deferred by design (arrive with later milestones): `ConversationRow`, `UnreadBadge`, adaptive list-detail, and a progress bar (no progress surface exists in the chat thread).

## Screen-state matrix (fixtures + snapshots must cover all of these)

| State | Required presentation |
| --- | --- |
| Initial loading | Header + message skeletons matching final geometry; never a blank screen |
| Empty conversation | "No messages yet" + one short explanation; the composer is the only action |
| Loaded conversation | Day separators, grouped bubbles, stable bottom anchor |
| Loading earlier | Reserved 144 pt top slot with quiet skeleton; transcript never jumps |
| Earlier-load failure | Calm inline explanation + one quiet manual retry |
| Sending | Optimistic outgoing bubble, "Sending…" status, busy send control (geometry stable) |
| Sent / delivered / read | Text status on the latest outgoing message; never color-only |
| Send failure | Failed status + "Try sending again" quiet action; calm copy |
| Reconnecting | Neutral inline notice; no modal, no sound, no focus theft |
| Offline | Draft stays editable; copy explains sending resumes on reconnect |
| Unavailable | "This conversation isn't available" + one safe return action |
| Typing | Typing indicator visible above composer |
| Long content | 4000-char message, long names, URLs, emoji, unbroken strings |
| Large type / RTL | Reflow without overlap or clipped controls; no directional assumptions |
| Reduced motion | No settle, no pulsing loops, no animated scroll needed to understand state |

## Verification strategy

1. **Token checks** — generator known-answer + property tests (`node --test`); `pnpm ios:tokens:check` drift gate; Swift contrast tests (text ≥ 4.5:1, boundaries/presence ≥ 3:1, both themes); guard script: no raw colors/fonts/shadows in sources.
2. **Component tests** — Swift Testing over pure logic (grouping, day labels, transcript building, corner mapping, sendability, initials, a11y label composition).
3. **Snapshot tests** — committed baselines, one pinned simulator; light + dark for every component; XL Dynamic Type and RTL for text-bearing components and the full screen; every screen-state fixture.
4. **Accessibility audits** — `performAccessibilityAudit()` across every catalog page; semantics assertions (labels, traits, hidden decorations) in component tests.
5. **Manual device checks (acceptance wave)** — VoiceOver read order, Full Keyboard Access, hardware-keyboard traversal, keyboard open/close/rotate, light/dark switch while open, system reduced motion, largest accessibility text sizes, real coaching copy; a short usability review with a coach and at least one target client.

Repo hygiene: iOS work never touches the web build; still run `pnpm build` once per wave (it must stay green) and before any commit that touches shared files (`package.json`, `design/tokens/**`).

## Implementation roadmap

Waves map 1:1 onto the task list below. Each wave ends with a reviewable artifact; estimates are engineering days for one iOS engineer.

| Wave | Tasks | Exit gate | Est. |
| --- | --- | --- | --- |
| 0 — Scaffold | 1 | Package + placeholder targets build and test headless via `pnpm ios:test`; scripts and gitignore in place | 1–2 d |
| 1 — Tokens & theme | 2–7 | Manifest committed; generated Swift is drift-checked; contrast/font/icon/motion tests pass in both themes | 3–5 d |
| 2 — Core components | 8–14 | Every UIComponents component has required states, snapshots (light/dark), and passing semantics tests | 4–6 d |
| 3 — Chat kit & screen | 15–19 | Stateless screen renders the full state matrix from fixtures; snapshot matrix green | 5–7 d |
| 4 — Catalog & acceptance | 20 | Catalog app runs; accessibility audit sweep passes; guard + full suite green; manual checklist + coach/client review complete | 2–4 d |

**Total: ~15–24 days.**

### Follow-on milestones (why this foundation minimizes their rework)

1. **Native chat-state parity.** Add a `ChatCore` target: idiomatic Swift port of `packages/core/src/chat-state` (reducer, selectors), replaying `packages/core/src/chat-state/fixtures/chat-state-vectors.json` as test resources so web and iOS provably reduce identically. Then one `@Observable` conversation store adapts `ChatState` → `PersonalChatUiModel`. **Zero view changes** — that is what stateless views buy.
2. **Personal chat data integration.** Add `ChatData`: FISH-owned repository protocols + a `supabase-swift` adapter (auth session, RLS reads, `send-message` Edge Function, Realtime, keyset pagination, reconnect backfill). Provider types stay behind the port; drafts preserved offline; manual retry only. Coordinate with the RN-audit recommendation to hoist canonical zod command schemas into `@fish/core` — iOS mirrors those shapes as `Codable` structs.
3. **Production shell & pilot.** Navigation (conversation list only for roles with >1 authorized conversation, arriving with `NavigationSplitView`), observability with privacy scrubbing, performance passes on release builds, TestFlight pilot with a coach and target clients. Group chat, calls, attachments, reactions, search, and notifications remain separate future milestones.

---

# Tasks

Conventions for every task:

- Work from the repo root unless a step says otherwise. Test commands use the pinned simulator; override with any installed iPhone simulator but stay consistent (snapshot baselines are simulator/OS-specific — record and verify on the same one).
- `SIM='platform=iOS Simulator,name=iPhone 16'` is assumed in commands below; adjust the device name once, everywhere, if your Xcode has a different simulator installed (`xcrun simctl list devices available`).
- End every commit message with the trailer:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Snapshot tests fail on first run with "No reference was found on disk" and automatically write the baseline; re-run to verify green, then commit the `__Snapshots__` directory. Inspect the recorded PNG before committing — it is the visual contract.

### Task 1: Package scaffold, scripts, gitignore

**Files:**
- Create: `apps/ios/FishKit/Package.swift`
- Create: `apps/ios/FishKit/Sources/DesignSystem/DesignSystem.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/UIComponents.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/PersonalChat.swift`
- Create: `apps/ios/FishKit/Sources/TestSupport/TestSupport.swift`
- Create: `apps/ios/FishKit/Tests/DesignSystemTests/ScaffoldTests.swift`
- Modify: `package.json` (root — add `ios:*` scripts)
- Modify: `.gitignore`

- [ ] **Step 1: Verify toolchain**

Run: `xcodebuild -version && node --version`
Expected: Xcode 16.0 or newer (Swift 6 + Swift Testing required); Node ≥ 20. If Xcode is older, stop and flag it — nothing below works.

- [ ] **Step 2: Create the package manifest**

`apps/ios/FishKit/Package.swift`:

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FishKit",
    defaultLocalization: "en",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
        .library(name: "UIComponents", targets: ["UIComponents"]),
        .library(name: "PersonalChat", targets: ["PersonalChat"]),
        .library(name: "TestSupport", targets: ["TestSupport"]),
    ],
    dependencies: [
        .package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "1.17.0"),
    ],
    targets: [
        .target(
            name: "DesignSystem",
            resources: [.process("Resources")]
        ),
        .target(name: "UIComponents", dependencies: ["DesignSystem"]),
        .target(name: "PersonalChat", dependencies: ["DesignSystem", "UIComponents"]),
        .target(
            name: "TestSupport",
            dependencies: ["DesignSystem", "UIComponents", "PersonalChat"]
        ),
        .testTarget(
            name: "DesignSystemTests",
            dependencies: [
                "DesignSystem",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ]
        ),
        .testTarget(
            name: "UIComponentsTests",
            dependencies: [
                "UIComponents", "TestSupport",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ]
        ),
        .testTarget(
            name: "PersonalChatTests",
            dependencies: [
                "PersonalChat", "TestSupport",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ]
        ),
    ],
    swiftLanguageModes: [.v6]
)
```

- [ ] **Step 3: Create module placeholder sources**

Each target needs one Swift file to compile. These are documentation-only —
no marker enums named after the module (a type that shares its module's name
shadows the module and breaks qualified lookup).

`apps/ios/FishKit/Sources/DesignSystem/DesignSystem.swift`:

```swift
// DesignSystem owns generated tokens, fonts, icons, and the motion policy.
// It never depends on UIComponents, PersonalChat, or any data SDK.
// The module itself is the namespace — token containers are caseless enums
// (Palette, Spacing, Radius, …) added in Wave 1.
```

`apps/ios/FishKit/Sources/UIComponents/UIComponents.swift`:

```swift
// UIComponents owns reusable, business-logic-free views. It depends only on
// DesignSystem — never on chat, navigation, or data code.
```

`apps/ios/FishKit/Sources/PersonalChat/PersonalChat.swift`:

```swift
// PersonalChat owns one-to-one chat UI models, presentation logic, views,
// and the stateless PersonalChatScreen. No group, call, media, or data types.
```

`apps/ios/FishKit/Sources/TestSupport/TestSupport.swift`:

```swift
// TestSupport owns preview/snapshot fixtures. Debug and test use only —
// never a dependency of a shipping surface.
```

Also create an empty resources folder so the manifest's `.process("Resources")` resolves: create `apps/ios/FishKit/Sources/DesignSystem/Resources/.gitkeep` (empty file).

- [ ] **Step 4: Write a scaffold test**

`apps/ios/FishKit/Tests/DesignSystemTests/ScaffoldTests.swift`:

```swift
import Testing
@testable import DesignSystem

struct ScaffoldTests {
    /// The real gate is the build: all four targets compile and the test
    /// runner boots on the simulator. Wave 1 replaces this with real tests.
    @Test func testRunnerBoots() {
        #expect(Bool(true))
    }
}
```

- [ ] **Step 5: Build and test the empty package**

Run:

```bash
cd apps/ios/FishKit && xcodebuild test -scheme FishKit-Package -destination "platform=iOS Simulator,name=iPhone 16" | tail -20
```

Expected: `** TEST SUCCEEDED **` (first run resolves swift-snapshot-testing, takes a minute).

- [ ] **Step 6: Add root pnpm scripts**

In root `package.json`, add to `"scripts"` (keep existing entries untouched):

```json
"ios:tokens": "node design/tokens/generate-ios-tokens.mjs",
"ios:tokens:check": "node design/tokens/generate-ios-tokens.mjs --check",
"ios:tokens:test": "node --test design/tokens/generate-ios-tokens.test.mjs",
"ios:guard": "node scripts/ios-token-guard.mjs",
"ios:build": "cd apps/ios/FishKit && xcodebuild build -scheme FishKit-Package -destination \"platform=iOS Simulator,name=${FISH_IOS_SIM:-iPhone 16}\"",
"ios:test": "cd apps/ios/FishKit && xcodebuild test -scheme FishKit-Package -destination \"platform=iOS Simulator,name=${FISH_IOS_SIM:-iPhone 16}\""
```

- [ ] **Step 7: Extend .gitignore**

Append to root `.gitignore`:

```gitignore
# iOS
apps/ios/**/xcuserdata/
apps/ios/**/.build/
apps/ios/**/DerivedData/
apps/ios/Catalog/Catalog.xcodeproj/
```

- [ ] **Step 8: Verify the web build still passes, then commit**

Run: `pnpm build`
Expected: existing web build passes (iOS additions are inert to it).

```bash
git add apps/ios .gitignore package.json
git commit -m "feat(ios): scaffold FishKit package with module boundaries and scripts"
```

### Task 2: Cross-platform token manifest

**Files:**
- Create: `design/tokens/fish.tokens.json`

If `design/tokens/fish.tokens.json` already exists (the Android milestone may have landed it first), do not overwrite it — diff it against the content below, add any missing keys, and reconcile differences in favor of the existing file plus the web CSS. Otherwise create it exactly as below. Every value is transcribed from `apps/web/app/globals.css` (`@theme`) — if that file has changed since this plan was written, the CSS wins; update the JSON, not the components.

- [ ] **Step 1: Write the manifest**

`design/tokens/fish.tokens.json`:

```json
{
  "meta": {
    "source": "apps/web/app/globals.css",
    "authoritative": "web",
    "note": "Shared subset of FISH tokens for native platforms. Colors are OKLCH; dimensions are density-independent points (web px = iOS pt = Android dp, 1:1); durations are milliseconds. Generators: design/tokens/generate-ios-tokens.mjs."
  },
  "color": {
    "bg": { "light": { "l": 0.98, "c": 0, "h": 0 }, "dark": { "l": 0.15, "c": 0, "h": 0 } },
    "surface": { "light": { "l": 0.99, "c": 0, "h": 0 }, "dark": { "l": 0.18, "c": 0, "h": 0 } },
    "surface-2": { "light": { "l": 0.96, "c": 0, "h": 0 }, "dark": { "l": 0.2, "c": 0, "h": 0 } },
    "surface-3": { "light": { "l": 0.88, "c": 0, "h": 0 }, "dark": { "l": 0.33, "c": 0, "h": 0 } },
    "chat-hover": { "light": { "l": 0.94, "c": 0, "h": 0 }, "dark": { "l": 0.22, "c": 0, "h": 0 } },
    "chat-active": { "light": { "l": 0.92, "c": 0, "h": 0 }, "dark": { "l": 0.25, "c": 0, "h": 0 } },
    "avatar": { "light": { "l": 0.9, "c": 0, "h": 0 }, "dark": { "l": 0.3, "c": 0, "h": 0 } },
    "border": { "light": { "l": 0.64, "c": 0, "h": 0 }, "dark": { "l": 0.55, "c": 0, "h": 0 } },
    "border-strong": { "light": { "l": 0.55, "c": 0, "h": 0 }, "dark": { "l": 0.65, "c": 0, "h": 0 } },
    "divider": { "light": { "l": 0.15, "c": 0, "h": 0, "alpha": 0.1 }, "dark": { "l": 0.98, "c": 0, "h": 0, "alpha": 0.12 } },
    "primary": { "light": { "l": 0.15, "c": 0, "h": 0 }, "dark": { "l": 0.98, "c": 0, "h": 0 } },
    "primary-press": { "light": { "l": 0.25, "c": 0, "h": 0 }, "dark": { "l": 0.9, "c": 0, "h": 0 } },
    "on-primary": { "light": { "l": 0.98, "c": 0, "h": 0 }, "dark": { "l": 0.15, "c": 0, "h": 0 } },
    "foreground": { "light": { "l": 0.15, "c": 0, "h": 0 }, "dark": { "l": 0.97, "c": 0, "h": 0 } },
    "body": { "light": { "l": 0.32, "c": 0, "h": 0 }, "dark": { "l": 0.88, "c": 0, "h": 0 } },
    "muted": { "light": { "l": 0.5, "c": 0, "h": 0 }, "dark": { "l": 0.68, "c": 0, "h": 0 } },
    "skeleton-author": { "light": { "l": 0.82, "c": 0, "h": 0 }, "dark": { "l": 0.38, "c": 0, "h": 0 } },
    "notice": { "light": { "l": 0.4, "c": 0, "h": 0 }, "dark": { "l": 0.8, "c": 0, "h": 0 } },
    "scrim": { "light": { "l": 0.15, "c": 0, "h": 0, "alpha": 0.4 }, "dark": { "l": 0, "c": 0, "h": 0, "alpha": 0.6 } },
    "error": { "light": { "l": 0.45, "c": 0.14, "h": 20 }, "dark": { "l": 0.78, "c": 0.11, "h": 20 } },
    "warning": { "light": { "l": 0.42, "c": 0.12, "h": 80 }, "dark": { "l": 0.78, "c": 0.12, "h": 80 } },
    "success": { "light": { "l": 0.4, "c": 0.11, "h": 150 }, "dark": { "l": 0.75, "c": 0.12, "h": 150 } },
    "presence-online": { "light": { "l": 0.4, "c": 0.11, "h": 150 }, "dark": { "l": 0.75, "c": 0.12, "h": 150 } },
    "presence-idle": { "light": { "l": 0.45, "c": 0.12, "h": 85 }, "dark": { "l": 0.78, "c": 0.12, "h": 85 } },
    "presence-away": { "light": { "l": 0.45, "c": 0.13, "h": 55 }, "dark": { "l": 0.76, "c": 0.12, "h": 55 } },
    "presence-busy": { "light": { "l": 0.45, "c": 0.12, "h": 20 }, "dark": { "l": 0.77, "c": 0.1, "h": 20 } },
    "presence-offline": { "light": { "l": 0.46, "c": 0, "h": 0 }, "dark": { "l": 0.7, "c": 0, "h": 0 } }
  },
  "typography": {
    "display": { "font": "fraunces", "weight": 600, "size": 32, "lineHeight": 1.1 },
    "heading": { "font": "fraunces", "weight": 600, "size": 20, "lineHeight": 1.15 },
    "body": { "font": "lexend", "weight": 400, "size": 17, "lineHeight": 1.55 },
    "ui": { "font": "lexend", "weight": 400, "size": 15, "lineHeight": 1.5 },
    "label": { "font": "lexend", "weight": 500, "size": 14, "lineHeight": 1.45 },
    "caption": { "font": "lexend", "weight": 400, "size": 13, "lineHeight": 1.4 }
  },
  "spacing": {
    "3xs": 2, "2xs": 4, "nudge": 6, "xs": 8, "compact": 10, "sm": 12,
    "field-y": 14, "md": 16, "page": 20, "lg": 24, "xl": 40, "2xl": 48,
    "3xl": 72, "4xl": 112
  },
  "radius": {
    "card": 16, "chat": 16, "control": 12, "chat-inner": 4, "pill": 999
  },
  "size": {
    "target-touch": 44, "control-primary": 56, "icon-glyph": 20,
    "chat-header": 64, "pagination-slot": 144, "composer-max-height": 160,
    "chat-content-max-width": 720, "avatar-badge": 20, "avatar-sm": 32,
    "avatar-md": 44, "avatar-profile": 72, "motion-enter-offset": 6,
    "motion-typing-offset": 4, "skeleton-author-width": 96
  },
  "motion": {
    "fade": 200, "message": 200, "typing": 1200, "typing-delay-short": 150,
    "typing-delay-long": 300, "reaction": 180, "progress": 500, "skeleton": 1400
  },
  "opacity": {
    "focus": 0.72, "focus-field": 0.82
  },
  "component": {
    "chat": {
      "message-outgoing-container": "{color.primary}",
      "on-message-outgoing": "{color.on-primary}",
      "message-incoming-container": "{color.surface}",
      "on-message-incoming": "{color.body}",
      "message-failed": "{color.error}",
      "max-message-length": 4000,
      "counter-threshold": 3900,
      "message-max-width-fraction": 0.85
    }
  }
}
```

- [ ] **Step 2: Spot-verify against the CSS**

Run: `grep -n "color-primary:\|color-surface:\|spacing-md:\|radius-control:\|duration-message:" apps/web/app/globals.css`
Expected: values match the JSON above (`primary` light `oklch(0.15 0 0)`, `surface` light `0.99`, `--spacing-md: 16px`, `--radius-control: 12px`, `--duration-message: 200ms`).

- [ ] **Step 3: Commit**

```bash
git add design/tokens/fish.tokens.json
git commit -m "feat(design): add cross-platform FISH token manifest (shared web subset)"
```

### Task 3: iOS token generator (TDD)

**Files:**
- Create: `design/tokens/generate-ios-tokens.test.mjs`
- Create: `design/tokens/generate-ios-tokens.mjs`
- Generates: `apps/ios/FishKit/Sources/DesignSystem/Generated/Palette.generated.swift`
- Generates: `apps/ios/FishKit/Sources/DesignSystem/Generated/Tokens.generated.swift`

- [ ] **Step 1: Write the failing generator tests**

`design/tokens/generate-ios-tokens.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { oklchToSrgb, camelize, renderColorSwift, renderTokensSwift } from "./generate-ios-tokens.mjs";

test("oklch white converts to sRGB white", () => {
  const { r, g, b } = oklchToSrgb({ l: 1, c: 0, h: 0 });
  assert.ok(Math.abs(r - 1) < 1e-4 && Math.abs(g - 1) < 1e-4 && Math.abs(b - 1) < 1e-4);
});

test("oklch black converts to sRGB black", () => {
  const { r, g, b } = oklchToSrgb({ l: 0, c: 0, h: 0 });
  assert.ok(r < 1e-6 && g < 1e-6 && b < 1e-6);
});

test("achromatic oklch yields equal channels and preserves alpha", () => {
  const { r, g, b, a } = oklchToSrgb({ l: 0.5, c: 0, h: 0, alpha: 0.4 });
  assert.ok(Math.abs(r - g) < 1e-9 && Math.abs(g - b) < 1e-9);
  assert.equal(a, 0.4);
  assert.ok(r > 0.3 && r < 0.5); // mid grey, gamma-encoded
});

test("lightness is monotonic", () => {
  const at = (l) => oklchToSrgb({ l, c: 0, h: 0 }).r;
  assert.ok(at(0.2) < at(0.5) && at(0.5) < at(0.8));
});

test("camelize spells leading digits and joins hyphens", () => {
  assert.equal(camelize("surface-2"), "surface2");
  assert.equal(camelize("3xs"), "threeXs");
  assert.equal(camelize("2xl"), "twoXl");
  assert.equal(camelize("on-primary"), "onPrimary");
  assert.equal(camelize("message-outgoing-container"), "messageOutgoingContainer");
});

test("swift rendering is deterministic and marked generated", () => {
  const manifest = JSON.parse(readFileSync(new URL("./fish.tokens.json", import.meta.url), "utf8"));
  const one = renderColorSwift(manifest);
  assert.equal(one, renderColorSwift(manifest));
  assert.match(one, /do not edit/i);
  assert.match(one, /static let bg/);
  const tokens = renderTokensSwift(manifest);
  assert.match(tokens, /enum Spacing/);
  assert.match(tokens, /static let threeXs: CGFloat = 2/);
  assert.match(tokens, /enum ChatRules/);
});
```

(Add `import { readFileSync } from "node:fs";` to the imports at the top of the test file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm ios:tokens:test`
Expected: FAIL — `Cannot find module ... generate-ios-tokens.mjs`.

- [ ] **Step 3: Implement the generator**

`design/tokens/generate-ios-tokens.mjs`:

```js
// Generates Swift token files for DesignSystem from fish.tokens.json.
// OKLCH -> sRGB uses Björn Ottosson's published OKLab matrices; conversion
// happens here, offline, so the app ships plain sRGB dynamic colors.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(HERE, "fish.tokens.json");
const OUT_DIR = path.join(
  HERE, "..", "..", "apps", "ios", "FishKit", "Sources", "DesignSystem", "Generated"
);

export function oklchToSrgb({ l, c, h, alpha = 1 }) {
  const hr = ((h ?? 0) * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3;
  const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  const encode = (v) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return { r: encode(rLin), g: encode(gLin), b: encode(bLin), a: alpha };
}

const DIGIT_WORDS = { 2: "two", 3: "three", 4: "four" };

export function camelize(name) {
  const parts = String(name).split("-");
  const spelled = parts.map((part) => {
    const m = part.match(/^([234])(.*)$/);
    return m ? DIGIT_WORDS[m[1]] + capitalize(m[2]) : part;
  });
  return spelled
    .map((part, i) => (i === 0 ? decapitalize(part) : capitalize(part)))
    .join("");
}
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const decapitalize = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

const f = (n) => Number(n.toFixed(6)).toString();

function resolveAlias(manifest, value) {
  const m = /^\{color\.([a-z0-9-]+)\}$/.exec(value);
  if (!m) throw new Error(`Unsupported alias: ${value}`);
  const color = manifest.color[m[1]];
  if (!color) throw new Error(`Alias points at missing color: ${value}`);
  return color;
}

function swiftPair(pair) {
  const light = oklchToSrgb(pair.light);
  const dark = oklchToSrgb(pair.dark);
  const comp = (c) =>
    `ColorComponents(red: ${f(c.r)}, green: ${f(c.g)}, blue: ${f(c.b)}, alpha: ${f(c.a)})`;
  return `ColorPair(light: ${comp(light)}, dark: ${comp(dark)})`;
}

const HEADER = `// Generated by design/tokens/generate-ios-tokens.mjs — do not edit.
// Source of truth: design/tokens/fish.tokens.json (extracted from apps/web/app/globals.css).
`;

export function renderColorSwift(manifest) {
  const lines = [HEADER, "import SwiftUI", "import UIKit", ""];
  lines.push(`public struct ColorComponents: Sendable, Equatable {
    public let red: Double
    public let green: Double
    public let blue: Double
    public let alpha: Double

    public init(red: Double, green: Double, blue: Double, alpha: Double) {
        self.red = red
        self.green = green
        self.blue = blue
        self.alpha = alpha
    }
}

public struct ColorPair: Sendable, Equatable {
    public let light: ColorComponents
    public let dark: ColorComponents

    public init(light: ColorComponents, dark: ColorComponents) {
        self.light = light
        self.dark = dark
    }

    public var color: Color {
        Color(UIColor { traits in
            let c = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.red, green: c.green, blue: c.blue, alpha: c.alpha)
        })
    }
}
`);
  const entries = Object.entries(manifest.color);
  const chat = Object.entries(manifest.component.chat).filter(([, v]) => typeof v === "string");
  lines.push("/// Raw light/dark component values — used by contrast tests.");
  lines.push("public enum ColorTokens {");
  for (const [name, pair] of entries) {
    lines.push(`    public static let ${camelize(name)} = ${swiftPair(pair)}`);
  }
  for (const [name, alias] of chat) {
    lines.push(`    public static let ${camelize(name)} = ${swiftPair(resolveAlias(manifest, alias))}`);
  }
  lines.push("}");
  lines.push("");
  lines.push("/// Semantic SwiftUI colors. Light/dark resolve automatically.");
  lines.push("public enum Palette {");
  for (const [name] of entries) {
    lines.push(`    public static let ${camelize(name)} = ColorTokens.${camelize(name)}.color`);
  }
  for (const [name] of chat) {
    lines.push(`    public static let ${camelize(name)} = ColorTokens.${camelize(name)}.color`);
  }
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

export function renderTokensSwift(manifest) {
  const lines = [HEADER, "import SwiftUI", ""];
  const numericEnum = (enumName, obj, type, transform = (v) => v, doc = "") => {
    if (doc) lines.push(`/// ${doc}`);
    lines.push(`public enum ${enumName} {`);
    for (const [name, value] of Object.entries(obj)) {
      lines.push(`    public static let ${camelize(name)}: ${type} = ${f(transform(value))}`);
    }
    lines.push("}");
    lines.push("");
  };
  numericEnum("Spacing", manifest.spacing, "CGFloat", (v) => v,
    "Spacing roles — use the role, never the number.");
  numericEnum("Radius", manifest.radius, "CGFloat", (v) => v,
    "Corner radii by role. chatInner is the connected-bubble corner.");
  numericEnum("Metrics", manifest.size, "CGFloat", (v) => v,
    "Interaction targets and component dimensions.");
  numericEnum("MotionDuration", manifest.motion, "TimeInterval", (v) => v / 1000,
    "Durations in seconds (manifest stores milliseconds).");
  numericEnum("Opacity", manifest.opacity, "Double", (v) => v,
    "Focus opacities matching the web focus-visible treatment.");

  lines.push("/// Fixed product type ladder. Typography maps these to Fonts.");
  lines.push("public enum TypeScale {");
  for (const [role, spec] of Object.entries(manifest.typography)) {
    lines.push(`    public static let ${camelize(role)} = TypeSpec(font: "${spec.font}", weight: ${spec.weight}, size: ${f(spec.size)}, lineHeight: ${f(spec.lineHeight)})`);
  }
  lines.push("}");
  lines.push("");
  lines.push(`public struct TypeSpec: Sendable, Equatable {
    public let font: String
    public let weight: Int
    public let size: CGFloat
    public let lineHeight: CGFloat

    public init(font: String, weight: Int, size: CGFloat, lineHeight: CGFloat) {
        self.font = font
        self.weight = weight
        self.size = size
        self.lineHeight = lineHeight
    }
}
`);
  const chat = manifest.component.chat;
  lines.push("/// Chat interaction contract shared with web and Android.");
  lines.push("public enum ChatRules {");
  lines.push(`    public static let maxMessageLength: Int = ${chat["max-message-length"]}`);
  lines.push(`    public static let counterThreshold: Int = ${chat["counter-threshold"]}`);
  lines.push(`    public static let messageMaxWidthFraction: CGFloat = ${f(chat["message-max-width-fraction"])}`);
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const outputs = {
    "Palette.generated.swift": renderColorSwift(manifest),
    "Tokens.generated.swift": renderTokensSwift(manifest),
  };
  const check = process.argv.includes("--check");
  mkdirSync(OUT_DIR, { recursive: true });
  let dirty = false;
  for (const [file, content] of Object.entries(outputs)) {
    const target = path.join(OUT_DIR, file);
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current === content) continue;
    if (check) {
      console.error(`[tokens] ${file} is stale — run: pnpm ios:tokens`);
      dirty = true;
    } else {
      writeFileSync(target, content);
      console.log(`[tokens] wrote ${path.relative(process.cwd(), target)}`);
    }
  }
  if (check && dirty) process.exit(1);
  if (check) console.log("[tokens] generated Swift is up to date");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm ios:tokens:test`
Expected: PASS — 6 tests.

- [ ] **Step 5: Generate and drift-check**

Run: `pnpm ios:tokens && pnpm ios:tokens:check`
Expected: two `wrote ...` lines, then `generated Swift is up to date`.

- [ ] **Step 6: Commit**

```bash
git add design/tokens apps/ios/FishKit/Sources/DesignSystem/Generated
git commit -m "feat(ios): generate DesignSystem tokens from the shared manifest"
```

### Task 4: Contrast and token-value verification

The generated values must prove the same WCAG AA contract the web asserts in `tests/contrast.test.ts`. These tests are the safety net for every future manifest edit: they pass now, and any token change that breaks a pairing fails here. If any assertion fails on first run, the manifest transcription is wrong — fix `fish.tokens.json` and regenerate; never adjust the test thresholds. Alpha-bearing tokens (`divider`, `scrim`) are decorative/overlay roles and are deliberately excluded.

**Files:**
- Create: `apps/ios/FishKit/Tests/DesignSystemTests/ContrastTests.swift`
- Create: `apps/ios/FishKit/Tests/DesignSystemTests/TokenValueTests.swift`

- [ ] **Step 1: Write the contrast tests**

`apps/ios/FishKit/Tests/DesignSystemTests/ContrastTests.swift`:

```swift
import Foundation
import Testing
@testable import DesignSystem

private func relativeLuminance(_ c: ColorComponents) -> Double {
    func lin(_ v: Double) -> Double {
        v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * lin(c.red) + 0.7152 * lin(c.green) + 0.0722 * lin(c.blue)
}

private func contrast(_ a: ColorComponents, _ b: ColorComponents) -> Double {
    let la = relativeLuminance(a)
    let lb = relativeLuminance(b)
    let (hi, lo) = la > lb ? (la, lb) : (lb, la)
    return (hi + 0.05) / (lo + 0.05)
}

struct ContrastTests {
    private let textRoles: [(String, ColorPair)] = [
        ("foreground", ColorTokens.foreground),
        ("body", ColorTokens.body),
        ("muted", ColorTokens.muted),
        ("notice", ColorTokens.notice),
        ("error", ColorTokens.error),
        ("warning", ColorTokens.warning),
        ("success", ColorTokens.success),
    ]
    private let canvases: [(String, ColorPair)] = [
        ("bg", ColorTokens.bg),
        ("surface", ColorTokens.surface),
        ("surface2", ColorTokens.surface2),
    ]

    @Test func textRolesMeetAAOnEveryCanvasInBothThemes() {
        for (textName, text) in textRoles {
            for (canvasName, canvas) in canvases {
                #expect(contrast(text.light, canvas.light) >= 4.5, "\(textName) on \(canvasName), light")
                #expect(contrast(text.dark, canvas.dark) >= 4.5, "\(textName) on \(canvasName), dark")
            }
        }
    }

    @Test func primaryInversionAndOutgoingBubbleMeetAA() {
        #expect(contrast(ColorTokens.onPrimary.light, ColorTokens.primary.light) >= 4.5)
        #expect(contrast(ColorTokens.onPrimary.dark, ColorTokens.primary.dark) >= 4.5)
        #expect(contrast(ColorTokens.onMessageOutgoing.light, ColorTokens.messageOutgoingContainer.light) >= 4.5)
        #expect(contrast(ColorTokens.onMessageOutgoing.dark, ColorTokens.messageOutgoingContainer.dark) >= 4.5)
        #expect(contrast(ColorTokens.onMessageIncoming.light, ColorTokens.messageIncomingContainer.light) >= 4.5)
        #expect(contrast(ColorTokens.onMessageIncoming.dark, ColorTokens.messageIncomingContainer.dark) >= 4.5)
    }

    @Test func boundariesAndPresenceMeetThreeToOne() {
        for pair in [ColorTokens.border, ColorTokens.borderStrong] {
            #expect(contrast(pair.light, ColorTokens.bg.light) >= 3.0)
            #expect(contrast(pair.dark, ColorTokens.bg.dark) >= 3.0)
        }
        let presence = [
            ColorTokens.presenceOnline, ColorTokens.presenceIdle,
            ColorTokens.presenceAway, ColorTokens.presenceBusy,
            ColorTokens.presenceOffline,
        ]
        for pair in presence {
            #expect(contrast(pair.light, ColorTokens.surface.light) >= 3.0)
            #expect(contrast(pair.dark, ColorTokens.surface.dark) >= 3.0)
        }
    }

    @Test func chatAliasesResolveToAcceptedWebRoles() {
        #expect(ColorTokens.messageOutgoingContainer == ColorTokens.primary)
        #expect(ColorTokens.onMessageOutgoing == ColorTokens.onPrimary)
        #expect(ColorTokens.messageIncomingContainer == ColorTokens.surface)
        #expect(ColorTokens.onMessageIncoming == ColorTokens.body)
        #expect(ColorTokens.messageFailed == ColorTokens.error)
    }
}
```

- [ ] **Step 2: Write the token-value tests**

`apps/ios/FishKit/Tests/DesignSystemTests/TokenValueTests.swift`:

```swift
import Testing
@testable import DesignSystem

struct TokenValueTests {
    @Test func generatedValuesMatchTheManifest() {
        #expect(Spacing.md == 16)
        #expect(Spacing.threeXs == 2)
        #expect(Spacing.twoXl == 48)
        #expect(Radius.control == 12)
        #expect(Radius.chatInner == 4)
        #expect(Metrics.targetTouch == 44)
        #expect(Metrics.controlPrimary == 56)
        #expect(Metrics.paginationSlot == 144)
        #expect(MotionDuration.message == 0.2)
        #expect(MotionDuration.skeleton == 1.4)
        #expect(Opacity.focus == 0.72)
        #expect(ChatRules.maxMessageLength == 4000)
        #expect(ChatRules.counterThreshold == 3900)
    }
}
```

- [ ] **Step 3: Run the design-system tests**

Run:

```bash
pnpm ios:test -- -only-testing:DesignSystemTests 2>/dev/null | tail -5
```

(If your pnpm version does not forward flags after `--`, run the underlying `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:DesignSystemTests` from `apps/ios/FishKit`.)

Expected: `** TEST SUCCEEDED **`. A contrast failure means a mistranscribed manifest value — fix the JSON, `pnpm ios:tokens`, re-run.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Tests/DesignSystemTests
git commit -m "test(ios): assert WCAG AA contrast and token parity for generated tokens"
```

### Task 5: Fonts and typography

**Files:**
- Create: `apps/ios/FishKit/Sources/DesignSystem/Resources/Fonts/` (Lexend + Fraunces variable TTFs, OFL licenses — vendored, downloads are one-time)
- Create: `apps/ios/FishKit/Tests/DesignSystemTests/TypographyTests.swift`
- Create: `apps/ios/FishKit/Sources/DesignSystem/Typography/Fonts.swift`
- Create: `apps/ios/FishKit/Sources/DesignSystem/Typography/Typography.swift`

- [ ] **Step 1: Vendor the font files**

```bash
mkdir -p apps/ios/FishKit/Sources/DesignSystem/Resources/Fonts
curl -fL -o "apps/ios/FishKit/Sources/DesignSystem/Resources/Fonts/Lexend[wght].ttf" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/lexend/Lexend%5Bwght%5D.ttf"
curl -fL -o "apps/ios/FishKit/Sources/DesignSystem/Resources/Fonts/Fraunces[SOFT,WONK,opsz,wght].ttf" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf"
curl -fL -o "apps/ios/FishKit/Sources/DesignSystem/Resources/Fonts/OFL-Lexend.txt" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/lexend/OFL.txt"
curl -fL -o "apps/ios/FishKit/Sources/DesignSystem/Resources/Fonts/OFL-Fraunces.txt" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt"
```

Contingency if a URL 404s (Google occasionally renames axis sets): list the directory to find the real filename, then substitute it in both the curl command and `Fonts.fontFiles` below:

```bash
curl -s https://api.github.com/repos/google/fonts/contents/ofl/fraunces | grep '"name"'
```

Italic files are deliberately not bundled — the product uses no italics. The web loads only the Latin subset; the full TTF is fine on iOS (bundled, not network-loaded).

- [ ] **Step 2: Write the failing typography tests**

`apps/ios/FishKit/Tests/DesignSystemTests/TypographyTests.swift`:

```swift
import Testing
import UIKit
@testable import DesignSystem

struct TypographyTests {
    @Test func bundledNamedInstancesResolve() {
        Fonts.register()
        let required = ["Lexend-Regular", "Lexend-Medium", "Fraunces-SemiBold"]
        for name in required where UIFont(name: name, size: 17) == nil {
            let families = UIFont.familyNames.filter { $0.contains("Lexend") || $0.contains("Fraunces") }
            let available = families.flatMap(UIFont.fontNames(forFamilyName:))
            Issue.record("Missing \(name). Registered FISH font names: \(available)")
        }
        #expect(UIFont(name: "Lexend-Regular", size: 17) != nil)
        #expect(UIFont(name: "Lexend-Medium", size: 14) != nil)
        #expect(UIFont(name: "Fraunces-SemiBold", size: 20) != nil)
    }

    @Test func ladderMatchesProductSpec() {
        #expect(TypeScale.body.size == 17)
        #expect(TypeScale.body.lineHeight == 1.55)
        #expect(TypeScale.heading.size == 20)
        #expect(TypeScale.caption.size == 13)
        #expect(Typography.extraLineSpacing(for: .heading) == 0)
        #expect(Typography.extraLineSpacing(for: .body) > 0)
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:DesignSystemTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'Fonts' in scope`.

- [ ] **Step 4: Implement font registration and the typography API**

`apps/ios/FishKit/Sources/DesignSystem/Typography/Fonts.swift`:

```swift
import CoreText
import Foundation

public enum Fonts {
    /// Bundled variable-font files (Resources/Fonts). If a font drop renames
    /// an axis set, update here and in the vendor step.
    private static let fontFiles = [
        "Lexend[wght]",
        "Fraunces[SOFT,WONK,opsz,wght]",
    ]

    private static let registration: Void = {
        for name in fontFiles {
            guard
                let url = Bundle.module.url(
                    forResource: name, withExtension: "ttf", subdirectory: "Fonts"
                )
            else {
                assertionFailure("Missing bundled font \(name).ttf")
                continue
            }
            // Re-registration returns an error we deliberately ignore.
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }()

    /// Idempotent. Call before rendering FISH text — app launch, previews,
    /// and test setup all go through this.
    public static func register() { _ = registration }
}
```

`apps/ios/FishKit/Sources/DesignSystem/Typography/Typography.swift`:

```swift
import SwiftUI

public enum TextRole: String, CaseIterable, Sendable {
    case display, heading, body, ui, label, caption
}

public enum Typography {
    /// PostScript names of the variable-font named instances.
    /// TypographyTests proves these resolve and prints the registered names
    /// if a font drop ever changes them.
    static func fontName(for role: TextRole) -> String {
        switch role {
        case .display, .heading: "Fraunces-SemiBold"
        case .label: "Lexend-Medium"
        case .body, .ui, .caption: "Lexend-Regular"
        }
    }

    static func spec(for role: TextRole) -> TypeSpec {
        switch role {
        case .display: TypeScale.display
        case .heading: TypeScale.heading
        case .body: TypeScale.body
        case .ui: TypeScale.ui
        case .label: TypeScale.label
        case .caption: TypeScale.caption
        }
    }

    /// Dynamic Type anchor: the ladder scales with system text size,
    /// uncapped, relative to the closest native style.
    static func anchor(for role: TextRole) -> Font.TextStyle {
        switch role {
        case .display: .largeTitle
        case .heading: .title3
        case .body: .body
        case .ui, .label: .subheadline
        case .caption: .footnote
        }
    }

    public static func font(_ role: TextRole) -> Font {
        Fonts.register()
        let spec = spec(for: role)
        return .custom(fontName(for: role), size: spec.size, relativeTo: anchor(for: role))
    }

    /// SwiftUI exposes line spacing, not a line-height multiple; this
    /// approximates the product multiple against a nominal 1.2 line box.
    /// Rhythm parity is the goal, not pixel-identical line boxes.
    static func extraLineSpacing(for role: TextRole) -> CGFloat {
        let spec = spec(for: role)
        return max(0, spec.size * (spec.lineHeight - 1.2))
    }
}

public struct TextStyleModifier: ViewModifier {
    let role: TextRole

    public func body(content: Content) -> some View {
        content
            .font(Typography.font(role))
            .lineSpacing(Typography.extraLineSpacing(for: role))
    }
}

extension View {
    public func textStyle(_ role: TextRole) -> some View {
        modifier(TextStyleModifier(role: role))
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: same command as Step 3.
Expected: `** TEST SUCCEEDED **`. If `bundledNamedInstancesResolve` fails, read the recorded issue — it lists the actual registered PostScript names; update `Typography.fontName(for:)` and the test's `required` array to those names and re-run. Do not proceed with system-font fallbacks.

- [ ] **Step 6: Commit**

```bash
git add apps/ios/FishKit/Sources/DesignSystem apps/ios/FishKit/Tests/DesignSystemTests
git commit -m "feat(ios): bundle Lexend/Fraunces and expose the fixed FISH type ladder"
```

### Task 6: Icons

**Files:**
- Create: `apps/ios/FishKit/Sources/DesignSystem/Resources/Icons.xcassets/` (10 Tabler imagesets, vendored)
- Create: `design/icons/LICENSE-tabler.txt`
- Create: `apps/ios/FishKit/Tests/DesignSystemTests/IconTests.swift`
- Create: `apps/ios/FishKit/Sources/DesignSystem/Icons/Icon.swift`

- [ ] **Step 1: Write the failing icon tests**

`apps/ios/FishKit/Tests/DesignSystemTests/IconTests.swift`:

```swift
import Testing
@testable import DesignSystem

struct IconTests {
    @Test func everyIconResolvesFromTheBundle() {
        for icon in Icon.allCases {
            #expect(icon.uiImage != nil, "\(icon.rawValue) missing from Icons.xcassets")
        }
    }

    @Test func onlyBackIsDirectional() {
        #expect(Icon.allCases.filter(\.isDirectional) == [.back])
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:DesignSystemTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'Icon' in scope`.

- [ ] **Step 2: Vendor the Tabler assets**

Run from the repo root:

```bash
set -euo pipefail
TABLER_VERSION="3.31.0"
BASE="https://unpkg.com/@tabler/icons@${TABLER_VERSION}/icons/outline"
DEST="apps/ios/FishKit/Sources/DesignSystem/Resources/Icons.xcassets"
mkdir -p "$DEST" design/icons
printf '%s\n' '{' '  "info" : { "author" : "xcode", "version" : 1 }' '}' > "$DEST/Contents.json"
curl -fL -o design/icons/LICENSE-tabler.txt \
  "https://raw.githubusercontent.com/tabler/tabler-icons/main/LICENSE"
for name in arrow-left send rotate x user lock info-circle alert-triangle alert-circle check checks; do
  dir="$DEST/${name}.imageset"
  mkdir -p "$dir"
  curl -fL -o "$dir/${name}.svg" "$BASE/${name}.svg"
  # Match the web icon language: Tabler ships stroke-width 2, FISH renders 1.75.
  sed -i '' 's/stroke-width="2"/stroke-width="1.75"/' "$dir/${name}.svg"
  cat > "$dir/Contents.json" <<JSON
{
  "images" : [
    { "filename" : "${name}.svg", "idiom" : "universal" }
  ],
  "info" : { "author" : "xcode", "version" : 1 },
  "properties" : {
    "preserves-vector-representation" : true,
    "template-rendering-intent" : "template"
  }
}
JSON
done
```

Contingency if the pinned version 404s: `npm view @tabler/icons version`, substitute it for `TABLER_VERSION`, and append the fetched version to `design/icons/LICENSE-tabler.txt` as a provenance line. Assets are committed, so this download is one-time.

- [ ] **Step 3: Implement the icon API**

`apps/ios/FishKit/Sources/DesignSystem/Icons/Icon.swift`:

```swift
import SwiftUI
import UIKit

/// Semantic names over the bundled Tabler outline set (1.75 stroke, rendered
/// at the 20 pt glyph token). Feature code never references asset filenames.
public enum Icon: String, CaseIterable, Sendable {
    case back = "arrow-left"
    case send = "send"
    case retry = "rotate"
    case close = "x"
    case person = "user"
    case lock = "lock"
    case info = "info-circle"
    case warning = "alert-triangle"
    case alert = "alert-circle"
    case check = "check"
    case checkDouble = "checks"

    /// Directional glyphs mirror in right-to-left layouts.
    public var isDirectional: Bool { self == .back }

    /// Decorative by default — the owning control supplies the accessible
    /// name. Size with glyphFrame().
    @MainActor public var image: some View {
        Image(rawValue, bundle: .module)
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .flipsForRightToLeftLayoutDirection(isDirectional)
            .accessibilityHidden(true)
    }

    var uiImage: UIImage? {
        UIImage(named: rawValue, in: .module, with: nil)
    }
}

extension View {
    /// The one glyph size used across every icon-only control.
    public func glyphFrame() -> some View {
        frame(width: Metrics.iconGlyph, height: Metrics.iconGlyph)
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: same command as Step 1.
Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/FishKit/Sources/DesignSystem design/icons apps/ios/FishKit/Tests/DesignSystemTests/IconTests.swift
git commit -m "feat(ios): add semantic Icon API over curated Tabler assets"
```

### Task 7: Motion policy

**Files:**
- Create: `apps/ios/FishKit/Tests/DesignSystemTests/MotionTests.swift`
- Create: `apps/ios/FishKit/Sources/DesignSystem/Motion/MotionPolicy.swift`

- [ ] **Step 1: Write the failing motion tests**

`apps/ios/FishKit/Tests/DesignSystemTests/MotionTests.swift`:

```swift
import Testing
@testable import DesignSystem

struct MotionTests {
    @Test func reducedMotionCollapsesEveryAnimation() {
        #expect(Motion.animation(MotionDuration.fade, reduceMotion: true) == nil)
        #expect(Motion.skeletonPulse(reduceMotion: true) == nil)
        #expect(Motion.typingLoop(reduceMotion: true, delay: 0) == nil)
    }

    @Test func standardMotionUsesTokenDurations() {
        #expect(Motion.animation(MotionDuration.message, reduceMotion: false) != nil)
        #expect(Motion.skeletonPulse(reduceMotion: false) != nil)
        #expect(Motion.typingLoop(reduceMotion: false, delay: MotionDuration.typingDelayShort) != nil)
    }
}
```

Run: `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:DesignSystemTests 2>&1 | tail -5` (from `apps/ios/FishKit`)
Expected: BUILD FAILED — `cannot find 'Motion' in scope`.

- [ ] **Step 2: Implement the motion policy**

`apps/ios/FishKit/Sources/DesignSystem/Motion/MotionPolicy.swift`:

```swift
import SwiftUI

/// Motion explains state — nothing else. Calm ease-out, opacity/transform
/// only, no bounce/elastic/parallax. Under Reduce Motion every helper
/// returns nil so state changes apply immediately and loops stop rather
/// than flicker (the web clamps duration AND iteration count; returning
/// nil is the SwiftUI equivalent of both).
public enum Motion {
    public static func animation(_ duration: TimeInterval, reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : .easeOut(duration: duration)
    }

    public static func skeletonPulse(reduceMotion: Bool) -> Animation? {
        reduceMotion
            ? nil
            : .easeInOut(duration: MotionDuration.skeleton).repeatForever(autoreverses: true)
    }

    public static func typingLoop(reduceMotion: Bool, delay: TimeInterval) -> Animation? {
        reduceMotion
            ? nil
            : .easeInOut(duration: MotionDuration.typing)
                .repeatForever(autoreverses: false)
                .delay(delay)
    }
}
```

Components read `@Environment(\.accessibilityReduceMotion)` and pass it in — the policy stays a pure, testable function. (A future in-app reduced-motion preference ORs into the same parameter; no component changes.)

- [ ] **Step 3: Run tests to verify they pass**

Run: same command as Step 1.
Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Sources/DesignSystem/Motion/MotionPolicy.swift apps/ios/FishKit/Tests/DesignSystemTests/MotionTests.swift
git commit -m "feat(ios): add reduced-motion-aware FISH motion policy"
```

### Task 8: ActionButton (+ shared snapshot helper)

**Files:**
- Create: `apps/ios/FishKit/Tests/UIComponentsTests/SnapshotSupport.swift`
- Create: `apps/ios/FishKit/Tests/UIComponentsTests/ActionButtonTests.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/Buttons/ActionButton.swift`

- [ ] **Step 1: Add the snapshot helper for this test target**

`apps/ios/FishKit/Tests/UIComponentsTests/SnapshotSupport.swift`:

```swift
import DesignSystem
import SnapshotTesting
import SwiftUI
import UIKit

/// Pins the SwiftUI environment so date/number rendering can't drift with
/// the host machine (Text(_:format:) reads these), and sits the view on the
/// product canvas.
@MainActor
private func pinned(_ view: some View) -> AnyView {
    AnyView(
        view
            .environment(\.locale, Locale(identifier: "en_US"))
            .environment(\.timeZone, TimeZone(identifier: "UTC")!)
            .background(Palette.bg)
    )
}

/// Renders the view on a pinned device in light and dark. Baselines are
/// simulator/OS-specific: record and verify on the same simulator.
@MainActor
func assertThemedSnapshots(
    of view: some View,
    named name: String,
    file: StaticString = #filePath,
    testName: String = #function,
    line: UInt = #line
) {
    Fonts.register()
    let host = UIHostingController(rootView: pinned(view))
    assertSnapshot(
        of: host, as: .image(on: .iPhone13), named: "\(name)-light",
        file: file, testName: testName, line: line
    )
    assertSnapshot(
        of: host, as: .image(on: .iPhone13, traits: .init(userInterfaceStyle: .dark)),
        named: "\(name)-dark", file: file, testName: testName, line: line
    )
}

/// Accessibility variants: XL Dynamic Type and right-to-left layout.
@MainActor
func assertAccessibilitySnapshots(
    of view: some View,
    named name: String,
    file: StaticString = #filePath,
    testName: String = #function,
    line: UInt = #line
) {
    Fonts.register()
    let xl = UIHostingController(rootView: pinned(view))
    assertSnapshot(
        of: xl,
        as: .image(on: .iPhone13, traits: .init(preferredContentSizeCategory: .accessibilityExtraLarge)),
        named: "\(name)-xl", file: file, testName: testName, line: line
    )
    let rtl = UIHostingController(
        rootView: pinned(view.environment(\.layoutDirection, .rightToLeft))
    )
    assertSnapshot(
        of: rtl, as: .image(on: .iPhone13), named: "\(name)-rtl",
        file: file, testName: testName, line: line
    )
}
```

- [ ] **Step 2: Write the failing button tests**

`apps/ios/FishKit/Tests/UIComponentsTests/ActionButtonTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct ActionButtonTests {
    @Test func heightsFollowTheTargetTokens() {
        #expect(ActionButton.height(for: .primary) == Metrics.controlPrimary)
        #expect(ActionButton.height(for: .secondary) == Metrics.targetTouch)
        #expect(ActionButton.height(for: .ghost) == Metrics.targetTouch)
    }

    @MainActor @Test func snapshots() {
        let states = VStack(spacing: Spacing.md) {
            ActionButton("Send message", variant: .primary, fullWidth: true) {}
            ActionButton("Send message", variant: .primary, isLoading: true, fullWidth: true) {}
            ActionButton("Save changes", variant: .secondary) {}
            ActionButton("Cancel", variant: .ghost) {}
            ActionButton("Save changes", variant: .secondary) {}.disabled(true)
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "button-states")
        assertAccessibilitySnapshots(of: states, named: "button-states")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:UIComponentsTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'ActionButton' in scope`.

- [ ] **Step 3: Implement ActionButton**

`apps/ios/FishKit/Sources/UIComponents/Buttons/ActionButton.swift`:

```swift
import DesignSystem
import SwiftUI

public enum ActionButtonVariant: Sendable {
    case primary, secondary, ghost
}

/// The FISH action control. Primary is the one full-contrast inversion a
/// screen may carry; secondary and ghost are the quiet treatments.
/// Loading preserves geometry and blocks duplicate activation. Disabled
/// swaps to muted-on-surface (token-pure, hue-free) without moving anything.
public struct ActionButton: View {
    private let title: String
    private let variant: ActionButtonVariant
    private let isLoading: Bool
    private let fullWidth: Bool
    private let action: () -> Void

    public init(
        _ title: String,
        variant: ActionButtonVariant = .secondary,
        isLoading: Bool = false,
        fullWidth: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.variant = variant
        self.isLoading = isLoading
        self.fullWidth = fullWidth
        self.action = action
    }

    static func height(for variant: ActionButtonVariant) -> CGFloat {
        variant == .primary ? Metrics.controlPrimary : Metrics.targetTouch
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                Text(title)
                    .textStyle(.ui)
                    .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView()
                }
            }
            .padding(.horizontal, Spacing.lg)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(height: Self.height(for: variant))
        }
        .buttonStyle(ActionButtonStyle(variant: variant, isLoading: isLoading))
        .disabled(isLoading)
        .accessibilityLabel(title)
        .accessibilityValue(isLoading ? "In progress" : "")
    }
}

struct ActionButtonStyle: ButtonStyle {
    let variant: ActionButtonVariant
    let isLoading: Bool
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        // A loading button keeps its normal look (busy, not abandoned);
        // only a truly disabled one goes muted-on-surface.
        let showsDisabled = !isEnabled && !isLoading
        configuration.label
            .foregroundStyle(foreground(showsDisabled: showsDisabled))
            .background(background(pressed: configuration.isPressed, showsDisabled: showsDisabled))
            .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
    }

    private func foreground(showsDisabled: Bool) -> Color {
        if showsDisabled { return Palette.muted }
        switch variant {
        case .primary: return Palette.onPrimary
        case .secondary: return Palette.foreground
        case .ghost: return Palette.body
        }
    }

    private func background(pressed: Bool, showsDisabled: Bool) -> Color {
        if showsDisabled {
            return variant == .ghost ? .clear : Palette.surface2
        }
        switch variant {
        case .primary: return pressed ? Palette.primaryPress : Palette.primary
        case .secondary: return pressed ? Palette.surface3 : Palette.surface2
        case .ghost: return pressed ? Palette.surface2 : .clear
        }
    }
}
```

- [ ] **Step 4: Run, record baselines, verify, inspect**

Run the Step 2 command **twice**. First run: unit test passes, snapshot assertions fail with "No reference was found on disk" and write baselines. Second run: `** TEST SUCCEEDED **`. Open the recorded PNGs under `Tests/UIComponentsTests/__Snapshots__/` and check: primary is a full-contrast inversion, loading keeps size, disabled is quiet, dark mode uses lighter-than-canvas fills, no shadows anywhere.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/FishKit/Sources/UIComponents apps/ios/FishKit/Tests/UIComponentsTests
git commit -m "feat(ios): add ActionButton with token-pure states and snapshot coverage"
```

### Task 9: IconButton

**Files:**
- Create: `apps/ios/FishKit/Tests/UIComponentsTests/IconButtonTests.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/Buttons/IconButton.swift`

- [ ] **Step 1: Write the failing tests**

`apps/ios/FishKit/Tests/UIComponentsTests/IconButtonTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct IconButtonTests {
    @MainActor @Test func snapshots() {
        let states = HStack(spacing: Spacing.md) {
            IconButton(.send, style: .solid, accessibilityLabel: "Send message") {}
            IconButton(.send, style: .solid, accessibilityLabel: "Send message", isBusy: true) {}
            IconButton(.back, style: .quiet, accessibilityLabel: "Back") {}
            IconButton(.close, style: .quiet, accessibilityLabel: "Close") {}.disabled(true)
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "icon-button-states")
        assertAccessibilitySnapshots(of: states, named: "icon-button-states")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:UIComponentsTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'IconButton' in scope`.

- [ ] **Step 2: Implement IconButton**

`apps/ios/FishKit/Sources/UIComponents/Buttons/IconButton.swift`:

```swift
import DesignSystem
import SwiftUI

/// Icon-only control: 44 pt target, 20 pt glyph, and a REQUIRED accessible
/// name — there is no initializer without one. Solid is reserved for the
/// screen's single primary action (e.g. Send message); quiet is everything
/// else.
public struct IconButton: View {
    public enum Style: Sendable {
        case solid, quiet
    }

    private let icon: Icon
    private let style: Style
    private let accessibilityLabel: String
    private let isBusy: Bool
    private let action: () -> Void

    public init(
        _ icon: Icon,
        style: Style = .quiet,
        accessibilityLabel: String,
        isBusy: Bool = false,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.style = style
        self.accessibilityLabel = accessibilityLabel
        self.isBusy = isBusy
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                icon.image
                    .glyphFrame()
                    .opacity(isBusy ? 0 : 1)
                if isBusy {
                    ProgressView()
                }
            }
            .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
        }
        .buttonStyle(IconButtonStyle(style: style, isBusy: isBusy))
        .disabled(isBusy)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(isBusy ? "In progress" : "")
    }
}

struct IconButtonStyle: ButtonStyle {
    let style: IconButton.Style
    let isBusy: Bool
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let showsDisabled = !isEnabled && !isBusy
        configuration.label
            .foregroundStyle(foreground(showsDisabled: showsDisabled))
            .background(background(pressed: configuration.isPressed, showsDisabled: showsDisabled))
            .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
    }

    private func foreground(showsDisabled: Bool) -> Color {
        if showsDisabled { return Palette.muted }
        return style == .solid ? Palette.onPrimary : Palette.body
    }

    private func background(pressed: Bool, showsDisabled: Bool) -> Color {
        if showsDisabled {
            return style == .solid ? Palette.surface2 : .clear
        }
        switch style {
        case .solid: return pressed ? Palette.primaryPress : Palette.primary
        case .quiet: return pressed ? Palette.surface2 : .clear
        }
    }
}
```

- [ ] **Step 3: Run twice (record, then verify), inspect PNGs**

Same command as Step 1. Expected: failures with "No reference" on first run, `** TEST SUCCEEDED **` on second. Verify the glyph is 20 pt inside a 44 pt target and busy preserves geometry.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Sources/UIComponents/Buttons/IconButton.swift apps/ios/FishKit/Tests/UIComponentsTests
git commit -m "feat(ios): add IconButton with required accessible name"
```

### Task 10: InputField

**Files:**
- Create: `apps/ios/FishKit/Tests/UIComponentsTests/InputFieldTests.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/Fields/InputField.swift`

- [ ] **Step 1: Write the failing tests**

`apps/ios/FishKit/Tests/UIComponentsTests/InputFieldTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct InputFieldTests {
    @Test func supportSlotAlwaysReservesGeometry() {
        #expect(InputField.supportText(for: .none) == nil)
        #expect(InputField.supportText(for: .hint("Use your work email")) == "Use your work email")
        #expect(InputField.supportText(for: .error("That email doesn't look complete")) == "That email doesn't look complete")
    }

    @MainActor @Test func snapshots() {
        let states = VStack(spacing: Spacing.lg) {
            InputField(label: "Full name", text: .constant(""))
            InputField(label: "Email", text: .constant("maya@example.com"),
                          support: .hint("We only use this to sign you in"))
            InputField(label: "Email", text: .constant("maya@"),
                          support: .error("That email doesn't look complete. Check the part after the @."))
            InputField(label: "Coach", text: .constant("Sam Rivera")).disabled(true)
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "text-field-states")
        assertAccessibilitySnapshots(of: states, named: "text-field-states")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:UIComponentsTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'InputField' in scope`.

- [ ] **Step 2: Implement InputField**

`apps/ios/FishKit/Sources/UIComponents/Fields/InputField.swift`:

```swift
import DesignSystem
import SwiftUI

/// Single-line labeled field. The label is always visible (never a
/// placeholder), the support slot reserves its line so validation cannot
/// shift layout, and focus swaps the fill one surface step — no ring, no
/// outline, no geometry change.
public struct InputField: View {
    public enum Support: Equatable, Sendable {
        case none
        case hint(String)
        case notice(String)
        case error(String)
    }

    private let label: String
    @Binding private var text: String
    private let support: Support
    @FocusState private var isFocused: Bool
    @Environment(\.isEnabled) private var isEnabled

    public init(label: String, text: Binding<String>, support: Support = .none) {
        self.label = label
        self._text = text
        self.support = support
    }

    static func supportText(for support: Support) -> String? {
        switch support {
        case .none: nil
        case .hint(let s), .notice(let s), .error(let s): s
        }
    }

    private var supportColor: Color {
        switch support {
        case .error: Palette.error
        case .notice: Palette.notice
        case .hint, .none: Palette.muted
        }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.twoXs) {
            Text(label)
                .textStyle(.label)
                .foregroundStyle(isEnabled ? Palette.foreground : Palette.muted)
            TextField("", text: $text)
                .textStyle(.body)
                .foregroundStyle(isEnabled ? Palette.foreground : Palette.muted)
                .focused($isFocused)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.fieldY)
                .background(isFocused ? Palette.surface3 : Palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                        .strokeBorder(Palette.border, lineWidth: 1)
                )
            Text(Self.supportText(for: support) ?? " ")
                .textStyle(.caption)
                .foregroundStyle(supportColor)
                .accessibilityHidden(Self.supportText(for: support) == nil)
        }
        .accessibilityElement(children: .contain)
    }
}
```

- [ ] **Step 3: Run twice (record, then verify), inspect PNGs**

Same command as Step 1. Verify: label above field, error copy calm (soft rose, not alarming red), the empty support line holds its height in the first state, focused state not snapshot-tested (focus is interactive; the catalog covers it manually).

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Sources/UIComponents/Fields/InputField.swift apps/ios/FishKit/Tests/UIComponentsTests
git commit -m "feat(ios): add InputField with reserved support slot and step-fill focus"
```

### Task 11: Avatar

**Files:**
- Create: `apps/ios/FishKit/Tests/UIComponentsTests/AvatarTests.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/Identity/Avatar.swift`

- [ ] **Step 1: Write the failing tests**

`apps/ios/FishKit/Tests/UIComponentsTests/AvatarTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct AvatarTests {
    @Test func initialsTakeTheFirstLettersOfUpToTwoWords() {
        #expect(Avatar.initials(from: "Maya Chen") == "MC")
        #expect(Avatar.initials(from: "Coach") == "C")
        #expect(Avatar.initials(from: "ana maría lópez") == "AM")
        #expect(Avatar.initials(from: "  ") == "")
        #expect(Avatar.initials(from: "") == "")
    }

    @MainActor @Test func snapshots() {
        let states = HStack(alignment: .center, spacing: Spacing.md) {
            Avatar(name: "Maya Chen", size: .sm)
            Avatar(name: "Maya Chen", size: .md)
            Avatar(name: "", size: .md) // neutral fallback, never gendered
            Avatar(name: "Sam Rivera", size: .profile)
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "avatar-states")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:UIComponentsTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'Avatar' in scope`.

- [ ] **Step 2: Implement Avatar**

`apps/ios/FishKit/Sources/UIComponents/Identity/Avatar.swift`:

```swift
import DesignSystem
import SwiftUI

/// Identity marker: image if available, else initials, else a neutral
/// person glyph (never gender-inferring imagery). Decorative by default —
/// the adjacent text carries identity for assistive tech; pass
/// isDecorative: false only when the avatar stands alone.
public struct Avatar: View {
    public enum Size: Sendable {
        case badge, sm, md, profile

        var points: CGFloat {
            switch self {
            case .badge: Metrics.avatarBadge
            case .sm: Metrics.avatarSm
            case .md: Metrics.avatarMd
            case .profile: Metrics.avatarProfile
            }
        }

        var initialsRole: TextRole? {
            switch self {
            case .badge: nil // too small for two glyphs at product sizes
            case .sm: .caption
            case .md: .ui
            case .profile: .heading
            }
        }
    }

    private let name: String
    private let image: Image?
    private let size: Size
    private let isDecorative: Bool

    public init(name: String, image: Image? = nil, size: Size, isDecorative: Bool = true) {
        self.name = name
        self.image = image
        self.size = size
        self.isDecorative = isDecorative
    }

    static func initials(from name: String) -> String {
        name.split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
            .uppercased()
    }

    public var body: some View {
        ZStack {
            Circle().fill(Palette.avatar)
            if let image {
                image
                    .resizable()
                    .scaledToFill()
                    .frame(width: size.points, height: size.points)
                    .clipShape(Circle())
            } else if let role = size.initialsRole, !Self.initials(from: name).isEmpty {
                Text(Self.initials(from: name))
                    .textStyle(role)
                    .foregroundStyle(Palette.foreground)
            } else {
                Icon.person.image
                    .glyphFrame()
                    .foregroundStyle(Palette.body)
            }
        }
        .frame(width: size.points, height: size.points)
        .accessibilityHidden(isDecorative)
        .accessibilityLabel(isDecorative ? "" : name)
    }
}
```

- [ ] **Step 3: Run twice (record, then verify), inspect PNGs**

Same command as Step 1. Verify initials contrast against the avatar fill in both themes and that the empty-name avatar shows the neutral glyph.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Sources/UIComponents/Identity/Avatar.swift apps/ios/FishKit/Tests/UIComponentsTests
git commit -m "feat(ios): add Avatar with initials and neutral fallback"
```

### Task 12: Notice

**Files:**
- Create: `apps/ios/FishKit/Tests/UIComponentsTests/NoticeTests.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/Feedback/Notice.swift`

- [ ] **Step 1: Write the failing tests**

`apps/ios/FishKit/Tests/UIComponentsTests/NoticeTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct NoticeTests {
    @Test func tonesMapToSemanticTokensAndIcons() {
        #expect(Notice.Tone.notice.icon == .info)
        #expect(Notice.Tone.warning.icon == .warning)
        #expect(Notice.Tone.error.icon == .alert)
        #expect(Notice.Tone.success.icon == .check)
    }

    @MainActor @Test func snapshots() {
        let states = VStack(spacing: Spacing.md) {
            Notice(tone: .notice, title: "Reconnecting",
                       message: "Your draft is safe while we reconnect.")
            Notice(tone: .error, title: "That didn't send",
                       message: "Check your connection, then try again.",
                       actionLabel: "Try sending again", onAction: {})
            Notice(tone: .warning, title: "Almost at the message limit",
                       message: "Messages can hold 4,000 characters.")
            Notice(tone: .success, title: "Message sent")
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "notice-states")
        assertAccessibilitySnapshots(of: states, named: "notice-states")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:UIComponentsTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'Notice' in scope`.

- [ ] **Step 2: Implement Notice**

`apps/ios/FishKit/Sources/UIComponents/Feedback/Notice.swift`:

```swift
import DesignSystem
import SwiftUI

/// Calm inline feedback. Tone hue appears only on the icon — copy stays in
/// the text roles, so meaning never rides on color alone. The informational
/// tier (notice) is monochrome by design. At most one quiet action.
public struct Notice: View {
    public enum Tone: Sendable {
        case notice, error, warning, success

        var color: Color {
            switch self {
            case .notice: Palette.notice
            case .error: Palette.error
            case .warning: Palette.warning
            case .success: Palette.success
            }
        }

        var icon: Icon {
            switch self {
            case .notice: .info
            case .error: .alert
            case .warning: .warning
            case .success: .check
            }
        }
    }

    private let tone: Tone
    private let title: String
    private let message: String?
    private let actionLabel: String?
    private let onAction: (() -> Void)?

    public init(
        tone: Tone,
        title: String,
        message: String? = nil,
        actionLabel: String? = nil,
        onAction: (() -> Void)? = nil
    ) {
        self.tone = tone
        self.title = title
        self.message = message
        self.actionLabel = actionLabel
        self.onAction = onAction
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            tone.icon.image
                .glyphFrame()
                .foregroundStyle(tone.color)
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                Text(title)
                    .textStyle(.label)
                    .foregroundStyle(Palette.foreground)
                if let message {
                    Text(message)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                }
                if let actionLabel, let onAction {
                    ActionButton(actionLabel, variant: .ghost, action: onAction)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(Spacing.md)
        .background(Palette.surface2, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
```

- [ ] **Step 3: Run twice (record, then verify), inspect PNGs**

Same command as Step 1. Verify error reads soft rose (not alarming), notice stays monochrome, and the ghost action sits inside the card without overpowering the copy.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Sources/UIComponents/Feedback/Notice.swift apps/ios/FishKit/Tests/UIComponentsTests
git commit -m "feat(ios): add Notice with calm semantic tones"
```

### Task 13: Skeleton and EmptyState

**Files:**
- Create: `apps/ios/FishKit/Tests/UIComponentsTests/SkeletonAndEmptyStateTests.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/Feedback/Skeleton.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/Feedback/EmptyState.swift`

- [ ] **Step 1: Write the failing tests**

`apps/ios/FishKit/Tests/UIComponentsTests/SkeletonAndEmptyStateTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct SkeletonAndEmptyStateTests {
    @MainActor @Test func skeletonSnapshots() {
        let states = VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(spacing: Spacing.xs) {
                SkeletonAvatar(size: .sm)
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    SkeletonBar(width: Metrics.skeletonAuthorWidth)
                    SkeletonBar()
                }
            }
            SkeletonBar()
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "skeleton-states")
    }

    @MainActor @Test func emptyStateSnapshots() {
        let states = VStack(spacing: Spacing.xl) {
            EmptyState(
                title: "No messages yet",
                message: "This is the start of your conversation with Sam."
            )
            EmptyState(
                title: "This conversation isn't available",
                message: "If you think this is a mistake, tell your coach.",
                actionLabel: "Go back",
                onAction: {}
            )
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "empty-states")
        assertAccessibilitySnapshots(of: states, named: "empty-states")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:UIComponentsTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'SkeletonBar' in scope`.

- [ ] **Step 2: Implement the skeleton shapes**

`apps/ios/FishKit/Sources/UIComponents/Feedback/Skeleton.swift`:

```swift
import DesignSystem
import SwiftUI

/// Loading placeholders that match final geometry. Calm opacity pulse —
/// never a shimmer sweep — and a static frame under Reduce Motion.
/// Silent to assistive tech; the owning screen announces loading.
public struct SkeletonBar: View {
    private let width: CGFloat?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false

    /// - Parameter width: fixed width, or nil to fill the available line.
    public init(width: CGFloat? = nil) {
        self.width = width
    }

    public var body: some View {
        Capsule()
            .fill(Palette.surface2)
            .frame(width: width, height: TypeScale.label.size)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
            .opacity(pulsing ? 0.7 : 0.4)
            .animation(Motion.skeletonPulse(reduceMotion: reduceMotion), value: pulsing)
            .onAppear { pulsing = !reduceMotion }
            .accessibilityHidden(true)
    }
}

public struct SkeletonAvatar: View {
    private let size: Avatar.Size
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false

    public init(size: Avatar.Size) {
        self.size = size
    }

    public var body: some View {
        Circle()
            .fill(Palette.surface2)
            .frame(width: size.points, height: size.points)
            .opacity(pulsing ? 0.7 : 0.4)
            .animation(Motion.skeletonPulse(reduceMotion: reduceMotion), value: pulsing)
            .onAppear { pulsing = !reduceMotion }
            .accessibilityHidden(true)
    }
}
```

- [ ] **Step 3: Implement the empty state**

`apps/ios/FishKit/Sources/UIComponents/Feedback/EmptyState.swift`:

```swift
import DesignSystem
import SwiftUI

/// Explains what an absence means, with at most one next action. Never a
/// gallery of suggestions — if the coach hasn't assigned anything, say so.
public struct EmptyState: View {
    private let title: String
    private let message: String?
    private let actionLabel: String?
    private let isPrimaryAction: Bool
    private let onAction: (() -> Void)?

    public init(
        title: String,
        message: String? = nil,
        actionLabel: String? = nil,
        isPrimaryAction: Bool = false,
        onAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.actionLabel = actionLabel
        self.isPrimaryAction = isPrimaryAction
        self.onAction = onAction
    }

    public var body: some View {
        VStack(spacing: Spacing.sm) {
            Text(title)
                .textStyle(.heading)
                .foregroundStyle(Palette.foreground)
                .multilineTextAlignment(.center)
            if let message {
                Text(message)
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                    .multilineTextAlignment(.center)
            }
            if let actionLabel, let onAction {
                ActionButton(actionLabel, variant: isPrimaryAction ? .primary : .secondary, action: onAction)
                    .padding(.top, Spacing.xs)
            }
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity)
    }
}
```

- [ ] **Step 4: Run twice (record, then verify), inspect PNGs**

Same command as Step 1. Verify skeleton bars match text-line geometry and the empty states read centered and calm.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/FishKit/Sources/UIComponents apps/ios/FishKit/Tests/UIComponentsTests
git commit -m "feat(ios): add Skeleton shapes and EmptyState"
```

### Task 14: TopBar

**Files:**
- Create: `apps/ios/FishKit/Tests/UIComponentsTests/TopBarTests.swift`
- Create: `apps/ios/FishKit/Sources/UIComponents/Navigation/TopBar.swift`

- [ ] **Step 1: Write the failing tests**

`apps/ios/FishKit/Tests/UIComponentsTests/TopBarTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct TopBarTests {
    @MainActor @Test func snapshots() {
        let states = VStack(spacing: Spacing.lg) {
            TopBar(title: "Profile")
            TopBar(title: "Conversation", onBack: {})
            TopBar(
                title: "Conversation",
                onBack: {},
                trailing: TopBarAction(icon: .info, accessibilityLabel: "Conversation details", action: {})
            )
        }
        assertThemedSnapshots(of: states, named: "top-bar-states")
        assertAccessibilitySnapshots(of: states, named: "top-bar-states")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:UIComponentsTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'TopBar' in scope`.

- [ ] **Step 2: Implement TopBar**

`apps/ios/FishKit/Sources/UIComponents/Navigation/TopBar.swift`:

```swift
import DesignSystem
import SwiftUI

public struct TopBarAction {
    public let icon: Icon
    public let accessibilityLabel: String
    public let action: () -> Void

    public init(icon: Icon, accessibilityLabel: String, action: @escaping () -> Void) {
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel
        self.action = action
    }
}

/// FISH-drawn chrome: a 64 pt header with an optional quiet back action,
/// a content slot, and at most one quiet trailing action. Drawing our own
/// bar keeps the monochrome hierarchy independent of system toolbar
/// materials. The divider is the decorative hairline token, not a border.
public struct TopBar<Content: View>: View {
    private let onBack: (() -> Void)?
    private let trailing: TopBarAction?
    private let content: Content

    public init(
        onBack: (() -> Void)? = nil,
        trailing: TopBarAction? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.onBack = onBack
        self.trailing = trailing
        self.content = content()
    }

    public var body: some View {
        HStack(spacing: Spacing.xs) {
            if let onBack {
                IconButton(.back, style: .quiet, accessibilityLabel: "Back", action: onBack)
            }
            content
                .frame(maxWidth: .infinity, alignment: .leading)
            if let trailing {
                IconButton(
                    trailing.icon,
                    style: .quiet,
                    accessibilityLabel: trailing.accessibilityLabel,
                    action: trailing.action
                )
            }
        }
        .padding(.horizontal, Spacing.xs)
        .frame(height: Metrics.chatHeader)
        .background(Palette.bg)
        .overlay(alignment: .bottom) {
            Palette.divider.frame(height: 1)
        }
    }
}

extension TopBar where Content == AnyView {
    /// Plain-title convenience.
    public init(title: String, onBack: (() -> Void)? = nil, trailing: TopBarAction? = nil) {
        self.init(onBack: onBack, trailing: trailing) {
            AnyView(
                Text(title)
                    .textStyle(.heading)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1)
            )
        }
    }
}
```

- [ ] **Step 3: Run twice (record, then verify), inspect PNGs**

Same command as Step 1. Verify the back glyph mirrors in the RTL snapshot (it is the directional icon) and the hairline reads as separation, not a boxed border.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Sources/UIComponents/Navigation/TopBar.swift apps/ios/FishKit/Tests/UIComponentsTests
git commit -m "feat(ios): add TopBar with quiet back and single trailing action"
```

### Task 15: Chat UI models and transcript logic (pure, TDD)

This task ports the web's proven presentation logic so both platforms group and label identically: `belongsToSameMessageGroup` from `apps/web/features/chat/model/message-grouping.ts` (same sender + same local calendar day + ≤ 5-minute gap) and `formatChatDayLabel` from `apps/web/features/chat/components/chat-message-list/chat-message-row/chat-day-label.ts` (Today / Yesterday / long date).

**Files:**
- Create: `apps/ios/FishKit/Tests/PersonalChatTests/ChatLogicTests.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Models/MessageUiModel.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Models/PersonalChatUiModel.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Logic/MessageGrouping.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Logic/ChatDayLabel.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Logic/TranscriptBuilder.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Logic/BubbleShape.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Logic/ChatRules.swift`

- [ ] **Step 1: Write the failing logic tests**

`apps/ios/FishKit/Tests/PersonalChatTests/ChatLogicTests.swift`:

```swift
import DesignSystem
import Foundation
import Testing
@testable import PersonalChat

private func date(_ iso: String) -> Date {
    ISO8601DateFormatter().date(from: iso)!
}

private let utc: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "UTC")!
    return c
}()

private let enUS = Locale(identifier: "en_US")

private func message(
    _ id: String, from senderId: String, direction: MessageDirection,
    at iso: String, body: String = "Hello", delivery: MessageDeliveryStatus? = nil
) -> MessageUiModel {
    MessageUiModel(
        id: id, direction: direction, senderId: senderId,
        senderName: senderId == "coach" ? "Sam Rivera" : "You",
        body: body, sentAt: date(iso), delivery: delivery
    )
}

struct GroupingTests {
    @Test func groupsSameSenderWithinGapOnSameDay() {
        let a = message("1", from: "coach", direction: .incoming, at: "2026-07-16T10:00:00Z")
        let b = message("2", from: "coach", direction: .incoming, at: "2026-07-16T10:04:59Z")
        #expect(MessageGrouping.belongsToSameGroup(previous: a, current: b, calendar: utc))
    }

    @Test func breaksOnGapSenderDayAndDisorder() {
        let a = message("1", from: "coach", direction: .incoming, at: "2026-07-16T10:00:00Z")
        let late = message("2", from: "coach", direction: .incoming, at: "2026-07-16T10:05:01Z")
        let other = message("3", from: "client", direction: .outgoing, at: "2026-07-16T10:01:00Z")
        let nextDay = message("4", from: "coach", direction: .incoming, at: "2026-07-17T00:01:00Z")
        let earlier = message("5", from: "coach", direction: .incoming, at: "2026-07-16T09:59:00Z")
        #expect(!MessageGrouping.belongsToSameGroup(previous: a, current: late, calendar: utc))
        #expect(!MessageGrouping.belongsToSameGroup(previous: a, current: other, calendar: utc))
        #expect(!MessageGrouping.belongsToSameGroup(previous: a, current: nextDay, calendar: utc))
        #expect(!MessageGrouping.belongsToSameGroup(previous: a, current: earlier, calendar: utc))
        #expect(!MessageGrouping.belongsToSameGroup(previous: nil, current: a, calendar: utc))
    }
}

struct DayLabelTests {
    private let now = date("2026-07-16T15:00:00Z")

    @Test func todayYesterdayAndLongDate() {
        #expect(ChatDayLabel.format(date("2026-07-16T01:00:00Z"), now: now, calendar: utc, locale: enUS) == "Today")
        #expect(ChatDayLabel.format(date("2026-07-15T23:00:00Z"), now: now, calendar: utc, locale: enUS) == "Yesterday")
        #expect(ChatDayLabel.format(date("2026-07-01T12:00:00Z"), now: now, calendar: utc, locale: enUS) == "July 1, 2026")
    }
}

struct TranscriptBuilderTests {
    private let now = date("2026-07-16T15:00:00Z")

    private var conversation: [MessageUiModel] {
        [
            message("m1", from: "coach", direction: .incoming, at: "2026-07-15T09:00:00Z"),
            message("m2", from: "coach", direction: .incoming, at: "2026-07-15T09:02:00Z"),
            message("m3", from: "coach", direction: .incoming, at: "2026-07-15T09:03:00Z"),
            message("m4", from: "client", direction: .outgoing, at: "2026-07-16T10:00:00Z", delivery: .read),
            message("m5", from: "client", direction: .outgoing, at: "2026-07-16T10:01:00Z", delivery: .delivered),
        ]
    }

    private func build(_ unreadAfter: String? = nil) -> [TranscriptItem] {
        TranscriptBuilder.build(
            messages: conversation, unreadAfterMessageId: unreadAfter,
            calendar: utc, now: now, locale: enUS
        )
    }

    @Test func insertsDaySeparatorsAtLocalDayBoundaries() {
        let labels = build().compactMap { item -> String? in
            if case .daySeparator(_, let label) = item { return label }
            return nil
        }
        #expect(labels == ["Yesterday", "Today"])
    }

    @Test func computesGroupPositionsAndMetaVisibility() {
        let rows = build().compactMap { item -> MessageRowUiModel? in
            if case .message(let row) = item { return row }
            return nil
        }
        #expect(rows.map(\.groupPosition) == [.first, .middle, .last, .first, .last])
        #expect(rows.map(\.showsMeta) == [true, false, false, true, false])
    }

    @Test func deliveryStatusShowsOnlyOnLatestOutgoingMessage() {
        let rows = build().compactMap { item -> MessageRowUiModel? in
            if case .message(let row) = item { return row }
            return nil
        }
        #expect(rows.map(\.showsDeliveryStatus) == [false, false, false, false, true])
    }

    @Test func unreadDividerLandsAfterTheMatchedMessageAndItsDaySeparator() {
        let ids = build("m3").map(\.id)
        #expect(ids == ["day-m1", "m1", "m2", "m3", "day-m4", "unread-divider", "m4", "m5"])
    }
}

struct BubbleShapeTests {
    @Test func connectedCornersTightenTowardSameSenderNeighbors() {
        let outFirst = BubbleShape.radii(direction: .outgoing, position: .first)
        #expect(outFirst.topTrailing == Radius.chat)
        #expect(outFirst.bottomTrailing == Radius.chatInner)
        #expect(outFirst.topLeading == Radius.chat)

        let inMiddle = BubbleShape.radii(direction: .incoming, position: .middle)
        #expect(inMiddle.topLeading == Radius.chatInner)
        #expect(inMiddle.bottomLeading == Radius.chatInner)
        #expect(inMiddle.topTrailing == Radius.chat)

        let solo = BubbleShape.radii(direction: .incoming, position: .solo)
        #expect(solo.topLeading == Radius.chat && solo.bottomLeading == Radius.chat)
    }
}

struct ComposerRulesTests {
    @Test func sendabilityRequiresVisibleTextWithinTheLimit() {
        #expect(ChatRules.isSendable("Hello"))
        #expect(!ChatRules.isSendable(""))
        #expect(!ChatRules.isSendable("   \n  "))
        #expect(ChatRules.isSendable(String(repeating: "a", count: 4000)))
        #expect(!ChatRules.isSendable(String(repeating: "a", count: 4001)))
    }

    @Test func counterAppearsNearTheLimitWithCalmGuidance() {
        #expect(ChatRules.counterGuidance(String(repeating: "a", count: 3899)) == nil)
        #expect(ChatRules.counterGuidance(String(repeating: "a", count: 3900)) == "3900 of 4000 characters")
        #expect(ChatRules.counterGuidance(String(repeating: "a", count: 4001))
            == "Messages can hold 4000 characters. This one is 4001.")
    }
}

struct AccessibilityLabelTests {
    @Test func combinesSenderTimeBodyAndStatus() {
        let row = MessageRowUiModel(
            message: message("m5", from: "client", direction: .outgoing,
                             at: "2026-07-16T10:01:00Z", body: "See you then!", delivery: .delivered),
            groupPosition: .solo, showsMeta: true, showsDeliveryStatus: true
        )
        let label = MessageAccessibility.label(for: row, locale: enUS, timeZone: TimeZone(identifier: "UTC")!)
        #expect(label == "You, 10:01 AM: See you then!. Delivered")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:PersonalChatTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'MessageUiModel' in scope`.

- [ ] **Step 2: Implement the models**

`apps/ios/FishKit/Sources/PersonalChat/Models/MessageUiModel.swift`:

```swift
import Foundation

public enum MessageDirection: Sendable, Equatable {
    case incoming, outgoing
}

public enum MessageDeliveryStatus: Sendable, Equatable {
    case sending, sent, delivered, read, failed
}

/// Presentation model only — no database or provider types. The follow-on
/// chat-state milestone maps reducer state into this shape; views never
/// change.
public struct MessageUiModel: Identifiable, Equatable, Sendable {
    public let id: String
    public let direction: MessageDirection
    public let senderId: String
    public let senderName: String
    public let body: String
    public let sentAt: Date
    /// Outgoing messages only; nil for incoming.
    public let delivery: MessageDeliveryStatus?

    public init(
        id: String,
        direction: MessageDirection,
        senderId: String,
        senderName: String,
        body: String,
        sentAt: Date,
        delivery: MessageDeliveryStatus? = nil
    ) {
        self.id = id
        self.direction = direction
        self.senderId = senderId
        self.senderName = senderName
        self.body = body
        self.sentAt = sentAt
        self.delivery = delivery
    }
}
```

`apps/ios/FishKit/Sources/PersonalChat/Models/PersonalChatUiModel.swift`:

```swift
import Foundation

public enum ChatConnectionState: Sendable, Equatable {
    case connected, connecting, reconnecting, offline
}

public enum OlderMessagesState: Sendable, Equatable {
    /// hidden = no older history exists; the slot renders nothing.
    /// idle/loading/failed share one reserved geometry.
    case hidden, idle, loading, failed
}

public enum PresenceTone: Sendable, Equatable {
    case online, idle, away, busy, offline
}

public struct PresenceUiModel: Sendable, Equatable {
    public let label: String
    public let tone: PresenceTone

    public init(label: String, tone: PresenceTone) {
        self.label = label
        self.tone = tone
    }
}

public enum PersonalChatPhase: Sendable, Equatable {
    case loading, unavailable, ready
}

public struct PersonalChatUiModel: Sendable, Equatable {
    public let participantName: String
    public let presence: PresenceUiModel?
    public let phase: PersonalChatPhase
    public let connection: ChatConnectionState
    public let olderMessages: OlderMessagesState
    public let messages: [MessageUiModel]
    public let unreadAfterMessageId: String?
    public let isParticipantTyping: Bool

    public init(
        participantName: String,
        presence: PresenceUiModel? = nil,
        phase: PersonalChatPhase = .ready,
        connection: ChatConnectionState = .connected,
        olderMessages: OlderMessagesState = .hidden,
        messages: [MessageUiModel] = [],
        unreadAfterMessageId: String? = nil,
        isParticipantTyping: Bool = false
    ) {
        self.participantName = participantName
        self.presence = presence
        self.phase = phase
        self.connection = connection
        self.olderMessages = olderMessages
        self.messages = messages
        self.unreadAfterMessageId = unreadAfterMessageId
        self.isParticipantTyping = isParticipantTyping
    }
}
```

- [ ] **Step 3: Implement grouping and day labels (web ports)**

`apps/ios/FishKit/Sources/PersonalChat/Logic/MessageGrouping.swift`:

```swift
import Foundation

/// Port of apps/web/features/chat/model/message-grouping.ts (WR-02): a
/// same-sender run stays one visual block only within a short gap and one
/// local calendar day, so identity and time never disappear for long runs.
public enum MessageGrouping {
    public static let groupGap: TimeInterval = 5 * 60

    public static func belongsToSameGroup(
        previous: MessageUiModel?,
        current: MessageUiModel,
        calendar: Calendar
    ) -> Bool {
        guard let previous, previous.senderId == current.senderId else { return false }
        guard calendar.isDate(previous.sentAt, inSameDayAs: current.sentAt) else { return false }
        let elapsed = current.sentAt.timeIntervalSince(previous.sentAt)
        return elapsed >= 0 && elapsed <= Self.groupGap
    }
}
```

`apps/ios/FishKit/Sources/PersonalChat/Logic/ChatDayLabel.swift`:

```swift
import Foundation

/// Port of chat-day-label.ts. "Today"/"Yesterday" stay English product copy
/// (FISH teaches English); older days use the locale's long date.
public enum ChatDayLabel {
    public static func format(
        _ date: Date,
        now: Date,
        calendar: Calendar,
        locale: Locale
    ) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return "Today" }
        if let yesterday = calendar.date(byAdding: .day, value: -1, to: now),
           calendar.isDate(date, inSameDayAs: yesterday) {
            return "Yesterday"
        }
        return date.formatted(
            Date.FormatStyle(date: .long, locale: locale, calendar: calendar, timeZone: calendar.timeZone)
        )
    }
}
```

- [ ] **Step 4: Implement the transcript builder**

`apps/ios/FishKit/Sources/PersonalChat/Logic/TranscriptBuilder.swift`:

```swift
import Foundation

public enum MessageGroupPosition: Sendable, Equatable {
    case solo, first, middle, last
}

public struct MessageRowUiModel: Identifiable, Equatable, Sendable {
    public let message: MessageUiModel
    public let groupPosition: MessageGroupPosition
    /// Time header on the first row of a block — identity/time reappear at
    /// every group start, mirroring the web transcript.
    public let showsMeta: Bool
    /// Delivery status text renders under the latest outgoing message only.
    public let showsDeliveryStatus: Bool

    public var id: String { message.id }

    public init(
        message: MessageUiModel,
        groupPosition: MessageGroupPosition,
        showsMeta: Bool,
        showsDeliveryStatus: Bool
    ) {
        self.message = message
        self.groupPosition = groupPosition
        self.showsMeta = showsMeta
        self.showsDeliveryStatus = showsDeliveryStatus
    }
}

public enum TranscriptItem: Identifiable, Equatable, Sendable {
    case daySeparator(id: String, label: String)
    case unreadDivider(id: String)
    case message(MessageRowUiModel)

    public var id: String {
        switch self {
        case .daySeparator(let id, _): id
        case .unreadDivider(let id): id
        case .message(let row): row.id
        }
    }
}

public enum TranscriptBuilder {
    /// `messages` must already be ordered oldest → newest — that is the
    /// store's contract, not the view's job to repair.
    public static func build(
        messages: [MessageUiModel],
        unreadAfterMessageId: String? = nil,
        calendar: Calendar = .current,
        now: Date = Date(),
        locale: Locale = .current
    ) -> [TranscriptItem] {
        var items: [TranscriptItem] = []
        items.reserveCapacity(messages.count + 4)
        let lastOutgoingId = messages.last(where: { $0.direction == .outgoing })?.id

        for (index, message) in messages.enumerated() {
            let previous = index > 0 ? messages[index - 1] : nil
            let next = index + 1 < messages.count ? messages[index + 1] : nil

            if previous == nil
                || !calendar.isDate(previous!.sentAt, inSameDayAs: message.sentAt) {
                let label = ChatDayLabel.format(message.sentAt, now: now, calendar: calendar, locale: locale)
                items.append(.daySeparator(id: "day-\(message.id)", label: label))
            }
            if let unreadAfterMessageId, previous?.id == unreadAfterMessageId {
                items.append(.unreadDivider(id: "unread-divider"))
            }

            let prevSame = MessageGrouping.belongsToSameGroup(
                previous: previous, current: message, calendar: calendar
            )
            let nextSame = next.map {
                MessageGrouping.belongsToSameGroup(previous: message, current: $0, calendar: calendar)
            } ?? false
            let position: MessageGroupPosition = switch (prevSame, nextSame) {
            case (false, false): .solo
            case (false, true): .first
            case (true, true): .middle
            case (true, false): .last
            }

            items.append(.message(MessageRowUiModel(
                message: message,
                groupPosition: position,
                showsMeta: !prevSame,
                showsDeliveryStatus: message.id == lastOutgoingId
            )))
        }
        return items
    }
}
```

- [ ] **Step 5: Implement bubble corners, composer rules, and the a11y label**

`apps/ios/FishKit/Sources/PersonalChat/Logic/BubbleShape.swift`:

```swift
import DesignSystem
import SwiftUI

/// Connected-group corners: the side facing a same-sender neighbor tightens
/// to the chat-inner radius (web rounded-chat / rounded-chat-inner).
public enum BubbleShape {
    public static func radii(
        direction: MessageDirection,
        position: MessageGroupPosition
    ) -> RectangleCornerRadii {
        let full = Radius.chat
        let inner = Radius.chatInner
        let (top, bottom): (CGFloat, CGFloat) = switch position {
        case .solo: (full, full)
        case .first: (full, inner)
        case .middle: (inner, inner)
        case .last: (inner, full)
        }
        return direction == .outgoing
            ? RectangleCornerRadii(topLeading: full, bottomLeading: full, bottomTrailing: bottom, topTrailing: top)
            : RectangleCornerRadii(topLeading: top, bottomLeading: bottom, bottomTrailing: full, topTrailing: full)
    }
}
```

`apps/ios/FishKit/Sources/PersonalChat/Logic/ChatRules.swift`:

```swift
import DesignSystem
import Foundation

extension ChatRules {
    /// Blank drafts are not sendable — the send control stays hidden rather
    /// than disabled-and-mysterious (web contract). The 4000 limit is
    /// enforced authoritatively by the command layer later; this counter is
    /// UI guidance. Counting uses Swift Characters for now; the chat-state
    /// parity milestone pins the shared code-point rule.
    public static func isSendable(_ draft: String) -> Bool {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && draft.count <= maxMessageLength
    }

    /// nil below the counter threshold; calm guidance at and past it.
    public static func counterGuidance(_ draft: String) -> String? {
        let count = draft.count
        guard count >= counterThreshold else { return nil }
        if count > maxMessageLength {
            return "Messages can hold \(maxMessageLength) characters. This one is \(count)."
        }
        return "\(count) of \(maxMessageLength) characters"
    }
}
```

Create `apps/ios/FishKit/Sources/PersonalChat/Logic/MessageAccessibility.swift` (add it to the **Files** list above):

```swift
import DesignSystem
import Foundation

/// One useful VoiceOver node per message: sender ("You" for outgoing),
/// localized time, body, and — on the latest outgoing message — status.
public enum MessageAccessibility {
    public static func label(
        for row: MessageRowUiModel,
        locale: Locale = .current,
        timeZone: TimeZone = .current
    ) -> String {
        let who = row.message.direction == .outgoing ? "You" : row.message.senderName
        let time = row.message.sentAt.formatted(
            Date.FormatStyle(time: .shortened, locale: locale, timeZone: timeZone)
        )
        var label = "\(who), \(time): \(row.message.body)"
        if row.showsDeliveryStatus, let delivery = row.message.delivery {
            label += ". \(MessageDeliveryPresentation.statusText(delivery))"
        }
        return label
    }
}

public enum MessageDeliveryPresentation {
    public static func statusText(_ status: MessageDeliveryStatus) -> String {
        switch status {
        case .sending: "Sending…"
        case .sent: "Sent"
        case .delivered: "Delivered"
        case .read: "Read"
        case .failed: "Not sent"
        }
    }

    /// Decorative reinforcement only — text carries the meaning.
    public static func icon(_ status: MessageDeliveryStatus) -> Icon? {
        switch status {
        case .sending: nil
        case .sent: .check
        case .delivered, .read: .checkDouble
        case .failed: .alert
        }
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: same command as Step 1.
Expected: `** TEST SUCCEEDED **`. The a11y label test pins UTC + en_US, so it is date-stable.

- [ ] **Step 7: Commit**

```bash
git add apps/ios/FishKit/Sources/PersonalChat apps/ios/FishKit/Tests/PersonalChatTests
git commit -m "feat(ios): add personal-chat UI models and web-parity transcript logic"
```

### Task 16: MessageBubble

**Files:**
- Create: `apps/ios/FishKit/Tests/PersonalChatTests/SnapshotSupport.swift` (deliberate copy of the UIComponentsTests helper — test targets cannot share sources)
- Create: `apps/ios/FishKit/Tests/PersonalChatTests/MessageBubbleTests.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/MessageBubble.swift`

- [ ] **Step 1: Copy the snapshot helper**

Copy `apps/ios/FishKit/Tests/UIComponentsTests/SnapshotSupport.swift` verbatim to `apps/ios/FishKit/Tests/PersonalChatTests/SnapshotSupport.swift`. No changes are needed — it only imports `DesignSystem`, `SnapshotTesting`, `SwiftUI`, and `UIKit`, all available to this target. (Test targets cannot share sources, so the duplication is deliberate.)

- [ ] **Step 2: Write the failing bubble tests**

`apps/ios/FishKit/Tests/PersonalChatTests/MessageBubbleTests.swift`:

```swift
import DesignSystem
import Foundation
import SwiftUI
import Testing
@testable import PersonalChat

private func row(
    _ id: String, direction: MessageDirection, body: String,
    at seconds: TimeInterval, position: MessageGroupPosition,
    showsMeta: Bool, delivery: MessageDeliveryStatus? = nil, showsStatus: Bool = false
) -> MessageRowUiModel {
    MessageRowUiModel(
        message: MessageUiModel(
            id: id, direction: direction, senderId: direction == .incoming ? "coach" : "client",
            senderName: "Sam Rivera", body: body,
            sentAt: Date(timeIntervalSince1970: 1_784_200_000 + seconds), delivery: delivery
        ),
        groupPosition: position, showsMeta: showsMeta, showsDeliveryStatus: showsStatus
    )
}

struct MessageBubbleTests {
    @MainActor @Test func snapshots() {
        let strip = VStack(spacing: Spacing.xs) {
            MessageBubble(row: row("1", direction: .incoming, body: "How did the presentation go?",
                                   at: 0, position: .first, showsMeta: true))
            MessageBubble(row: row("2", direction: .incoming,
                                   body: "Remember — pause before the key point. It gives your listeners time to catch up.",
                                   at: 60, position: .last, showsMeta: false))
            MessageBubble(row: row("3", direction: .outgoing, body: "It went really well!",
                                   at: 120, position: .first, showsMeta: true, delivery: .read))
            MessageBubble(row: row("4", direction: .outgoing, body: "I used the pause twice 😊",
                                   at: 150, position: .last, showsMeta: false, delivery: .delivered, showsStatus: true))
            MessageBubble(row: row("5", direction: .outgoing, body: "And this one didn't go through.",
                                   at: 400, position: .solo, showsMeta: true, delivery: .failed, showsStatus: true),
                          onRetry: { _ in })
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: strip, named: "message-bubbles")
        assertAccessibilitySnapshots(of: strip, named: "message-bubbles")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:PersonalChatTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'MessageBubble' in scope`.

- [ ] **Step 3: Implement MessageBubble**

`apps/ios/FishKit/Sources/PersonalChat/Views/MessageBubble.swift`:

```swift
import DesignSystem
import UIComponents
import SwiftUI

/// One message bubble. Outgoing uses the primary inversion; incoming sits
/// on surface — direction is also carried by alignment and corners, never
/// hue alone. The whole bubble is one VoiceOver node; a failed send exposes
/// a separate retry action.
public struct MessageBubble: View {
    private let row: MessageRowUiModel
    private let onRetry: ((String) -> Void)?

    public init(row: MessageRowUiModel, onRetry: ((String) -> Void)? = nil) {
        self.row = row
        self.onRetry = onRetry
    }

    private var isOutgoing: Bool { row.message.direction == .outgoing }
    private var horizontal: HorizontalAlignment { isOutgoing ? .trailing : .leading }
    private var frameAlignment: Alignment { isOutgoing ? .trailing : .leading }

    public var body: some View {
        VStack(alignment: horizontal, spacing: Spacing.threeXs) {
            VStack(alignment: horizontal, spacing: Spacing.threeXs) {
                if row.showsMeta {
                    // Text(_:format:) resolves against the environment
                    // locale/timeZone, which the snapshot helper pins.
                    Text(row.message.sentAt, format: Date.FormatStyle(time: .shortened))
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                }
                Text(row.message.body)
                    .textStyle(.body)
                    .foregroundStyle(isOutgoing ? Palette.onMessageOutgoing : Palette.onMessageIncoming)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.compact)
                    .background(
                        isOutgoing ? Palette.messageOutgoingContainer : Palette.messageIncomingContainer,
                        in: UnevenRoundedRectangle(
                            cornerRadii: BubbleShape.radii(
                                direction: row.message.direction, position: row.groupPosition
                            ),
                            style: .continuous
                        )
                    )
                if row.showsDeliveryStatus, let delivery = row.message.delivery, delivery != .failed {
                    statusLine(delivery)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(MessageAccessibility.label(for: row))

            if row.showsDeliveryStatus, row.message.delivery == .failed {
                failedLine
            }
        }
        .frame(maxWidth: .infinity, alignment: frameAlignment)
        // Reserved gutter keeps bubbles off the far edge (~the web 85% cap
        // at compact widths); an exact fraction cap arrives with the
        // adaptive-layout milestone. The fraction token is already in the
        // manifest for that day.
        .padding(isOutgoing ? .leading : .trailing, Spacing.twoXl)
    }

    private func statusLine(_ delivery: MessageDeliveryStatus) -> some View {
        HStack(spacing: Spacing.nudge) {
            if let icon = MessageDeliveryPresentation.icon(delivery) {
                icon.image
                    .frame(width: TypeScale.caption.size, height: TypeScale.caption.size)
                    .foregroundStyle(Palette.muted)
            }
            Text(MessageDeliveryPresentation.statusText(delivery))
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
        }
    }

    private var failedLine: some View {
        HStack(spacing: Spacing.nudge) {
            Icon.alert.image
                .frame(width: TypeScale.caption.size, height: TypeScale.caption.size)
                .foregroundStyle(Palette.messageFailed)
            Text("Not sent.")
                .textStyle(.caption)
                .foregroundStyle(Palette.messageFailed)
            if let onRetry {
                ActionButton("Try sending again", variant: .ghost) {
                    onRetry(row.message.id)
                }
            }
        }
    }
}
```

- [ ] **Step 4: Run twice (record, then verify), inspect PNGs**

Same command as Step 2. Verify: outgoing right-aligned inversion, incoming on surface, connected corners between grouped bubbles (16 pt outer, 4 pt facing), failed row calm rose with a quiet retry, RTL snapshot mirrors alignment.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/FishKit/Sources/PersonalChat/Components apps/ios/FishKit/Tests/PersonalChatTests
git commit -m "feat(ios): add MessageBubble with grouped corners and delivery status"
```

### Task 17: Separators, typing, connection notice, pagination slot

**Files:**
- Create: `apps/ios/FishKit/Tests/PersonalChatTests/ChatChromeTests.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/MessageDaySeparator.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/UnreadMessagesDivider.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/TypingIndicator.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/ChatConnectionNotice.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/OlderMessagesSlot.swift`

- [ ] **Step 1: Write the failing tests**

`apps/ios/FishKit/Tests/PersonalChatTests/ChatChromeTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import PersonalChat

struct ChatChromeTests {
    @Test func connectionNoticeCopyIsCalmAndDraftPreserving() {
        #expect(ChatConnectionNotice.content(for: .connected) == nil)
        #expect(ChatConnectionNotice.content(for: .connecting)?.title == "Connecting…")
        #expect(ChatConnectionNotice.content(for: .reconnecting)?.message == "Your draft is safe.")
        let offline = ChatConnectionNotice.content(for: .offline)
        #expect(offline?.title == "You're offline")
        #expect(offline?.message == "You can keep writing. Sending will be ready when you reconnect.")
    }

    @MainActor @Test func snapshots() {
        let strip = VStack(spacing: Spacing.lg) {
            MessageDaySeparator(label: "Today")
            UnreadMessagesDivider()
            TypingIndicator(name: "Sam Rivera")
            ChatConnectionNotice(state: .offline)
            OlderMessagesSlot(state: .loading, onRetry: {})
            OlderMessagesSlot(state: .failed, onRetry: {})
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: strip, named: "chat-chrome")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:PersonalChatTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'MessageDaySeparator' in scope`.

- [ ] **Step 2: Implement the four small components**

`apps/ios/FishKit/Sources/PersonalChat/Views/MessageDaySeparator.swift`:

```swift
import DesignSystem
import SwiftUI

/// Centered day pill; a heading for assistive tech, never a control.
public struct MessageDaySeparator: View {
    private let label: String

    public init(label: String) {
        self.label = label
    }

    public var body: some View {
        Text(label)
            .textStyle(.caption)
            .foregroundStyle(Palette.body)
            .padding(.horizontal, Spacing.xs)
            .padding(.vertical, Spacing.threeXs)
            .background(Palette.surface2, in: Capsule())
            .frame(maxWidth: .infinity)
            .accessibilityAddTraits(.isHeader)
    }
}
```

`apps/ios/FishKit/Sources/PersonalChat/Views/UnreadMessagesDivider.swift`:

```swift
import DesignSystem
import SwiftUI

/// Plain "New messages" — orientation, never a count or a judgement.
public struct UnreadMessagesDivider: View {
    public init() {}

    public var body: some View {
        HStack(spacing: Spacing.xs) {
            Palette.divider.frame(height: 1)
            Text("New messages")
                .textStyle(.caption)
                .foregroundStyle(Palette.notice)
                .fixedSize()
            Palette.divider.frame(height: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("New messages")
        .accessibilityAddTraits(.isHeader)
    }
}
```

`apps/ios/FishKit/Sources/PersonalChat/Views/TypingIndicator.swift`:

```swift
import DesignSystem
import SwiftUI

/// Restrained dots plus a text label. Announced once per appearance; the
/// stop announcement arrives with the stateful milestone. Dots hold still
/// under Reduce Motion — the label alone carries the meaning.
public struct TypingIndicator: View {
    private let name: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animating = false

    public init(name: String) {
        self.name = name
    }

    public var body: some View {
        HStack(spacing: Spacing.nudge) {
            HStack(spacing: Spacing.threeXs) {
                dot(delay: 0)
                dot(delay: MotionDuration.typingDelayShort)
                dot(delay: MotionDuration.typingDelayLong)
            }
            Text("\(name) is typing")
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
        }
        .padding(.horizontal, Spacing.page)
        .padding(.vertical, Spacing.threeXs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name) is typing")
        .onAppear {
            animating = !reduceMotion
            AccessibilityNotification.Announcement("\(name) is typing").post()
        }
    }

    private func dot(delay: TimeInterval) -> some View {
        Circle()
            .fill(Palette.muted)
            .frame(width: Spacing.nudge, height: Spacing.nudge)
            .offset(y: animating ? -Metrics.motionTypingOffset : 0)
            .opacity(animating ? 1 : 0.5)
            .animation(Motion.typingLoop(reduceMotion: reduceMotion, delay: delay), value: animating)
    }
}
```

`apps/ios/FishKit/Sources/PersonalChat/Views/ChatConnectionNotice.swift`:

```swift
import DesignSystem
import UIComponents
import SwiftUI

/// Inline connection status — always the monochrome notice tone, never a
/// modal, never focus-stealing, never an automatic retry loop.
public struct ChatConnectionNotice: View {
    private let state: ChatConnectionState

    public init(state: ChatConnectionState) {
        self.state = state
    }

    static func content(for state: ChatConnectionState) -> (title: String, message: String?)? {
        switch state {
        case .connected:
            nil
        case .connecting:
            ("Connecting…", nil)
        case .reconnecting:
            ("Reconnecting", "Your draft is safe.")
        case .offline:
            ("You're offline", "You can keep writing. Sending will be ready when you reconnect.")
        }
    }

    public var body: some View {
        if let content = Self.content(for: state) {
            Notice(tone: .notice, title: content.title, message: content.message)
                .padding(.horizontal, Spacing.page)
        }
    }
}
```

`apps/ios/FishKit/Sources/PersonalChat/Views/OlderMessagesSlot.swift`:

```swift
import DesignSystem
import UIComponents
import SwiftUI

/// Reserved region above the transcript (web WR-07 / --size-pagination-slot):
/// idle, loading, and failed all occupy the same 144 pt so the transcript
/// below never shifts. hidden renders nothing (no older history).
public struct OlderMessagesSlot: View {
    private let state: OlderMessagesState
    private let onRetry: () -> Void

    public init(state: OlderMessagesState, onRetry: @escaping () -> Void) {
        self.state = state
        self.onRetry = onRetry
    }

    public var body: some View {
        if state != .hidden {
            content
                .frame(height: Metrics.paginationSlot)
                .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .hidden, .idle:
            Color.clear
        case .loading:
            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack(spacing: Spacing.xs) {
                    SkeletonAvatar(size: .sm)
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        SkeletonBar(width: Metrics.skeletonAuthorWidth)
                        SkeletonBar()
                    }
                }
                SkeletonBar()
            }
            .padding(.horizontal, Spacing.page)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading earlier messages")
        case .failed:
            VStack(spacing: Spacing.xs) {
                Text("Earlier messages didn't load.")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.body)
                ActionButton("Try loading earlier messages again", variant: .ghost, action: onRetry)
            }
        }
    }
}
```

- [ ] **Step 3: Run twice (record, then verify), inspect PNGs**

Same command as Step 1. Verify both `OlderMessagesSlot` states occupy identical height, and the typing dots + label read quietly.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Sources/PersonalChat/Components apps/ios/FishKit/Tests/PersonalChatTests
git commit -m "feat(ios): add chat separators, typing, connection notice, pagination slot"
```

### Task 18: MessageComposer

**Files:**
- Create: `apps/ios/FishKit/Tests/PersonalChatTests/MessageComposerTests.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/MessageComposer.swift`

- [ ] **Step 1: Write the failing tests**

`apps/ios/FishKit/Tests/PersonalChatTests/MessageComposerTests.swift`:

```swift
import DesignSystem
import SwiftUI
import Testing
@testable import PersonalChat

struct MessageComposerTests {
    @Test func sendControlVisibility() {
        #expect(!MessageComposer.showsSend(draft: "", sendState: .ready))
        #expect(!MessageComposer.showsSend(draft: "   ", sendState: .ready))
        #expect(MessageComposer.showsSend(draft: "Hello", sendState: .ready))
        // While sending, the busy control stays even if the draft cleared.
        #expect(MessageComposer.showsSend(draft: "", sendState: .sending))
        // Offline: keep typing, no send affordance.
        #expect(!MessageComposer.showsSend(draft: "Hello", sendState: .offline))
    }

    @MainActor @Test func snapshots() {
        let states = VStack(spacing: Spacing.lg) {
            MessageComposer(draft: .constant(""), sendState: .ready, onSend: {})
            MessageComposer(draft: .constant("I'll try the pausing trick tomorrow."), sendState: .ready, onSend: {})
            MessageComposer(draft: .constant("Sending this one."), sendState: .sending, onSend: {})
            MessageComposer(draft: .constant("Offline draft that must survive."), sendState: .offline, onSend: {})
            MessageComposer(draft: .constant(String(repeating: "a", count: 3950)), sendState: .ready, onSend: {})
        }
        .padding(.vertical, Spacing.page)
        assertThemedSnapshots(of: states, named: "composer-states")
        assertAccessibilitySnapshots(of: states, named: "composer-states")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:PersonalChatTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'MessageComposer' in scope`.

- [ ] **Step 2: Implement the composer**

`apps/ios/FishKit/Sources/PersonalChat/Views/MessageComposer.swift`:

```swift
import DesignSystem
import UIComponents
import SwiftUI

public enum ComposerSendState: Sendable, Equatable {
    case ready, sending, offline
}

/// The message composer — the screen's single primary action lives here.
/// The visible "Message" label never degrades to a placeholder; the field
/// grows then scrolls internally; Return inserts a newline (send is always
/// the explicit control); blank drafts show no send control at all.
public struct MessageComposer: View {
    @Binding private var draft: String
    private let sendState: ComposerSendState
    private let onSend: () -> Void

    public init(draft: Binding<String>, sendState: ComposerSendState, onSend: @escaping () -> Void) {
        self._draft = draft
        self.sendState = sendState
        self.onSend = onSend
    }

    static func showsSend(draft: String, sendState: ComposerSendState) -> Bool {
        if sendState == .sending { return true }
        if sendState == .offline { return false }
        return ChatRules.isSendable(draft)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.twoXs) {
            Text("Message")
                .textStyle(.label)
                .foregroundStyle(Palette.muted)
            HStack(alignment: .bottom, spacing: Spacing.xs) {
                TextField("", text: $draft, axis: .vertical)
                    .textStyle(.body)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1...6)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.compact)
                    .background(Palette.surface)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                            .strokeBorder(Palette.border, lineWidth: 1)
                    )
                    .frame(maxHeight: Metrics.composerMaxHeight)
                    .accessibilityLabel("Message")
                if Self.showsSend(draft: draft, sendState: sendState) {
                    IconButton(
                        .send,
                        style: .solid,
                        accessibilityLabel: "Send message",
                        isBusy: sendState == .sending
                    ) {
                        guard ChatRules.isSendable(draft) else { return }
                        onSend()
                    }
                }
            }
            if let guidance = ChatRules.counterGuidance(draft) {
                Text(guidance)
                    .textStyle(.caption)
                    .foregroundStyle(draft.count > ChatRules.maxMessageLength ? Palette.error : Palette.muted)
            }
            if sendState == .offline {
                Text("You're offline. Your draft is saved and will be ready to send when you reconnect.")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.notice)
            }
        }
        .padding(.horizontal, Spacing.page)
        .padding(.vertical, Spacing.xs)
        .background(Palette.bg)
    }
}
```

- [ ] **Step 3: Run twice (record, then verify), inspect PNGs**

Same command as Step 1. Verify: empty draft shows no send control; the sending state shows the busy solid control at unchanged size; the near-limit state shows the calm counter; the offline state keeps the field editable-looking with the saved-draft copy.

- [ ] **Step 4: Commit**

```bash
git add apps/ios/FishKit/Sources/PersonalChat/Views/MessageComposer.swift apps/ios/FishKit/Tests/PersonalChatTests
git commit -m "feat(ios): add MessageComposer with sendability and limit rules"
```

### Task 19: Chat top bar, transcript, screen, fixtures, and the state-matrix snapshots

**Files:**
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/PersonalChatTopBar.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Views/PersonalChatTranscript.swift`
- Create: `apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift`
- Create: `apps/ios/FishKit/Sources/TestSupport/Fixtures/PersonalChatFixtures.swift`
- Create: `apps/ios/FishKit/Tests/PersonalChatTests/PersonalChatScreenTests.swift`

- [ ] **Step 1: Write the failing screen tests**

`apps/ios/FishKit/Tests/PersonalChatTests/PersonalChatScreenTests.swift`:

```swift
import DesignSystem
import TestSupport
import SwiftUI
import Testing
@testable import PersonalChat

struct PersonalChatScreenTests {
    @Test func composerStateDerivesFromConnectionAndSendingMessages() {
        #expect(PersonalChatScreen.composerState(for: PersonalChatFixtures.loaded) == .ready)
        #expect(PersonalChatScreen.composerState(for: PersonalChatFixtures.offline) == .offline)
        #expect(PersonalChatScreen.composerState(for: PersonalChatFixtures.sending) == .sending)
    }

    @MainActor @Test func screenStateMatrixSnapshots() {
        let fixtures: [(String, PersonalChatUiModel, String)] = [
            ("loading", PersonalChatFixtures.loading, ""),
            ("empty", PersonalChatFixtures.empty, ""),
            ("loaded", PersonalChatFixtures.loaded, ""),
            ("unread", PersonalChatFixtures.unread, ""),
            ("loading-earlier", PersonalChatFixtures.loadingEarlier, ""),
            ("earlier-failed", PersonalChatFixtures.earlierFailed, ""),
            ("sending", PersonalChatFixtures.sending, ""),
            ("send-failed", PersonalChatFixtures.sendFailed, ""),
            ("reconnecting", PersonalChatFixtures.reconnecting, ""),
            ("offline", PersonalChatFixtures.offline, "Draft that survives going offline."),
            ("typing", PersonalChatFixtures.typing, ""),
            ("long-content", PersonalChatFixtures.longContent, ""),
            ("unavailable", PersonalChatFixtures.unavailable, ""),
        ]
        for (name, model, draft) in fixtures {
            let screen = PersonalChatScreen(
                model: model,
                draft: .constant(draft),
                context: PersonalChatFixtures.context,
                onSend: {}, onRetryMessage: { _ in }, onRetryOlder: {}, onBack: {}
            )
            assertThemedSnapshots(of: screen, named: "screen-\(name)")
        }
        assertAccessibilitySnapshots(of: PersonalChatScreen(
            model: PersonalChatFixtures.loaded,
            draft: .constant(""),
            context: PersonalChatFixtures.context,
            onSend: {}, onRetryMessage: { _ in }, onRetryOlder: {}, onBack: {}
        ), named: "screen-loaded")
    }
}
```

Run (from `apps/ios/FishKit`): `xcodebuild test -scheme FishKit-Package -destination "$SIM" -only-testing:PersonalChatTests 2>&1 | tail -5`
Expected: BUILD FAILED — `cannot find 'PersonalChatScreen' in scope`.

- [ ] **Step 2: Implement the chat top bar**

`apps/ios/FishKit/Sources/PersonalChat/Views/PersonalChatTopBar.swift`:

```swift
import DesignSystem
import UIComponents
import SwiftUI

/// Conversation identity: avatar, name, static presence. Deliberately no
/// call button, no overflow menu — those features do not exist yet and the
/// bar must not advertise them.
public struct PersonalChatTopBar: View {
    private let participantName: String
    private let presence: PresenceUiModel?
    private let onBack: (() -> Void)?

    public init(participantName: String, presence: PresenceUiModel?, onBack: (() -> Void)? = nil) {
        self.participantName = participantName
        self.presence = presence
        self.onBack = onBack
    }

    public var body: some View {
        TopBar(onBack: onBack) {
            AnyView(
                HStack(spacing: Spacing.sm) {
                    Avatar(name: participantName, size: .md)
                    VStack(alignment: .leading, spacing: Spacing.threeXs) {
                        Text(participantName)
                            .textStyle(.label)
                            .foregroundStyle(Palette.foreground)
                            .lineLimit(1)
                        if let presence {
                            HStack(spacing: Spacing.nudge) {
                                Circle()
                                    .fill(presence.tone.color)
                                    .frame(width: Spacing.nudge, height: Spacing.nudge)
                                Text(presence.label)
                                    .textStyle(.caption)
                                    .foregroundStyle(Palette.muted)
                            }
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            )
        }
    }
}

extension PresenceTone {
    fileprivate var color: Color {
        switch self {
        case .online: Palette.presenceOnline
        case .idle: Palette.presenceIdle
        case .away: Palette.presenceAway
        case .busy: Palette.presenceBusy
        case .offline: Palette.presenceOffline
        }
    }
}
```

- [ ] **Step 3: Implement the transcript**

`apps/ios/FishKit/Sources/PersonalChat/Views/PersonalChatTranscript.swift`:

```swift
import DesignSystem
import SwiftUI

/// Keyed lazy transcript, anchored to the newest message. Content is capped
/// at the chat width token and centered so wider windows stay calm.
public struct PersonalChatTranscript: View {
    private let items: [TranscriptItem]
    private let olderMessages: OlderMessagesState
    private let onRetryMessage: (String) -> Void
    private let onRetryOlder: () -> Void

    public init(
        items: [TranscriptItem],
        olderMessages: OlderMessagesState,
        onRetryMessage: @escaping (String) -> Void,
        onRetryOlder: @escaping () -> Void
    ) {
        self.items = items
        self.olderMessages = olderMessages
        self.onRetryMessage = onRetryMessage
        self.onRetryOlder = onRetryOlder
    }

    public var body: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.xs) {
                OlderMessagesSlot(state: olderMessages, onRetry: onRetryOlder)
                ForEach(items) { item in
                    switch item {
                    case .daySeparator(_, let label):
                        MessageDaySeparator(label: label)
                            .padding(.top, Spacing.sm)
                    case .unreadDivider:
                        UnreadMessagesDivider()
                    case .message(let row):
                        MessageBubble(row: row, onRetry: onRetryMessage)
                    }
                }
            }
            .padding(.horizontal, Spacing.page)
            .padding(.vertical, Spacing.xs)
            .frame(maxWidth: Metrics.chatContentMaxWidth)
            .frame(maxWidth: .infinity)
        }
        .defaultScrollAnchor(.bottom)
        .scrollDismissesKeyboard(.interactively)
    }
}
```

- [ ] **Step 4: Implement the stateless screen**

`apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift`:

```swift
import DesignSystem
import UIComponents
import SwiftUI

/// Deterministic inputs for transcript building — fixtures pin these so
/// snapshots don't drift with the wall clock.
public struct TranscriptContext: Sendable {
    public let now: Date
    public let calendar: Calendar
    public let locale: Locale

    public init(now: Date = Date(), calendar: Calendar = .current, locale: Locale = .current) {
        self.now = now
        self.calendar = calendar
        self.locale = locale
    }
}

/// The one-to-one conversation, stateless: a model in, intents out. The
/// single primary action on this screen is Send message, inside the
/// composer. Hierarchy: identity → transcript → recovery state (only when
/// needed) → composer.
public struct PersonalChatScreen: View {
    private let model: PersonalChatUiModel
    @Binding private var draft: String
    private let context: TranscriptContext
    private let onSend: () -> Void
    private let onRetryMessage: (String) -> Void
    private let onRetryOlder: () -> Void
    private let onBack: (() -> Void)?

    public init(
        model: PersonalChatUiModel,
        draft: Binding<String>,
        context: TranscriptContext = TranscriptContext(),
        onSend: @escaping () -> Void,
        onRetryMessage: @escaping (String) -> Void,
        onRetryOlder: @escaping () -> Void,
        onBack: (() -> Void)? = nil
    ) {
        self.model = model
        self._draft = draft
        self.context = context
        self.onSend = onSend
        self.onRetryMessage = onRetryMessage
        self.onRetryOlder = onRetryOlder
        self.onBack = onBack
    }

    static func composerState(for model: PersonalChatUiModel) -> ComposerSendState {
        if model.connection == .offline { return .offline }
        let isSending = model.messages.contains { $0.direction == .outgoing && $0.delivery == .sending }
        return isSending ? .sending : .ready
    }

    public var body: some View {
        VStack(spacing: 0) {
            PersonalChatTopBar(
                participantName: model.participantName,
                presence: model.presence,
                onBack: onBack
            )
            switch model.phase {
            case .unavailable:
                Spacer()
                EmptyState(
                    title: "This conversation isn't available",
                    message: "If you think this is a mistake, tell your coach.",
                    actionLabel: onBack != nil ? "Go back" : nil,
                    onAction: onBack
                )
                Spacer()
            case .loading:
                TranscriptSkeleton()
            case .ready:
                if model.messages.isEmpty {
                    Spacer()
                    EmptyState(
                        title: "No messages yet",
                        message: "This is the start of your conversation with \(model.participantName)."
                    )
                    Spacer()
                } else {
                    PersonalChatTranscript(
                        items: TranscriptBuilder.build(
                            messages: model.messages,
                            unreadAfterMessageId: model.unreadAfterMessageId,
                            calendar: context.calendar,
                            now: context.now,
                            locale: context.locale
                        ),
                        olderMessages: model.olderMessages,
                        onRetryMessage: onRetryMessage,
                        onRetryOlder: onRetryOlder
                    )
                }
            }
            if model.phase != .unavailable {
                if ChatConnectionNotice.content(for: model.connection) != nil {
                    ChatConnectionNotice(state: model.connection)
                        .padding(.bottom, Spacing.xs)
                }
                if model.isParticipantTyping {
                    TypingIndicator(name: model.participantName)
                }
                MessageComposer(
                    draft: $draft,
                    sendState: Self.composerState(for: model),
                    onSend: onSend
                )
            }
        }
        .background(Palette.bg)
    }
}

/// Loading placeholder that matches the loaded transcript's geometry.
struct TranscriptSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(alignment: .top, spacing: Spacing.xs) {
                    SkeletonAvatar(size: .sm)
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        SkeletonBar(width: Metrics.skeletonAuthorWidth)
                        SkeletonBar()
                        SkeletonBar()
                    }
                }
            }
        }
        .padding(Spacing.page)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading conversation")
    }
}
```

(`TranscriptSkeleton` needs `import UIComponents` — it is in this file's imports already.)

- [ ] **Step 5: Implement the fixtures**

`apps/ios/FishKit/Sources/TestSupport/Fixtures/PersonalChatFixtures.swift`:

```swift
import PersonalChat
import Foundation

/// Realistic coaching sample data for every screen state. English-learning
/// copy on purpose — never Lorem Ipsum. All dates are fixed so previews and
/// snapshots are deterministic; always pair with `context`.
public enum PersonalChatFixtures {
    public static let coachName = "Sam Rivera"

    public static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()
    public static let locale = Locale(identifier: "en_US")
    public static let now = date("2026-07-16T15:00:00Z")
    public static var context: TranscriptContext {
        TranscriptContext(now: now, calendar: calendar, locale: locale)
    }

    private static func date(_ iso: String) -> Date {
        ISO8601DateFormatter().date(from: iso)!
    }

    private static func incoming(_ id: String, _ body: String, at iso: String) -> MessageUiModel {
        MessageUiModel(id: id, direction: .incoming, senderId: "coach",
                       senderName: coachName, body: body, sentAt: date(iso))
    }

    private static func outgoing(
        _ id: String, _ body: String, at iso: String, delivery: MessageDeliveryStatus
    ) -> MessageUiModel {
        MessageUiModel(id: id, direction: .outgoing, senderId: "client",
                       senderName: "Maya Chen", body: body, sentAt: date(iso), delivery: delivery)
    }

    private static let baseMessages: [MessageUiModel] = [
        incoming("m1", "How did the presentation go?", at: "2026-07-15T09:00:00Z"),
        incoming("m2", "Remember — pause before your key point. It gives your listeners time to catch up.",
                 at: "2026-07-15T09:02:00Z"),
        outgoing("m3", "It went really well! I used the pause twice.", at: "2026-07-15T18:30:00Z", delivery: .read),
        incoming("m4", "That's great progress. Tomorrow, let's practice questions for your team meeting.",
                 at: "2026-07-16T08:05:00Z"),
        outgoing("m5", "Sounds good. See you then!", at: "2026-07-16T08:06:00Z", delivery: .delivered),
    ]

    private static func model(
        phase: PersonalChatPhase = .ready,
        connection: ChatConnectionState = .connected,
        older: OlderMessagesState = .idle,
        messages: [MessageUiModel] = baseMessages,
        unreadAfter: String? = nil,
        typing: Bool = false,
        presence: PresenceUiModel? = PresenceUiModel(label: "Online", tone: .online)
    ) -> PersonalChatUiModel {
        PersonalChatUiModel(
            participantName: coachName, presence: presence, phase: phase,
            connection: connection, olderMessages: older, messages: messages,
            unreadAfterMessageId: unreadAfter, isParticipantTyping: typing
        )
    }

    public static let loading = model(phase: .loading, messages: [])
    public static let unavailable = model(phase: .unavailable, messages: [], presence: nil)
    public static let empty = model(older: .hidden, messages: [])
    public static let loaded = model()
    public static let unread = model(unreadAfter: "m3")
    public static let loadingEarlier = model(older: .loading)
    public static let earlierFailed = model(older: .failed)
    public static let typing = model(typing: true)
    public static let reconnecting = model(connection: .reconnecting)
    public static let offline = model(
        connection: .offline,
        presence: PresenceUiModel(label: "Offline", tone: .offline)
    )
    public static let sending = model(messages: baseMessages + [
        outgoing("m6", "One more question about the agenda.", at: "2026-07-16T14:59:30Z", delivery: .sending),
    ])
    public static let sendFailed = model(messages: baseMessages + [
        outgoing("m6", "One more question about the agenda.", at: "2026-07-16T14:59:30Z", delivery: .failed),
    ])
    public static let longContent = model(messages: baseMessages + [
        outgoing(
            "m7",
            "Here is my longer practice paragraph: " +
            String(repeating: "I want to describe the quarterly results clearly and confidently. ", count: 12) +
            "Also a long link: https://example.com/very/long/path/that/should/wrap/gracefully/without/breaking/layout " +
            "and an unbroken string: " + String(repeating: "supercalifragilistic", count: 6) + " 😊",
            at: "2026-07-16T14:45:00Z", delivery: .sent
        ),
    ])
}
```

- [ ] **Step 6: Run twice (record, then verify), inspect the matrix**

Same command as Step 1 (first run records ~28 PNGs, second run verifies). Review every screen PNG against the screen-state matrix table: skeletons match geometry, the unread divider sits under the "Today" separator, the failed bubble offers one quiet retry, offline keeps the draft visible, long content wraps without horizontal overflow, dark mode keeps the nearer layers lighter than the canvas.

- [ ] **Step 7: Commit**

```bash
git add apps/ios/FishKit/Sources apps/ios/FishKit/Tests
git commit -m "feat(ios): compose stateless PersonalChatScreen with full state-matrix fixtures"
```

### Task 20: Catalog app, accessibility audit, and token guard

**Files:**
- Create: `scripts/ios-token-guard.mjs`
- Create: `apps/ios/Catalog/project.yml`
- Create: `apps/ios/Catalog/Sources/CatalogApp.swift`
- Create: `apps/ios/Catalog/Sources/CatalogPages.swift`
- Create: `apps/ios/Catalog/UITests/CatalogAccessibilityAuditTests.swift`
- Modify: `package.json` (root — add `ios:catalog` script)

- [ ] **Step 1: Write the token-guard script**

`scripts/ios-token-guard.mjs`:

```js
// Token discipline for FishKit sources: no raw colors, no direct font
// construction, no shadows. Generated token files and Typography are
// the only sanctioned owners of those calls.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve("apps/ios/FishKit/Sources");
const violations = [];

const RULES = [
  {
    name: "raw color construction (use Palette tokens)",
    pattern: /Color\(red:|UIColor\(red:|#colorLiteral|Color\(hue:|Color\(white:/,
    allow: (file) => file.includes(`${path.sep}Generated${path.sep}`),
  },
  {
    name: "hex color literal (use Palette tokens)",
    pattern: /"#[0-9a-fA-F]{3,8}"/,
    allow: () => false,
  },
  {
    name: "direct font construction (use Typography / textStyle)",
    pattern: /Font\.custom\(|\.font\(\.system/,
    allow: (file) => file.endsWith("Typography.swift"),
  },
  {
    name: "shadow (FISH uses no shadows)",
    pattern: /\.shadow\(/,
    allow: () => false,
  },
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith(".swift")) check(full);
  }
}

function check(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (const rule of RULES) {
    if (rule.allow(file)) continue;
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        violations.push(`${path.relative(process.cwd(), file)}:${index + 1} — ${rule.name}`);
      }
    });
  }
}

walk(ROOT);
if (violations.length > 0) {
  console.error(
    "[ios-guard] token-policy violations:\n" + violations.map((v) => `  ${v}`).join("\n")
  );
  process.exit(1);
}
console.log("[ios-guard] no raw colors, fonts, or shadows in FishKit sources");
```

- [ ] **Step 2: Prove the guard catches violations, then passes**

```bash
pnpm ios:guard
echo 'let bad = Color(red: 1, green: 0, blue: 0)' >> apps/ios/FishKit/Sources/UIComponents/UIComponents.swift
pnpm ios:guard || echo "guard correctly failed"
git checkout apps/ios/FishKit/Sources/UIComponents/UIComponents.swift
pnpm ios:guard
```

Expected: pass → violation report + "guard correctly failed" → pass again.

- [ ] **Step 3: Define the catalog project**

Install XcodeGen if missing: `command -v xcodegen >/dev/null || brew install xcodegen`

`apps/ios/Catalog/project.yml`:

```yaml
name: Catalog
options:
  bundleIdPrefix: app.fish
  deploymentTarget:
    iOS: "17.0"
  createIntermediateGroups: true
packages:
  FishKit:
    path: ../FishKit
targets:
  Catalog:
    type: application
    platform: iOS
    sources: [Sources]
    dependencies:
      - package: FishKit
        product: DesignSystem
      - package: FishKit
        product: UIComponents
      - package: FishKit
        product: PersonalChat
      - package: FishKit
        product: TestSupport
    settings:
      base:
        GENERATE_INFOPLIST_FILE: YES
        INFOPLIST_KEY_UILaunchScreen_Generation: YES
        PRODUCT_BUNDLE_IDENTIFIER: app.fish.catalog
        SWIFT_VERSION: "6.0"
        TARGETED_DEVICE_FAMILY: "1,2"
  CatalogUITests:
    type: bundle.ui-testing
    platform: iOS
    sources: [UITests]
    dependencies:
      - target: Catalog
schemes:
  Catalog:
    build:
      targets:
        Catalog: all
        CatalogUITests: [test]
    test:
      targets:
        - CatalogUITests
```

Add to root `package.json` scripts:

```json
"ios:catalog": "cd apps/ios/Catalog && xcodegen generate && xcodebuild test -project Catalog.xcodeproj -scheme Catalog -destination \"platform=iOS Simulator,name=${FISH_IOS_SIM:-iPhone 16}\""
```

- [ ] **Step 4: Implement the catalog app**

`apps/ios/Catalog/Sources/CatalogApp.swift`:

```swift
import DesignSystem
import SwiftUI

@main
struct CatalogApp: App {
    init() {
        Fonts.register()
    }

    var body: some Scene {
        WindowGroup {
            CatalogRoot()
        }
    }
}

/// Dev-only review tool — the iOS analog of the Android debug catalog. The
/// list-of-everything shape is exempt from the client "no menus" rule
/// because this target never ships to users.
struct CatalogRoot: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Components") {
                    NavigationLink("Buttons") { ButtonsPage() }
                    NavigationLink("Icon buttons") { IconButtonsPage() }
                    NavigationLink("Text fields") { TextFieldsPage() }
                    NavigationLink("Avatars") { AvatarsPage() }
                    NavigationLink("Notices") { NoticesPage() }
                    NavigationLink("Loading") { LoadingPage() }
                    NavigationLink("Empty states") { EmptyStatesPage() }
                    NavigationLink("Top bars") { TopBarsPage() }
                }
                Section("Personal chat") {
                    NavigationLink("Chat states") { ChatStatesPage() }
                }
            }
            .navigationTitle("FISH catalog")
        }
    }
}
```

`apps/ios/Catalog/Sources/CatalogPages.swift`:

```swift
import DesignSystem
import PersonalChat
import TestSupport
import UIComponents
import SwiftUI

private struct CatalogPage<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                content
            }
            .padding(Spacing.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Palette.bg)
        .navigationTitle(title)
    }
}

struct ButtonsPage: View {
    var body: some View {
        CatalogPage(title: "Buttons") {
            ActionButton("Send message", variant: .primary, fullWidth: true) {}
            ActionButton("Send message", variant: .primary, isLoading: true, fullWidth: true) {}
            ActionButton("Save changes", variant: .secondary) {}
            ActionButton("Cancel", variant: .ghost) {}
            ActionButton("Save changes", variant: .secondary) {}.disabled(true)
        }
    }
}

struct IconButtonsPage: View {
    var body: some View {
        CatalogPage(title: "Icon buttons") {
            HStack(spacing: Spacing.md) {
                IconButton(.send, style: .solid, accessibilityLabel: "Send message") {}
                IconButton(.send, style: .solid, accessibilityLabel: "Send message", isBusy: true) {}
                IconButton(.back, style: .quiet, accessibilityLabel: "Back") {}
                IconButton(.close, style: .quiet, accessibilityLabel: "Close") {}.disabled(true)
            }
        }
    }
}

struct TextFieldsPage: View {
    @State private var empty = ""
    @State private var filled = "maya@example.com"
    @State private var invalid = "maya@"

    var body: some View {
        CatalogPage(title: "Text fields") {
            InputField(label: "Full name", text: $empty)
            InputField(label: "Email", text: $filled, support: .hint("We only use this to sign you in"))
            InputField(label: "Email", text: $invalid,
                          support: .error("That email doesn't look complete. Check the part after the @."))
            InputField(label: "Coach", text: .constant("Sam Rivera")).disabled(true)
        }
    }
}

struct AvatarsPage: View {
    var body: some View {
        CatalogPage(title: "Avatars") {
            HStack(spacing: Spacing.md) {
                Avatar(name: "Maya Chen", size: .sm)
                Avatar(name: "Maya Chen", size: .md)
                Avatar(name: "", size: .md)
                Avatar(name: "Sam Rivera", size: .profile)
            }
        }
    }
}

struct NoticesPage: View {
    var body: some View {
        CatalogPage(title: "Notices") {
            Notice(tone: .notice, title: "Reconnecting", message: "Your draft is safe while we reconnect.")
            Notice(tone: .error, title: "That didn't send",
                       message: "Check your connection, then try again.",
                       actionLabel: "Try sending again", onAction: {})
            Notice(tone: .warning, title: "Almost at the message limit",
                       message: "Messages can hold 4,000 characters.")
            Notice(tone: .success, title: "Message sent")
        }
    }
}

struct LoadingPage: View {
    var body: some View {
        CatalogPage(title: "Loading") {
            HStack(spacing: Spacing.xs) {
                SkeletonAvatar(size: .sm)
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    SkeletonBar(width: Metrics.skeletonAuthorWidth)
                    SkeletonBar()
                }
            }
            OlderMessagesSlot(state: .loading, onRetry: {})
            OlderMessagesSlot(state: .failed, onRetry: {})
        }
    }
}

struct EmptyStatesPage: View {
    var body: some View {
        CatalogPage(title: "Empty states") {
            EmptyState(title: "No messages yet",
                           message: "This is the start of your conversation with Sam.")
            EmptyState(title: "This conversation isn't available",
                           message: "If you think this is a mistake, tell your coach.",
                           actionLabel: "Go back", onAction: {})
        }
    }
}

struct TopBarsPage: View {
    var body: some View {
        CatalogPage(title: "Top bars") {
            TopBar(title: "Profile")
            TopBar(title: "Conversation", onBack: {})
            PersonalChatTopBar(
                participantName: PersonalChatFixtures.coachName,
                presence: PresenceUiModel(label: "Online", tone: .online),
                onBack: {}
            )
        }
    }
}

struct ChatStatesPage: View {
    private let fixtures: [(String, PersonalChatUiModel)] = [
        ("Loading", PersonalChatFixtures.loading),
        ("Empty", PersonalChatFixtures.empty),
        ("Loaded", PersonalChatFixtures.loaded),
        ("Unread", PersonalChatFixtures.unread),
        ("Loading earlier", PersonalChatFixtures.loadingEarlier),
        ("Earlier failed", PersonalChatFixtures.earlierFailed),
        ("Sending", PersonalChatFixtures.sending),
        ("Send failed", PersonalChatFixtures.sendFailed),
        ("Reconnecting", PersonalChatFixtures.reconnecting),
        ("Offline", PersonalChatFixtures.offline),
        ("Typing", PersonalChatFixtures.typing),
        ("Long content", PersonalChatFixtures.longContent),
        ("Unavailable", PersonalChatFixtures.unavailable),
    ]

    var body: some View {
        List(fixtures, id: \.0) { name, model in
            NavigationLink(name) { ChatStateHost(model: model) }
        }
        .navigationTitle("Chat states")
    }
}

struct ChatStateHost: View {
    let model: PersonalChatUiModel
    @State private var draft = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        PersonalChatScreen(
            model: model,
            draft: $draft,
            context: PersonalChatFixtures.context,
            onSend: { draft = "" },
            onRetryMessage: { _ in },
            onRetryOlder: {},
            onBack: { dismiss() }
        )
        // TopBar draws the chat chrome; hide the system bar so system
        // materials never stack behind it.
        .toolbar(.hidden, for: .navigationBar)
    }
}
```

- [ ] **Step 5: Write the accessibility audit UI test**

`apps/ios/Catalog/UITests/CatalogAccessibilityAuditTests.swift`:

```swift
import XCTest

final class CatalogAccessibilityAuditTests: XCTestCase {
    @MainActor
    func testCatalogPagesPassAccessibilityAudit() throws {
        let app = XCUIApplication()
        app.launch()

        let pages = [
            "Buttons", "Icon buttons", "Text fields", "Avatars",
            "Notices", "Loading", "Empty states", "Top bars",
        ]
        for page in pages {
            app.buttons[page].firstMatch.tap()
            try app.performAccessibilityAudit()
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }

        app.buttons["Chat states"].firstMatch.tap()
        app.buttons["Loaded"].firstMatch.tap()
        try app.performAccessibilityAudit()
        app.buttons["Back"].firstMatch.tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
    }
}
```

If the audit reports a false positive on decorative content (skeleton pixels are the known candidate), scope the skip narrowly and record why:

```swift
try app.performAccessibilityAudit { issue in
    // Skeleton bars are decorative and hidden from assistive tech; ignore
    // contrast findings that carry no element reference.
    issue.auditType == .contrast && issue.element == nil
}
```

Never blanket-skip an audit type across the whole suite.

- [ ] **Step 6: Generate, run, and fix anything the audit finds**

Run: `pnpm ios:catalog`
Expected: XcodeGen writes `Catalog.xcodeproj` (gitignored), the app builds, and the UI test suite ends `** TEST SUCCEEDED **`. Audit findings are release-level defects: fix the component, re-run the component's snapshot tests, then re-run the audit.

- [ ] **Step 7: Full gate, then commit**

```bash
pnpm ios:tokens:check && pnpm ios:guard && pnpm ios:test && pnpm ios:catalog && pnpm build
git add scripts/ios-token-guard.mjs apps/ios/Catalog package.json
git commit -m "feat(ios): add debug catalog app with accessibility audits and token guard"
```

- [ ] **Step 8: Manual acceptance checklist (real device + simulator)**

Run the catalog on a device and walk the manual checks; record findings as issues before freezing component APIs:

- VoiceOver: bubble reads sender → time → body → status as one node; separators announce as headings; decorative dots/avatars are silent; send announces "Send message".
- Full Keyboard Access and hardware keyboard: every control reachable and operable; focus visible everywhere.
- Keyboard: open/close/rotate with a long draft; composer stays above the keyboard; transcript doesn't jump.
- Appearance: switch light/dark while the chat screen is open.
- System settings: Reduce Motion stops the typing/skeleton loops; largest accessibility text sizes reflow without clipping or overlap.
- Copy review with a coach and at least one target client: message direction, send clarity, failure recovery, and return-after-gap tone.

## Initial milestone definition of done

- [ ] `pnpm ios:tokens:check`, `pnpm ios:guard`, `pnpm ios:test`, `pnpm ios:catalog`, and `pnpm build` all pass from a clean checkout.
- [ ] Dependency direction holds: `DesignSystem ← UIComponents ← PersonalChat`, `TestSupport` never imported by shipping code paths (compiler-enforced).
- [ ] Every token value is generated from `design/tokens/fish.tokens.json`; contrast tests prove AA in both themes; the guard reports zero raw colors, fonts, or shadows.
- [ ] No system dynamic color, materials, or shadows anywhere; FISH draws its own chrome.
- [ ] All touch controls ≥ 44 pt; the primary control uses 56 pt; glyphs are 20 pt.
- [ ] Every inventory component has its required states, light/dark snapshots, and XL/RTL snapshots where text-bearing.
- [ ] The stateless screen covers the full state matrix from fixtures with committed baselines.
- [ ] VoiceOver, Full Keyboard Access, keyboard/IME, reduced-motion, and large-type manual checks pass on a real device.
- [ ] Accessibility audits pass across every catalog page with at most narrowly-scoped, documented skips.
- [ ] No Supabase, auth, persistence, realtime, group, call, media, reaction, search, or notification code or flags exist anywhere in `apps/ios`.
- [ ] A coach and at least one target client reviewed the catalog chat states with no blocking findings.
- [ ] Component APIs are versioned as the iOS visual contract (tag the commit `ios-foundation-v1`).

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Variable-font named instances differ from the expected PostScript names | `TypographyTests` prints the registered names on failure; the rename procedure is one constant + one test array. Never fall back silently to system fonts. |
| Snapshot baselines are simulator/OS/host specific | One pinned simulator for record and verify (Conventions section); baselines committed; changing runtimes is a deliberate re-record commit. |
| Bubble meta time renders via environment locale/timezone | Snapshot helper pins `en_US`/UTC through the SwiftUI environment; fixtures use fixed dates and a fixed `TranscriptContext`. |
| `lineSpacing` approximates the web line-height multiple | Documented approximation; rhythm-level parity verified visually in the catalog, not asserted pixel-exact. |
| System design-language drift (e.g. glass toolbars) restyles chrome | FISH draws its own `TopBar`; the chat host hides the system navigation bar; no system materials are used. |
| The web 85% bubble cap is approximated by a reserved gutter | The fraction lives in the manifest already; the adaptive-layout milestone implements the exact cap when panes make it matter. |
| Google Fonts / Tabler URLs move or rename | Assets are vendored after a one-time download; both tasks carry listing commands to locate renamed files. |
| Character counting diverges from the shared code-point rule | Counter is explicitly UI guidance; the chat-state parity milestone replays `chat-state-vectors.json` and pins the canonical rule. |
| Swift 6 strict concurrency friction in tests | All models are `Sendable` value types; UI-touching tests are `@MainActor`; no shared mutable state exists in the foundation. |
| Over-building for features that aren't validated | Scope-exclusion gates in this plan; no speculative parameters or flags; deferred components listed explicitly. |

## Current iOS references

- [Human Interface Guidelines — accessibility, touch targets, dark mode](https://developer.apple.com/design/human-interface-guidelines)
- [Swift Testing](https://developer.apple.com/documentation/testing)
- [Accessibility audits in UI tests (performAccessibilityAudit)](https://developer.apple.com/documentation/xctest/xcuiapplication/performaccessibilityaudit(for:_:))
- [Dynamic Type with custom fonts (Font.custom(_:size:relativeTo:))](https://developer.apple.com/documentation/swiftui/font/custom(_:size:relativeto:))
- [Applying custom fonts to text](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text)
- [defaultScrollAnchor](https://developer.apple.com/documentation/swiftui/view/defaultscrollanchor(_:))
- [pointfree swift-snapshot-testing](https://github.com/pointfreeco/swift-snapshot-testing)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)
- [supabase-swift (follow-on milestone 2 only)](https://github.com/supabase/supabase-swift)





