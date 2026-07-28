import Foundation

/// Durable, bounded record of attachment PUTs that finished with nobody
/// listening — e.g. a background transfer that completed after this
/// process had already terminated, before `restoreFromOutbox` resubscribed
/// to it. `BackgroundAttachmentUploadCoordinator` consults this before
/// issuing a PUT so a relaunch retry can resolve immediately instead of
/// reissuing a PUT that the signed URL's `x-upsert: false` would then
/// reject as a conflict against the object that already exists there.
///
/// Kept as a small file (matching `FileChatNotificationReplyStore`'s
/// pattern) rather than in-memory state: the process termination this
/// bridges is exactly what an in-memory cache in the coordinator singleton
/// would be wiped by. Entries expire after `ttl` so this can't grow
/// unboundedly — the signed upload URL it bridges is documented to live
/// about two hours (`chat-image-command`'s
/// `documentedUploadCredentialSeconds`), so the default keeps a wide
/// margin over that without keeping records forever.
public final class CompletedAttachmentUploadMarks: @unchecked Sendable {
    public static let shared = CompletedAttachmentUploadMarks()

    private struct Payload: Codable {
        var completedAt: [String: Date] = [:]
    }

    private let lock = NSLock()
    private let fileURL: URL
    private let ttl: TimeInterval

    public init(rootURL: URL? = nil, ttl: TimeInterval = 24 * 60 * 60) {
        let root = rootURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("FISH", isDirectory: true)
        fileURL = root.appendingPathComponent("completed-attachment-uploads.json")
        self.ttl = ttl
    }

    /// Records that `attachmentId`'s PUT completed successfully even though
    /// nothing was observing it. Called synchronously from the URLSession
    /// delegate callback so the record is durable on disk before the OS
    /// gets a chance to suspend or terminate the process again.
    public func markSucceeded(attachmentId: String) {
        lock.withLock {
            var payload = load()
            payload.completedAt[attachmentId] = Date()
            prune(&payload)
            persist(payload)
        }
    }

    /// If `attachmentId` was recorded as already-succeeded (and hasn't
    /// expired), consumes and removes the record, returning `true`.
    public func consumeIfSucceeded(attachmentId: String) -> Bool {
        lock.withLock {
            var payload = load()
            prune(&payload)
            guard payload.completedAt.removeValue(forKey: attachmentId) != nil else { return false }
            persist(payload)
            return true
        }
    }

    /// Test-only peek: whether a mark is currently recorded, without
    /// consuming it. Production callers only ever need `consumeIfSucceeded`.
    func hasMark(for attachmentId: String) -> Bool {
        lock.withLock {
            var payload = load()
            prune(&payload)
            return payload.completedAt[attachmentId] != nil
        }
    }

    private func load() -> Payload {
        guard let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode(Payload.self, from: data) else {
            return Payload()
        }
        return decoded
    }

    private func prune(_ payload: inout Payload) {
        let cutoff = Date().addingTimeInterval(-ttl)
        payload.completedAt = payload.completedAt.filter { $0.value > cutoff }
    }

    private func persist(_ payload: Payload) {
        let directory = fileURL.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        guard let data = try? JSONEncoder().encode(payload) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
