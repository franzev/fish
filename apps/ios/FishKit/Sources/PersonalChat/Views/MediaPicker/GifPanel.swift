import ChatData
import DesignSystem
import SwiftUI

/// KLIPY browsing: trending on open, debounced search, cursor pagination via
/// the grid's trailing rows, one pause/play toggle for every preview, calm
/// empty/failure states, and always-visible attribution. The panel renders a
/// `GifPanelState` value; all async state lives in `GifSearchModel`.
struct GifPanel: View {
    let state: GifPanelState
    @Binding var query: String
    let onStart: () -> Void
    let onSelect: (ChatGif) -> Void
    let onGifAppeared: (ChatGif) -> Void
    let onToggleAnimations: () -> Void
    let onRetry: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var animationsPaused: Bool {
        state.animationPreference ?? reduceMotion
    }

    var body: some View {
        VStack(spacing: 0) {
            MediaPickerSearchField(
                label: "Search GIFs",
                prompt: "Search KLIPY",
                text: $query
            )
            ScrollView {
                content
                    .padding(.horizontal, Spacing.xs)
                    .padding(.bottom, Spacing.xs)
            }
            attribution
        }
        .task { onStart() }
    }

    @ViewBuilder private var content: some View {
        switch state.status {
        case .loading:
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Finding GIFs…")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                loadingGrid
            }
        case .ready:
            VStack(alignment: .leading, spacing: Spacing.xs) {
                readyHeader
                gifGrid
                if state.isLoadingMore {
                    Text("Finding more GIFs…")
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.twoXs)
                }
            }
        case .empty:
            Text("No GIFs found. Try a simpler phrase.")
                .textStyle(.ui)
                .foregroundStyle(Palette.muted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.lg)
        case .notice:
            notice
        }
    }

    private var readyHeader: some View {
        HStack(alignment: .center, spacing: Spacing.xs) {
            Text(state.resultLabel)
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
            Spacer(minLength: 0)
            Button {
                onToggleAnimations()
            } label: {
                Text(animationsPaused ? "Play GIF animations" : "Pause GIF animations")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                    .padding(.horizontal, Spacing.xs)
                    .frame(minHeight: Metrics.targetTouch)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private var gifGrid: some View {
        LazyVGrid(
            columns: Array(
                repeating: GridItem(.flexible(), spacing: Spacing.twoXs),
                count: 2
            ),
            spacing: Spacing.twoXs
        ) {
            ForEach(state.gifs) { gif in
                Button {
                    onSelect(gif)
                } label: {
                    GifMedia(
                        gif: gif,
                        preview: true,
                        fixedAspect: true,
                        externallyPaused: animationsPaused
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(MediaAccessibility.gifTileLabel(gif))
                .onAppear { onGifAppeared(gif) }
            }
        }
    }

    private var loadingGrid: some View {
        LazyVGrid(
            columns: Array(
                repeating: GridItem(.flexible(), spacing: Spacing.twoXs),
                count: 2
            ),
            spacing: Spacing.twoXs
        ) {
            ForEach(0..<6, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .fill(Palette.surface2)
                    .aspectRatio(AspectRatio.gifTile, contentMode: .fit)
            }
        }
        .accessibilityHidden(true)
    }

    private var notice: some View {
        VStack(spacing: Spacing.sm) {
            Text("GIF search is taking a break. Your message is still here.")
                .textStyle(.ui)
                .foregroundStyle(Palette.notice)
                .multilineTextAlignment(.center)
            if state.providerIsAvailable {
                Button {
                    onRetry()
                } label: {
                    Text("Try again")
                        .textStyle(.ui)
                        .foregroundStyle(Palette.body)
                        .underline()
                        .padding(.horizontal, Spacing.sm)
                        .frame(minHeight: Metrics.targetTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.lg)
    }

    private var attribution: some View {
        VStack(spacing: 0) {
            Palette.divider.frame(height: 1)
            Link(destination: URL(string: "https://klipy.com")!) {
                Text("Powered by KLIPY")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                    .padding(.horizontal, Spacing.sm)
                    .frame(minHeight: Metrics.targetTouch)
                    .contentShape(Rectangle())
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .background(Palette.surface)
    }
}
