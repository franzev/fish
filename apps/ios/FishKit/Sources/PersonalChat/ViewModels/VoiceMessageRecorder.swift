import AVFoundation
import ChatData
import Foundation
import Observation

/// Owns one short, foreground-only voice recording. The recorder deliberately
/// hands back the same candidate type used by the existing attachment pipeline.
@MainActor @Observable
public final class VoiceMessageRecorder {
    public private(set) var isRecording = false
    public private(set) var elapsed: TimeInterval = 0
    public private(set) var notice: String?

    public static let maxDuration: TimeInterval = 5 * 60

    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?
    private var startedAt: Date?
    private var timerTask: Task<Void, Never>?

    public init() {}

    public func start() async {
        guard !isRecording else { return }
        notice = nil
        guard await AVAudioApplication.requestRecordPermission() else {
            notice = "Microphone access is off. Allow it in Settings to record a voice message."
            return
        }
        guard !Task.isCancelled else { return }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .spokenAudio, options: [])
            try session.setActive(true)

            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("fish-voice-\(UUID().uuidString)")
                .appendingPathExtension("m4a")
            let recorder = try AVAudioRecorder(
                url: url,
                settings: [
                    AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                    AVSampleRateKey: 44_100,
                    AVNumberOfChannelsKey: 1,
                    AVEncoderBitRateKey: 64_000,
                    AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
                ]
            )
            recorder.prepareToRecord()
            guard recorder.record() else {
                throw RecordingFailure.startFailed
            }
            self.recorder = recorder
            recordingURL = url
            startedAt = Date()
            elapsed = 0
            isRecording = true
            startTimer()
        } catch {
            cleanupRecordingFile()
            deactivateAudioSession()
            notice = "Recording didn't start. Please try again."
        }
    }

    public func finish() -> AttachmentCandidate? {
        guard isRecording, let recorder, let url = recordingURL else { return nil }
        recorder.stop()
        stopTimer()
        isRecording = false
        self.recorder = nil
        recordingURL = nil
        startedAt = nil
        defer {
            try? FileManager.default.removeItem(at: url)
            deactivateAudioSession()
        }
        guard let data = try? Data(contentsOf: url), !data.isEmpty else {
            notice = "That recording was empty. Please try again."
            return nil
        }
        return AttachmentCandidate(
            data: data,
            originalName: "Voice message.m4a",
            sourceMimeType: "audio/mp4"
        )
    }

    public func cancel() {
        recorder?.stop()
        stopTimer()
        isRecording = false
        recorder = nil
        recordingURL = nil
        startedAt = nil
        cleanupRecordingFile()
        deactivateAudioSession()
        notice = nil
    }

    public func applicationDidEnterBackground() {
        cancel()
    }

    private func startTimer() {
        stopTimer()
        timerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(100))
                guard !Task.isCancelled, let self else { return }
                guard let startedAt = self.startedAt, self.isRecording else { return }
                let current = Date().timeIntervalSince(startedAt)
                if current >= Self.maxDuration {
                    self.elapsed = Self.maxDuration
                    self.recorder?.stop()
                    self.stopTimer()
                    return
                }
                self.elapsed = current
            }
        }
    }

    private func stopTimer() {
        timerTask?.cancel()
        timerTask = nil
    }

    private func cleanupRecordingFile() {
        if let recordingURL {
            try? FileManager.default.removeItem(at: recordingURL)
        }
        recordingURL = nil
    }

    private func deactivateAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

private enum RecordingFailure: Error {
    case startFailed
}
