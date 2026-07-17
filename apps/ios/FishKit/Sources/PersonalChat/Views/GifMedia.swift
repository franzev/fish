import AVFoundation
import ChatData
import DesignSystem
import SwiftUI

/// Poster-first GIF rendering — the "GIF" is an MP4 rendition, so playback is
/// a muted, looping video layer created on appear and torn down on disappear.
/// Under Reduce Motion (or the picker's pause-all) only the poster shows until
/// the user explicitly asks for playback; a failed poster degrades to calm
/// text instead of a broken image.
public struct GifMedia: View {
    private let gif: ChatGif
    private let preview: Bool
    private let allowPlaybackControl: Bool
    private let fixedAspect: Bool
    private let externallyPaused: Bool?
    private let mediaAccessibilityHidden: Bool

    @State private var posterFailed = false
    @State private var playRequested: Bool?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// - Parameters:
    ///   - preview: grid-tile mode — plays the tiny rendition and fills a
    ///     fixed-aspect cell.
    ///   - allowPlaybackControl: shows the per-GIF play/pause control
    ///     (transcript and composer preview).
    ///   - fixedAspect: locks the shared 4:3 tile ratio instead of the GIF's
    ///     intrinsic aspect.
    ///   - externallyPaused: the picker's pause-all state; `nil` outside the
    ///     picker.
    ///   - mediaAccessibilityHidden: hides the media image from assistive tech
    ///     when an enclosing element already describes it; the playback
    ///     control stays focusable.
    public init(
        gif: ChatGif,
        preview: Bool = false,
        allowPlaybackControl: Bool = false,
        fixedAspect: Bool = false,
        externallyPaused: Bool? = nil,
        mediaAccessibilityHidden: Bool = false
    ) {
        self.gif = gif
        self.preview = preview
        self.allowPlaybackControl = allowPlaybackControl
        self.fixedAspect = fixedAspect
        self.externallyPaused = externallyPaused
        self.mediaAccessibilityHidden = mediaAccessibilityHidden
    }

    private var isPlaying: Bool {
        guard !posterFailed else { return false }
        if let playRequested { return playRequested }
        if let externallyPaused { return !externallyPaused }
        return !reduceMotion
    }

    private var aspectRatio: CGFloat {
        fixedAspect ? AspectRatio.gifTile : CGFloat(gif.width) / CGFloat(max(gif.height, 1))
    }

    public var body: some View {
        ZStack {
            // Stable fill behind poster loading and video buffering.
            Palette.surface2
            if posterFailed {
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .fill(Palette.surface2)
                Text("GIF no longer available")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                    .multilineTextAlignment(.center)
                    .padding(Spacing.xs)
            } else {
                // Poster stays beneath the video layer so buffering shows the
                // still frame instead of a blank fill.
                poster
                if isPlaying {
                    LoopingVideo(
                        url: preview ? gif.previewUrl : gif.mediaUrl,
                        fillsBounds: fixedAspect
                    )
                }
            }
        }
        .aspectRatio(aspectRatio, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        .accessibilityLabel(gif.description)
        .accessibilityHidden(mediaAccessibilityHidden)
        .overlay(alignment: .bottomTrailing) {
            if allowPlaybackControl && !posterFailed {
                playbackControl
            }
        }
    }

    /// File posters (fixtures, previews) load synchronously so rendering is
    /// deterministic; remote posters stream in over the surface fill.
    @ViewBuilder private var poster: some View {
        if gif.posterUrl.isFileURL {
            if let image = UIImage(contentsOfFile: gif.posterUrl.path()) {
                posterImage(Image(uiImage: image))
            } else {
                Color.clear.onAppear { posterFailed = true }
            }
        } else {
            AsyncImage(url: gif.posterUrl) { phase in
                switch phase {
                case .success(let image):
                    posterImage(image)
                case .failure:
                    Color.clear.onAppear { posterFailed = true }
                case .empty:
                    Palette.surface2
                @unknown default:
                    Palette.surface2
                }
            }
        }
    }

    private func posterImage(_ image: Image) -> some View {
        image.resizable().aspectRatio(contentMode: fixedAspect ? .fill : .fit)
    }

    private var playbackControl: some View {
        Button {
            playRequested = !isPlaying
        } label: {
            (isPlaying ? Icon.pause : Icon.play).image
                .glyphFrame()
                .foregroundStyle(Palette.foreground)
                .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
                .background(Palette.surface2, in: Circle())
        }
        .padding(Spacing.twoXs)
        .accessibilityLabel(
            MediaAccessibility.gifPlaybackLabel(paused: !isPlaying, description: gif.description)
        )
    }
}

/// Muted, looping `AVPlayerLayer` host. The player exists only while the view
/// is in the hierarchy — SwiftUI dismantling tears it down, so off-screen
/// tiles hold no players.
private struct LoopingVideo: UIViewRepresentable {
    let url: URL
    let fillsBounds: Bool

    func makeUIView(context: Context) -> PlayerView {
        let view = PlayerView()
        view.configure(url: url, fillsBounds: fillsBounds)
        return view
    }

    func updateUIView(_ view: PlayerView, context: Context) {
        view.configure(url: url, fillsBounds: fillsBounds)
    }

    static func dismantleUIView(_ view: PlayerView, coordinator: ()) {
        view.tearDown()
    }

    final class PlayerView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }

        private var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        private var looper: AVPlayerLooper?
        private var currentUrl: URL?

        func configure(url: URL, fillsBounds: Bool) {
            playerLayer.videoGravity = fillsBounds ? .resizeAspectFill : .resizeAspect
            guard url != currentUrl else { return }
            currentUrl = url
            let player = AVQueuePlayer()
            player.isMuted = true
            player.preventsDisplaySleepDuringVideoPlayback = false
            looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
            playerLayer.player = player
            player.play()
        }

        func tearDown() {
            playerLayer.player?.pause()
            playerLayer.player = nil
            looper = nil
            currentUrl = nil
        }
    }
}
