import Foundation

/// Whether to render the two-pane list+detail split on regular-width iPad
/// (see `App/Sources/ChatSplitLayout.swift`), mirroring Android's
/// `ChatAdaptiveLayout` gate (`maxWidth >= twoPaneBreakpoint &&
/// model.conversations.size > 1`).
///
/// iOS expresses "wide enough" with `@Environment(\.horizontalSizeClass) ==
/// .regular` rather than a raw width threshold — the platform-idiomatic
/// stand-in for Android's `twoPaneBreakpoint` — but the second half of the
/// gate is identical on both platforms: a rail showing a single conversation
/// looks sparse for zero navigational benefit, so don't split unless there's
/// actually a choice to show.
public func shouldShowChatSplitLayout(isRegularWidth: Bool, conversationCount: Int) -> Bool {
    isRegularWidth && conversationCount > 1
}
