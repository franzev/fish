import ChatData
import SwiftUI
import Testing
import TestSupport
@testable import PersonalChat

/// Panels render value states, so every picker state snapshots offline:
/// stickers come from the bundle, GIF posters stay as their loading fill
/// (fixture URLs never resolve during capture), and animations are paused.
@MainActor struct MediaPickerSnapshotTests {
    @Test func pickerSheetOnEachTab() {
        let sheet = MediaPickerSheet(
            gifProvider: FixtureGifProvider(),
            onSelectEmoji: { _ in },
            onSelectGif: { _, _ in },
            onSelectSticker: { _ in }
        )
        assertThemedSnapshots(of: sheet, named: "picker-emoji")
        assertAccessibilitySnapshots(of: sheet, named: "picker-emoji")

        let stickers = MediaPickerSheet(
            gifProvider: FixtureGifProvider(),
            defaultTab: .sticker,
            onSelectEmoji: { _ in },
            onSelectGif: { _, _ in },
            onSelectSticker: { _ in }
        )
        assertThemedSnapshots(of: stickers, named: "picker-stickers")
        assertAccessibilitySnapshots(of: stickers, named: "picker-stickers")
    }

    @Test func emojiSearchStates() {
        assertThemedSnapshots(
            of: EmojiPanel(initialQuery: "grinning") { _ in },
            named: "emoji-search-results"
        )
        assertThemedSnapshots(
            of: EmojiPanel(initialQuery: "zzzz") { _ in },
            named: "emoji-search-empty"
        )
    }

    @Test func reactionPickerSnapshots() {
        let picker = ReactionPicker { _ in }
        assertThemedSnapshots(of: picker, named: "reaction-picker")
        assertAccessibilitySnapshots(of: picker, named: "reaction-picker")
    }

    @Test func stickerSearchStates() {
        assertThemedSnapshots(
            of: StickerPanel(initialQuery: "otter") { _ in },
            named: "sticker-search-results"
        )
        assertThemedSnapshots(
            of: StickerPanel(initialQuery: "volcano") { _ in },
            named: "sticker-search-empty"
        )
    }

    @Test func gifPanelStates() {
        assertThemedSnapshots(
            of: gifPanel(GifPanelState(status: .loading)),
            named: "gif-loading"
        )
        assertThemedSnapshots(
            of: gifPanel(GifPanelState(
                status: .ready,
                gifs: ChatMediaFixtures.gifs,
                trimmedQuery: "otter",
                animationPreference: true
            )),
            named: "gif-ready"
        )
        assertAccessibilitySnapshots(
            of: gifPanel(GifPanelState(
                status: .ready,
                gifs: ChatMediaFixtures.gifs,
                trimmedQuery: "otter",
                animationPreference: true
            )),
            named: "gif-ready"
        )
        assertThemedSnapshots(
            of: gifPanel(GifPanelState(
                status: .ready,
                gifs: ChatMediaFixtures.gifs,
                isLoadingMore: true,
                animationPreference: true
            )),
            named: "gif-loading-more"
        )
        assertThemedSnapshots(
            of: gifPanel(GifPanelState(status: .empty, trimmedQuery: "xyzzy")),
            named: "gif-empty"
        )
        assertThemedSnapshots(
            of: gifPanel(GifPanelState(status: .notice)),
            named: "gif-notice"
        )
        assertThemedSnapshots(
            of: gifPanel(GifPanelState(status: .notice, providerIsAvailable: false)),
            named: "gif-notice-unavailable"
        )
    }

    private func gifPanel(_ state: GifPanelState) -> some View {
        GifPanel(
            state: state,
            query: .constant(state.trimmedQuery),
            onStart: {},
            onSelect: { _ in },
            onGifAppeared: { _ in },
            onToggleAnimations: {},
            onRetry: {}
        )
    }
}
