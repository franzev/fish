import ChatData
import DesignSystem
import SwiftUI
import UIComponents

/// A press-and-hold recording affordance with a calm, reversible cancel path.
public struct VoiceRecordingControl: View {
    private let recorder: VoiceMessageRecorder
    private let onRecord: (AttachmentCandidate) -> Void

    @Environment(\.layoutDirection) private var layoutDirection
    @Environment(\.scenePhase) private var scenePhase
    @State private var isHolding = false
    @State private var didCancel = false
    @State private var startTask: Task<Void, Never>?

    public init(
        recorder: VoiceMessageRecorder,
        onRecord: @escaping (AttachmentCandidate) -> Void
    ) {
        self.recorder = recorder
        self.onRecord = onRecord
    }

    public var body: some View {
        Group {
            if recorder.isRecording {
                recordingIndicator
            } else {
                recordButton
            }
        }
        .task(id: recorder.isRecording) {
            guard !recorder.isRecording else { return }
            if !isHolding { didCancel = false }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase != .active else { return }
            startTask?.cancel()
            startTask = nil
            isHolding = false
            didCancel = false
            recorder.applicationDidEnterBackground()
        }
    }

    private var recordButton: some View {
        Button(action: {}) {
            Icon.microphone.image
                .glyphFrame()
                .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
                .foregroundStyle(Palette.body)
                .background(Palette.surface2)
                .clipShape(RoundedRectangle(
                    cornerRadius: Radius.control,
                    style: .continuous
                ))
        }
        .buttonStyle(.plain)
        .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        .gesture(holdGesture)
        .accessibilityLabel("Record voice message")
        .accessibilityHint("Press and hold, then release to send. Slide away to cancel.")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: "Start recording") { begin() }
    }

    private var recordingIndicator: some View {
        HStack(spacing: Spacing.xs) {
            Circle()
                .fill(Palette.notice)
                .frame(width: Spacing.xs, height: Spacing.xs)
                .accessibilityHidden(true)
            Text("Recording \(Self.durationLabel(recorder.elapsed))")
                .textStyle(.label)
                .foregroundStyle(Palette.foreground)
            Spacer(minLength: Spacing.xs)
            Text(didCancel ? "Release to cancel" : "Slide away to cancel")
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
        }
        .frame(maxWidth: .infinity, minHeight: Metrics.targetTouch, alignment: .leading)
        .contentShape(Rectangle())
        .gesture(holdGesture)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Recording voice message")
        .accessibilityValue(Self.durationLabel(recorder.elapsed))
        .accessibilityHint("Release to send the recording.")
        .accessibilityAction(named: "Send recording") { finish() }
        .accessibilityAction(named: "Cancel recording") { cancel() }
    }

    private var holdGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard !didCancel else { return }
                if !isHolding {
                    isHolding = true
                    begin()
                }
                if Self.isCancelTranslation(
                    value.translation.width,
                    layoutDirection: layoutDirection
                ) {
                    didCancel = true
                    recorder.cancel()
                    startTask?.cancel()
                }
            }
            .onEnded { _ in
                defer { isHolding = false }
                if didCancel {
                    cancel()
                } else {
                    finish()
                }
            }
    }

    private func begin() {
        guard !recorder.isRecording, startTask == nil else { return }
        didCancel = false
        startTask = Task { @MainActor in
            defer { startTask = nil }
            await recorder.start()
            if Task.isCancelled || !isHolding { recorder.cancel() }
        }
    }

    private func finish() {
        startTask?.cancel()
        startTask = nil
        guard !didCancel, let candidate = recorder.finish() else {
            recorder.cancel()
            return
        }
        onRecord(candidate)
    }

    private func cancel() {
        startTask?.cancel()
        startTask = nil
        recorder.cancel()
        didCancel = false
    }

    nonisolated static func isCancelTranslation(
        _ translation: CGFloat,
        layoutDirection: LayoutDirection
    ) -> Bool {
        switch layoutDirection {
        case .leftToRight: translation <= -Metrics.controlPrimary
        case .rightToLeft: translation >= Metrics.controlPrimary
        @unknown default: translation <= -Metrics.controlPrimary
        }
    }

    nonisolated static func durationLabel(_ duration: TimeInterval) -> String {
        let totalSeconds = max(0, Int(duration.rounded(.down)))
        return String(format: "%d:%02d", totalSeconds / 60, totalSeconds % 60)
    }
}
