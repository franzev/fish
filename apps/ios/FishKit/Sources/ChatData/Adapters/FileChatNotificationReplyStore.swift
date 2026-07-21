import Foundation

/// Durable inbox for notification replies. It is deliberately separate from
/// composer drafts so an action completed while the app is suspended can be
/// drained once the chat session is ready.
public actor FileChatNotificationReplyStore: ChatNotificationReplyProviding {
    private struct Payload: Codable {
        var replies: [String: ChatNotificationReply] = [:]
    }

    public static let shared = FileChatNotificationReplyStore()

    private let fileURL: URL
    private var payload: Payload?

    public init(rootURL: URL? = nil) {
        let root = rootURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("FISH", isDirectory: true)
        fileURL = root.appendingPathComponent("notification-replies.json")
    }

    public func enqueue(_ reply: ChatNotificationReply) async throws {
        var value = try loaded()
        value.replies[reply.id] = reply
        try persist(value)
    }

    public func pendingReplies() async throws -> [ChatNotificationReply] {
        try loaded().replies.values.sorted { $0.createdAt < $1.createdAt }
    }

    public func remove(id: String) async throws {
        var value = try loaded()
        value.replies[id] = nil
        try persist(value)
    }

    public func removeAll() async throws {
        payload = Payload()
        try? FileManager.default.removeItem(at: fileURL)
    }

    private func loaded() throws -> Payload {
        if let payload { return payload }
        let value: Payload
        if let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode(Payload.self, from: data) {
            value = decoded
        } else {
            value = Payload()
        }
        payload = value
        return value
    }

    private func persist(_ value: Payload) throws {
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder().encode(value)
        try data.write(to: fileURL, options: [.atomic])
        #if os(iOS)
        try? FileManager.default.setAttributes(
            // Notification actions can be completed while the device is
            // locked; this inbox therefore must remain readable at boot.
            [.protectionKey: FileProtectionType.none],
            ofItemAtPath: fileURL.path
        )
        #endif
        payload = value
    }
}
