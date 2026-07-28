import Foundation

/// Whether the conversation rail shows alongside the main content on
/// `ChatSplitLayout` (see `App/Sources/ChatSplitLayout.swift`), mirroring
/// Android's `ChatAdaptiveLayout` gate (`maxWidth >= twoPaneBreakpoint &&
/// model.conversations.size > 1`).
///
/// iOS expresses "wide enough" with `@Environment(\.horizontalSizeClass) ==
/// .regular` rather than a raw width threshold — the platform-idiomatic
/// stand-in for Android's `twoPaneBreakpoint` — but the second half of the
/// gate is identical on both platforms: a rail showing a single conversation
/// looks sparse for zero navigational benefit, so don't show it unless
/// there's actually a choice to make.
///
/// `ChatSplitLayout` only ever toggles the rail's *presence as a sibling*,
/// never the structural position of the content next to it — so flipping
/// this value mid-conversation (e.g. a realtime directory update dropping
/// the count to one) never resets the open conversation's local state. See
/// that type's "View identity" doc section for the full reasoning.
public func shouldShowChatSplitLayout(isRegularWidth: Bool, conversationCount: Int) -> Bool {
    isRegularWidth && conversationCount > 1
}
