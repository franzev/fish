---
phase: quick-260705-amu
quick_id: 260705-amu
status: planned
created: 2026-07-05
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: []
files_modified:
  - apps/ios/.git
  - apps/ios/.DS_Store
  - apps/ios/FISH/.DS_Store
  - apps/ios/FISH/Assets.xcassets/.DS_Store
  - apps/ios/FISH/FISH.xcodeproj
  - apps/ios/FISH.xcodeproj/project.pbxproj
  - apps/ios/FISH/FISHApp.swift
  - apps/ios/FISH/ContentView.swift
  - apps/ios/FISH/Resources/Fonts/Lexend.ttf
  - apps/ios/FISH/Resources/Fonts/Fraunces.ttf
  - apps/ios/FISH/Resources/FontRegistry.swift
  - apps/ios/FISH/DesignSystem/Tokens.swift
  - apps/ios/FISH/DesignSystem/FISHTheme.swift
  - apps/ios/FISH/DesignSystem/FISHButton.swift
  - apps/ios/FISH/DesignSystem/FISHTextField.swift
  - apps/ios/FISH/DesignSystem/FISHCard.swift
  - apps/ios/FISH/DesignSystem/FISHProgress.swift
  - apps/ios/FISH/Chat/ChatModels.swift
  - apps/ios/FISH/Chat/AvatarView.swift
  - apps/ios/FISH/Chat/MessageBubble.swift
  - apps/ios/FISH/Chat/MessageRow.swift
  - apps/ios/FISH/Chat/TypingIndicatorView.swift
  - apps/ios/FISH/Chat/ChatInputBar.swift
  - apps/ios/FISH/Chat/ChatPreviewScreen.swift
must_haves:
  truths:
    - "The iOS app is tracked as part of the monorepo, not as a nested git repository or broken nested Xcode project."
    - "SwiftUI screens and components consume iOS design-system tokens instead of one-off raw styles."
    - "iOS tokens mirror the existing web/Android roles: colors, Lexend/Fraunces typography, spacing, radii, 56px/pt control size, and calm feedback tones."
    - "The first iOS screen is a calm chat preview with one primary action, assigned-not-browsed framing, large controls, and non-scolding copy."
    - "The FISH iOS scheme builds successfully from the monorepo path with no missing nested project warning."
  artifacts:
    - path: "apps/ios/FISH/DesignSystem/Tokens.swift"
      provides: "Canonical iOS token names and values mirrored from web globals.css and Android Tokens.kt"
      contains: "FISHColors"
    - path: "apps/ios/FISH/Resources/FontRegistry.swift"
      provides: "Runtime font registration for bundled Lexend/Fraunces TTF files"
      contains: "CTFontManagerRegisterFontsForURL"
    - path: "apps/ios/FISH/DesignSystem/FISHTheme.swift"
      provides: "SwiftUI environment entry point for fonts, colors, spacing, and radii"
      contains: "FISHTheme"
    - path: "apps/ios/FISH/Chat/ChatPreviewScreen.swift"
      provides: "Reusable chat preview screen composing header, messages, typing state, and input"
      contains: "ChatPreviewScreen"
  key_links:
    - from: "apps/ios/FISH/FISHApp.swift"
      to: "apps/ios/FISH/Resources/FontRegistry.swift"
      via: "app init registers fonts before SwiftUI renders"
      pattern: "FontRegistry\\.registerAll"
    - from: "apps/ios/FISH/ContentView.swift"
      to: "apps/ios/FISH/Chat/ChatPreviewScreen.swift"
      via: "ContentView renders ChatPreviewScreen inside FISHTheme"
      pattern: "ChatPreviewScreen"
    - from: "apps/ios/FISH/Chat/*.swift"
      to: "apps/ios/FISH/DesignSystem/*.swift"
      via: "chat UI imports and uses FISH token/components only"
      pattern: "(FISHColors|FISHSpacing|FISHRadius|FISHButton|FISHTextField|FISHCard)"
---

# Quick Task 260705-amu Plan

Bootstrap the native SwiftUI iOS app under `apps/ios` and give it the same calm, token-driven foundation as web and Android: architecture folders, custom fonts, shared design-system primitives, reusable chat UI components, previews, and a clean iOS build.

Scope is UI infrastructure only. Do not add Supabase, realtime, chat persistence, community feed, plan pickers, coaching templates, gamification, package dependencies, CocoaPods, or Swift Package Manager libraries.

## Fixed Facts

- FISH clients should receive assigned work, not browse options. The iOS preview should show one assigned coach conversation, not a conversation/template picker.
- A view may have at most one primary action. In the chat screen, that action is the send button.
- Controls must be large and calm: 56pt minimum control height, sentence-case copy, no alarming red chrome, no scolding language.
- Web tokens live in `apps/web/app/globals.css`; Android mirrors them in `apps/android/app/src/main/java/space/fishhub/app/designsystem/theme/Tokens.kt`. iOS should mirror Android's concrete token values because they are already converted from the web OKLCH token roles.
- Web fonts are Lexend for body/UI and Fraunces for headings. Existing TTF files are already available at `apps/android/app/src/main/res/font/lexend.ttf` and `apps/android/app/src/main/res/font/fraunces.ttf`; copy those into the iOS app bundle instead of introducing a download or package.
- The starter iOS project currently builds, but `xcodebuild -list -project apps/ios/FISH.xcodeproj` emits a warning because `apps/ios/FISH/FISH.xcodeproj` is a broken nested project reference. Remove that stray nested directory.
- `apps/ios/.git` exists and must be deleted so `apps/ios` is tracked from the monorepo root, not treated as a submodule or nested repository.

## Source Coverage Audit

| Source | Item | Coverage |
|--------|------|----------|
| GOAL | Bootstrap iOS project architecture | Task 1 creates `Resources`, `DesignSystem`, and `Chat` folders; Task 3 cleans nested git/project state. |
| GOAL | Custom fonts | Task 1 copies Lexend/Fraunces TTFs and registers them through CoreText. |
| GOAL | Shared design-system tokens synchronized with web/Android/iOS | Task 1 mirrors Android token values and web token roles in Swift token files. |
| GOAL | Initial reusable SwiftUI chat UI components and previews | Task 2 creates models, chat components, preview screen, and light/dark previews. |
| GOAL | Successful iOS build | Task 3 runs `xcodebuild` against the FISH scheme. |
| CONTEXT | One primary action, assigned-not-browsed, calm copy, no raw one-off SwiftUI styles | Task 1 tokenizes primitives; Task 2 enforces one send action and no picker UI; Task 3 greps chat files for raw styles. |
| CONTEXT | Treat iOS as monorepo content, not submodule | Task 3 deletes `apps/ios/.git` and verifies no nested `.git` remains. |
| REQ | No roadmap requirement IDs for quick task | No requirement IDs provided. |
| RESEARCH | No research phase requested | Not applicable. |

## Tasks

<task type="auto">
  <name>Task 1: Add iOS design-system foundation</name>
  <files>apps/ios/FISH/FISHApp.swift, apps/ios/FISH/ContentView.swift, apps/ios/FISH/Resources/Fonts/Lexend.ttf, apps/ios/FISH/Resources/Fonts/Fraunces.ttf, apps/ios/FISH/Resources/FontRegistry.swift, apps/ios/FISH/DesignSystem/Tokens.swift, apps/ios/FISH/DesignSystem/FISHTheme.swift, apps/ios/FISH/DesignSystem/FISHButton.swift, apps/ios/FISH/DesignSystem/FISHTextField.swift, apps/ios/FISH/DesignSystem/FISHCard.swift, apps/ios/FISH/DesignSystem/FISHProgress.swift</files>
  <action>Create `Resources/Fonts`, `Resources`, and `DesignSystem` under `apps/ios/FISH`. Copy `apps/android/app/src/main/res/font/lexend.ttf` to `apps/ios/FISH/Resources/Fonts/Lexend.ttf` and `apps/android/app/src/main/res/font/fraunces.ttf` to `apps/ios/FISH/Resources/Fonts/Fraunces.ttf`. Add `FontRegistry.swift` that imports CoreText and registers both bundled font URLs with `CTFontManagerRegisterFontsForURL`; call `FontRegistry.registerAll()` from `FISHApp.init()` before the scene body renders. Add `Tokens.swift` with token structs/enums for `FISHColors`, `FISHSpacing`, `FISHRadius`, `FISHSizes`, `FISHStroke`, and `FISHType`; mirror the Android concrete light/dark color values exactly and map token names back to web roles (`bg`, `surface`, `surface2`, `border`, `borderStrong`, `primary`, `primaryPress`, `onPrimary`, `foreground`, `body`, `muted`, `notice`, `error`, `warning`, `success`). Use raw color literals only inside this token file. Use Lexend custom font names `Lexend-Regular`, `Lexend-Medium`, `Lexend-SemiBold` and Fraunces custom font name `Fraunces-SemiBold` in type helpers. Add `FISHTheme` as the SwiftUI theme wrapper that sets background/foreground defaults and exposes token helpers without requiring every view to restyle itself. Add reusable `FISHButton` (`primary`, `secondary`, `ghost`, optional loading state that preserves layout), `FISHTextField` (visible label, hint/notice/error row with reserved height), `FISHCard`, and `FISHProgress` (visual progress only, no percentage-as-judgement). Keep every control at least 56pt high and avoid `.font(.system...)` in reusable product components.</action>
  <verify>
    <automated>test -f apps/ios/FISH/Resources/Fonts/Lexend.ttf && test -f apps/ios/FISH/Resources/Fonts/Fraunces.ttf && rg -q "CTFontManagerRegisterFontsForURL" apps/ios/FISH/Resources/FontRegistry.swift && rg -q "FontRegistry\\.registerAll" apps/ios/FISH/FISHApp.swift && rg -q "Lexend-Regular|Lexend-SemiBold|Fraunces-SemiBold" apps/ios/FISH/DesignSystem/Tokens.swift</automated>
  </verify>
  <done>Fonts are bundled and registered at app launch; iOS token files exist and mirror web/Android roles; reusable SwiftUI primitives cover button, text field, card, and progress using tokens and 56pt controls.</done>
</task>

<task type="auto">
  <name>Task 2: Build token-driven SwiftUI chat components and previews</name>
  <files>apps/ios/FISH/ContentView.swift, apps/ios/FISH/Chat/ChatModels.swift, apps/ios/FISH/Chat/AvatarView.swift, apps/ios/FISH/Chat/MessageBubble.swift, apps/ios/FISH/Chat/MessageRow.swift, apps/ios/FISH/Chat/TypingIndicatorView.swift, apps/ios/FISH/Chat/ChatInputBar.swift, apps/ios/FISH/Chat/ChatPreviewScreen.swift</files>
  <action>Create `apps/ios/FISH/Chat`. Add presentational view models in `ChatModels.swift`: `ChatParticipantView`, `MessageStatus`, and `ChatMessageView` shaped after the web chat `types.ts` but kept native Swift. Build `AvatarView`, `MessageBubble`, `MessageRow`, `TypingIndicatorView`, and `ChatInputBar` using the design-system tokens and primitives from Task 1. Sent bubbles use the inverted primary block (`primary`/`onPrimary`), received bubbles use `surface` plus `border`, and both use the shared card/control radii. `ChatInputBar` contains secondary/ghost icon affordances as needed and exactly one primary action: the send button with accessibility label `Send message`; it must be disabled or visually quiet when the trimmed draft is empty. Use SF Symbols for native icons; do not add an icon package. Add `ChatPreviewScreen` that shows one assigned coach conversation with calm copy, a header, sample sent/received messages, typing state, and the input bar. Replace the default `ContentView` globe screen with `FISHTheme { ChatPreviewScreen() }`. Add SwiftUI `#Preview` blocks for light and dark schemes, including dynamic type-friendly layout. Do not add any client-facing conversation list, template gallery, community feed, score, streak, or multiple primary actions.</action>
  <verify>
    <automated>rg -q "ChatPreviewScreen" apps/ios/FISH/ContentView.swift && rg -q "struct ChatMessageView" apps/ios/FISH/Chat/ChatModels.swift && rg -q "accessibilityLabel\\(\"Send message\"\\)" apps/ios/FISH/Chat/ChatInputBar.swift && if rg -n "Color\\(|UIColor\\(|#[0-9A-Fa-f]{6}|\\.font\\(\\.system" apps/ios/FISH/Chat apps/ios/FISH/ContentView.swift; then exit 1; fi</automated>
  </verify>
  <done>ContentView renders the chat preview through the theme; chat models and reusable components exist; the preview has one assigned conversation and one primary send action; chat files contain no raw color/system-font styling.</done>
</task>

<task type="auto">
  <name>Task 3: Clean iOS monorepo state and prove the build</name>
  <files>apps/ios/.git, apps/ios/.DS_Store, apps/ios/FISH/.DS_Store, apps/ios/FISH/Assets.xcassets/.DS_Store, apps/ios/FISH/FISH.xcodeproj, apps/ios/FISH.xcodeproj/project.pbxproj</files>
  <action>Delete the nested repository metadata at `apps/ios/.git`; do not preserve it as a submodule. Remove `.DS_Store` files under `apps/ios`. Delete the stray nested `apps/ios/FISH/FISH.xcodeproj` directory because it has no `project.pbxproj` and causes `xcodebuild` to warn about a missing nested project container. Keep the real project at `apps/ios/FISH.xcodeproj`. Because this starter project uses a file-system-synchronized root group for `apps/ios/FISH`, prefer adding Swift/source/resource files under that folder rather than manually adding every new Swift file to PBX build phases. Only edit `project.pbxproj` if the build proves a resource is not included; if it is edited, keep the target named `FISH` and the bundle id `space.fishhub.FISH` unchanged.</action>
  <verify>
    <automated>test -z "$(find apps/ios -name .git -prune -print)" && test ! -d apps/ios/FISH/FISH.xcodeproj && xcodebuild -list -project apps/ios/FISH.xcodeproj 2>&1 | tee /tmp/fish-ios-xcodebuild-list.log && if rg -q "missing its project\\.pbxproj|Failed to load container" /tmp/fish-ios-xcodebuild-list.log; then exit 1; fi && xcodebuild -project apps/ios/FISH.xcodeproj -scheme FISH -destination 'platform=iOS Simulator,name=iPhone 17' build</automated>
  </verify>
  <done>No nested git repository remains under apps/ios; the broken nested Xcode project warning is gone; the FISH iOS scheme builds successfully from the monorepo root.</done>
</task>

## Threat Model

| Boundary | Description |
|----------|-------------|
| Local SwiftUI preview only | No network calls, auth, Supabase, persistence, or untrusted data in this quick task. |
| Bundle resources | Existing local TTF files are copied from Android into iOS and registered locally. |

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-ios-01 | Tampering | Package/dependency supply chain | mitigate | No package installs, SPM packages, CocoaPods, npm, or pnpm dependency changes are allowed. |
| T-quick-ios-02 | Information Disclosure | Chat preview data | accept | Preview data is static sample content and not wired to Supabase or user accounts. |
| T-quick-ios-03 | Spoofing | Avatar/participant display | accept | Presentational-only preview; authenticated identity display is outside this UI-infrastructure task. |

## Verification

Run the Task 1-3 automated checks. Final required command:

```bash
xcodebuild -project apps/ios/FISH.xcodeproj -scheme FISH -destination 'platform=iOS Simulator,name=iPhone 17' build
```

Also confirm these checks stay true:

```bash
test -z "$(find apps/ios -name .git -prune -print)"
test ! -d apps/ios/FISH/FISH.xcodeproj
```

## Success Criteria

- `apps/ios` is normal monorepo content with no nested `.git`.
- `xcodebuild -list -project apps/ios/FISH.xcodeproj` no longer reports the missing nested `FISH.xcodeproj/project.pbxproj` warning.
- `FISHApp` registers custom fonts and renders `ContentView`.
- `ContentView` renders `ChatPreviewScreen` inside `FISHTheme`.
- iOS design-system files provide tokenized colors, typography, spacing, radius, size, button, text field, card, and progress primitives.
- Chat components use those primitives/tokens and preserve FISH rules: one primary action, assigned-not-browsed, calm copy, large controls, no raw one-off styles.
- The iOS FISH scheme builds successfully.

## Output

Create `.planning/quick/260705-amu-bootstrap-the-ios-project-and-configure-/260705-amu-SUMMARY.md` with `status: complete` when execution finishes.
