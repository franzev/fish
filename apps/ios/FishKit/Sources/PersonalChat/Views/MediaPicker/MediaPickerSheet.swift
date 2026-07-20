import ChatData
import DesignSystem
import SwiftUI
import UIComponents

/// One consistent surface for every lightweight expressive medium in the chat
/// composer — emoji, GIFs, and stickers keep their own browsing behavior while
/// the sheet, tabs, search treatment, and dismissal stay the same. Selecting
/// anything closes the sheet, exactly like the web popover.
public struct MediaPickerSheet: View {
    private let defaultTab: MediaPickerTab
    private let gifDisabled: Bool
    private let stickerDisabled: Bool
    private let onSelectEmoji: (String) -> Void
    private let onSelectGif: (ChatGif, String) -> Void
    private let onSelectSticker: (ChatSticker) -> Void

    @State private var selection: MediaPickerTab
    @State private var gifModel: GifSearchModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.fishReduceMotion) private var reduceMotion

    public init(
        gifProvider: any GifProviding,
        defaultTab: MediaPickerTab = .emoji,
        gifDisabled: Bool = false,
        stickerDisabled: Bool = false,
        onSelectEmoji: @escaping (String) -> Void,
        onSelectGif: @escaping (ChatGif, _ searchQuery: String) -> Void,
        onSelectSticker: @escaping (ChatSticker) -> Void
    ) {
        self.defaultTab = defaultTab
        self.gifDisabled = gifDisabled
        self.stickerDisabled = stickerDisabled
        self.onSelectEmoji = onSelectEmoji
        self.onSelectGif = onSelectGif
        self.onSelectSticker = onSelectSticker
        self._selection = State(initialValue: defaultTab)
        self._gifModel = State(initialValue: GifSearchModel(provider: gifProvider))
    }

    public var body: some View {
        @Bindable var gifModel = gifModel
        VStack(spacing: 0) {
            header
            MediaPickerTabs(
                selection: $selection,
                gifDisabled: gifDisabled,
                stickerDisabled: stickerDisabled
            )
            switch selection {
            case .emoji:
                EmojiPanel { emoji in
                    onSelectEmoji(emoji)
                    dismiss()
                }
            case .gif:
                GifPanel(
                    state: gifModel.panelState,
                    query: $gifModel.query,
                    onStart: { gifModel.start() },
                    onSelect: { gif in
                        onSelectGif(gif, gifModel.panelState.trimmedQuery)
                        dismiss()
                    },
                    onGifAppeared: { gifModel.loadMoreIfNeeded(current: $0) },
                    onToggleAnimations: { gifModel.toggleAnimations(systemDefault: reduceMotion) },
                    onRetry: { gifModel.retry() }
                )
            case .sticker:
                StickerPanel { sticker in
                    onSelectSticker(sticker)
                    dismiss()
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Palette.bg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .accessibilityLabel("Choose emoji, GIF, or sticker")
    }

    private var header: some View {
        HStack(spacing: Spacing.xs) {
            Text(MediaAccessibility.pickerTitle)
                .textStyle(.label)
                .foregroundStyle(Palette.foreground)
                .padding(.leading, Spacing.xs)
            Spacer(minLength: 0)
            IconButton(
                .close,
                accessibilityLabel: MediaAccessibility.closeLabel
            ) {
                dismiss()
            }
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.top, Spacing.xs)
        .overlay(alignment: .bottom) {
            Palette.divider.frame(height: 1)
        }
    }
}
