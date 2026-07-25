import AVKit
import DesignSystem
import SwiftUI
import UIComponents

public struct MessageVideoPlayer: View {
    private let attachment: MessageAttachmentUiModel
    private let downloader: AttachmentFileDownloader

    @State private var player: AVPlayer?
    @State private var videoUrl: URL?
    @State private var isPreparing = false
    @State private var failed = false

    public init(
        attachment: MessageAttachmentUiModel,
        downloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.attachment = attachment
        self.downloader = downloader
    }

    public var body: some View {
        if failed {
            MessageFileCard(attachment: attachment, downloader: downloader)
        } else if let player {
            VideoPlayer(player: player)
                .aspectRatio(videoAspectRatio, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: Radius.chat, style: .continuous))
                .accessibilityLabel("\(attachment.originalName), video")
                .onDisappear { stopPlayback() }
        } else {
            Button {
                Task { await prepare() }
            } label: {
                ZStack {
                    Palette.surface2
                    VStack(spacing: Spacing.xs) {
                        if isPreparing {
                            ProgressView()
                        } else {
                            Icon.video.image
                                .glyphFrame()
                            Text("Play video")
                                .textStyle(.label)
                        }
                    }
                    .foregroundStyle(Palette.body)
                }
                .aspectRatio(videoAspectRatio, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: Radius.chat, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(isPreparing || !attachment.isOptimistic && attachment.displayUrl == nil)
            .accessibilityLabel("\(attachment.originalName), video")
            .accessibilityHint(isPreparing ? "Preparing video" : "Play video")
        }
    }

    private var videoAspectRatio: CGFloat {
        let aspect = attachment.aspectRatio
        return min(max(CGFloat(aspect), 0.6), 1.8)
    }

    private func prepare() async {
        guard !isPreparing else { return }
        isPreparing = true
        defer { isPreparing = false }
        do {
            let url = try await downloader.download(attachment)
            let nextPlayer = AVPlayer(url: url)
            nextPlayer.actionAtItemEnd = .pause
            videoUrl = url
            player = nextPlayer
        } catch {
            failed = true
        }
    }

    private func stopPlayback() {
        player?.pause()
        if let videoUrl, videoUrl != attachment.localPreviewUrl {
            try? FileManager.default.removeItem(at: videoUrl)
        }
        player = nil
        videoUrl = nil
    }
}
