import AVFoundation
import DesignSystem
import Foundation
import Observation
import SwiftUI
import UIComponents

@MainActor @Observable
private final class VoicePlaybackModel {
    private let attachment: MessageAttachmentUiModel
    private let downloader: AttachmentFileDownloader
    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?

    private(set) var isPlaying = false
    private(set) var isLoading = false
    private(set) var progress: Double = 0
    private(set) var duration: TimeInterval = 0
    private(set) var notice: String?
    private(set) var speed: VoicePlaybackSpeed

    init(attachment: MessageAttachmentUiModel, downloader: AttachmentFileDownloader) {
        self.attachment = attachment
        self.downloader = downloader
        speed = .persisted
    }

    func setSpeed(_ speed: VoicePlaybackSpeed) {
        self.speed = speed
        speed.persist()
        if isPlaying {
            player?.rate = speed.rawValue
        }
    }

    func toggle() async {
        guard !isLoading else { return }
        notice = nil
        if let player {
            if isPlaying {
                player.pause()
                isPlaying = false
            } else {
                activatePlaybackSession()
                player.playImmediately(atRate: speed.rawValue)
                isPlaying = true
            }
            return
        }

        isLoading = true
        defer { isLoading = false }
        do {
            let url = try await downloader.download(attachment)
            guard !Task.isCancelled else { return }
            let item = AVPlayerItem(url: url)
            let player = AVPlayer(playerItem: item)
            self.player = player
            installObservers(for: player, item: item)
            activatePlaybackSession()
            player.playImmediately(atRate: speed.rawValue)
            isPlaying = true
        } catch {
            notice = "This voice message couldn't be played. Try again."
        }
    }

    func stop() {
        player?.pause()
        isPlaying = false
        if let timeObserver, let player {
            player.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil
        player = nil
    }

    private func installObservers(for player: AVPlayer, item: AVPlayerItem) {
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.2, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            guard let self else { return }
            Task { @MainActor in
                self.updateProgress(time: time, item: item)
            }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.didFinish()
            }
        }
    }

    private func updateProgress(time: CMTime, item: AVPlayerItem) {
        let current = time.seconds.isFinite ? max(0, time.seconds) : 0
        let total = item.duration.seconds.isFinite ? max(0, item.duration.seconds) : 0
        duration = total
        progress = total > 0 ? min(1, current / total) : 0
    }

    private func didFinish() {
        player?.pause()
        isPlaying = false
        progress = 0
        player?.seek(to: .zero)
    }

    private func activatePlaybackSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.allowBluetooth])
        try? session.setActive(true)
    }
}

/// Inline playback for the shared audio/mp4 voice-message attachment format.
public struct MessageVoicePlayer: View {
    private let attachment: MessageAttachmentUiModel
    @State private var playback: VoicePlaybackModel
    @Environment(\.scenePhase) private var scenePhase

    public init(
        attachment: MessageAttachmentUiModel,
        downloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.attachment = attachment
        _playback = State(initialValue: VoicePlaybackModel(
            attachment: attachment,
            downloader: downloader
        ))
    }

    public var body: some View {
        HStack(spacing: Spacing.xs) {
            Button {
                Task { await playback.toggle() }
            } label: {
                HStack(spacing: Spacing.xs) {
                    if playback.isLoading {
                        ProgressView()
                            .frame(width: Metrics.iconGlyph, height: Metrics.iconGlyph)
                    } else {
                        (playback.isPlaying ? Icon.pause : Icon.play).image
                            .glyphFrame()
                    }
                    VStack(alignment: .leading, spacing: Spacing.threeXs) {
                        Text("Voice message")
                            .textStyle(.label)
                            .foregroundStyle(Palette.foreground)
                        HStack(spacing: Spacing.twoXs) {
                            Text(Self.durationLabel(playback.progress * playback.duration))
                            Text("/")
                            Text(Self.durationLabel(playback.duration))
                        }
                        .textStyle(.caption)
                        .foregroundStyle(playback.notice == nil ? Palette.muted : Palette.notice)
                        ProgressView(value: playback.progress)
                            .tint(Palette.body)
                    }
                    Spacer(minLength: Spacing.xs)
                }
                .frame(maxWidth: .infinity, minHeight: Metrics.targetTouch, alignment: .leading)
            }
            .buttonStyle(.plain)
            .disabled(playback.isLoading)
            .accessibilityLabel("Voice message")
            .accessibilityValue(
                playback.notice ?? "\(Self.durationLabel(playback.duration)), \(playback.speed.accessibilityLabel)"
            )
            .accessibilityHint(playback.notice == nil ? "Play voice message" : "Try again")

            Menu {
                ForEach(VoicePlaybackSpeed.allCases) { speed in
                    Button {
                        playback.setSpeed(speed)
                    } label: {
                        if speed == playback.speed {
                            Label(speed.label, systemImage: "checkmark")
                        } else {
                            Text(speed.label)
                        }
                    }
                }
            } label: {
                Text(playback.speed.label)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.body)
                    .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Playback speed")
            .accessibilityValue(playback.speed.accessibilityLabel)
        }
        .padding(Spacing.sm)
        .frame(maxWidth: Metrics.attachmentSingleMaxWidth, minHeight: Metrics.targetTouch)
        .background(
            Palette.surface2,
            in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
        )
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { playback.stop() }
        }
        .onDisappear { playback.stop() }
    }

    private static func durationLabel(_ duration: TimeInterval) -> String {
        let totalSeconds = max(0, Int(duration.rounded(.down)))
        return String(format: "%d:%02d", totalSeconds / 60, totalSeconds % 60)
    }
}
