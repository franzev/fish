import Foundation

public enum ChatSelectors {
    public static func compareChatMessages(
        _ left: ChatMessageState,
        _ right: ChatMessageState
    ) -> Bool {
        let leftDate = timestamp(left.createdAt)
        let rightDate = timestamp(right.createdAt)
        if leftDate != rightDate { return leftDate < rightDate }
        return left.id.compare(right.id) == .orderedAscending
    }

    public static func mergeChatMessage(
        _ current: [ChatMessageState],
        _ incoming: ChatMessageState,
        localRequestId: String? = nil
    ) -> [ChatMessageState] {
        let requestId = localRequestId ?? incoming.clientRequestId
        guard let index = current.firstIndex(where: {
            $0.id == incoming.id
                || $0.clientRequestId == incoming.clientRequestId
                || $0.clientRequestId == requestId
        }) else {
            return (current + [incoming]).sorted(by: compareChatMessages)
        }

        let existing = current[index]
        let incomingAttachments = incoming.attachments ?? incoming.images
        let existingAttachments = existing.attachments ?? existing.images
        let attachments = incomingAttachments?.isEmpty == false
            ? incomingAttachments
            : existingAttachments
        var merged = incoming
        merged.senderDisplayName = incoming.senderDisplayName ?? existing.senderDisplayName
        merged.attachments = attachments
        merged.images = attachments
        merged.gif = incoming.gif ?? existing.gif
        merged.stickerId = incoming.stickerId ?? existing.stickerId
        guard merged != existing else { return current }

        var next = current
        next[index] = merged
        return next.sorted(by: compareChatMessages)
    }

    public static func mergeReadState(
        _ current: [ChatReadState],
        _ incoming: ChatReadState
    ) -> [ChatReadState] {
        guard let index = current.firstIndex(where: { $0.userId == incoming.userId }) else {
            return current + [incoming]
        }
        guard current[index] != incoming else { return current }
        var next = current
        next[index] = incoming
        return next
    }

    public static func getOutgoingMessageStatus(
        _ message: ChatMessageState,
        messages: [ChatMessageState],
        participantReadState: ChatReadState?
    ) -> OutgoingMessageStatus {
        if isAtOrAfterMessage(
            participantReadState?.lastReadMessageId,
            targetMessageId: message.id,
            messages: messages
        ) {
            return .read
        }
        if isAtOrAfterMessage(
            participantReadState?.lastDeliveredMessageId,
            targetMessageId: message.id,
            messages: messages
        ) {
            return .delivered
        }
        return .sent
    }

    public static func countUnreadMessages(
        _ messages: [ChatMessageState],
        currentUserId: String,
        currentUserReadState: ChatReadState?
    ) -> Int {
        getUnreadMessageSummary(
            messages,
            currentUserId: currentUserId,
            currentUserReadState: currentUserReadState
        ).count
    }

    public static func getUnreadMessageSummary(
        _ messages: [ChatMessageState],
        currentUserId: String,
        currentUserReadState: ChatReadState?
    ) -> UnreadMessageSummary {
        let lastReadIndex = currentUserReadState?.lastReadMessageId.flatMap { marker in
            messages.firstIndex(where: { $0.id == marker })
        } ?? -1
        let unread = messages.enumerated().compactMap { index, message in
            index > lastReadIndex
                && message.senderId != currentUserId
                && message.deletedAt == nil
                ? message
                : nil
        }
        return UnreadMessageSummary(
            count: unread.count,
            oldestUnreadAt: unread.first?.createdAt,
            latestUnreadMessageId: unread.last?.id
        )
    }

    public static func getMessageSnippet(_ message: ChatMessageState) -> String {
        if message.deletedAt != nil { return "Message deleted" }
        let body = message.body.trimmingCharacters(in: .whitespacesAndNewlines)
        if body.isEmpty, message.stickerId != nil { return "Sticker" }
        if body.isEmpty, message.gif != nil { return "GIF" }
        let attachments = message.attachments ?? message.images ?? []
        if body.isEmpty, !attachments.isEmpty {
            if attachments.count == 1 {
                return attachments[0].kind == "file" ? "File" : "Image"
            }
            return attachments.allSatisfy { $0.kind != "file" }
                ? "\(attachments.count) images"
                : "\(attachments.count) files"
        }
        guard body.count > 96 else { return body }
        return String(body.prefix(95)) + "…"
    }

    public static func toReplyPreview(
        _ message: ChatMessageState,
        currentUserId: String,
        participantName: String,
        currentUserName: String
    ) -> ReplyPreview {
        ReplyPreview(
            id: message.id,
            authorName: message.senderId == currentUserId ? currentUserName : participantName,
            snippet: getMessageSnippet(message)
        )
    }

    private static func isAtOrAfterMessage(
        _ markerMessageId: String?,
        targetMessageId: String,
        messages: [ChatMessageState]
    ) -> Bool {
        guard
            let markerMessageId,
            let targetIndex = messages.firstIndex(where: { $0.id == targetMessageId }),
            let markerIndex = messages.firstIndex(where: { $0.id == markerMessageId })
        else { return false }
        return markerIndex >= targetIndex
    }

    private static func timestamp(_ value: String) -> Date {
        if let date = try? Date(value, strategy: .iso8601) { return date }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? .distantPast
    }
}

public func compareChatMessages(_ left: ChatMessageState, _ right: ChatMessageState) -> Bool {
    ChatSelectors.compareChatMessages(left, right)
}

public func mergeChatMessage(
    _ current: [ChatMessageState],
    _ incoming: ChatMessageState,
    localRequestId: String? = nil
) -> [ChatMessageState] {
    ChatSelectors.mergeChatMessage(current, incoming, localRequestId: localRequestId)
}

public func mergeReadState(_ current: [ChatReadState], _ incoming: ChatReadState) -> [ChatReadState] {
    ChatSelectors.mergeReadState(current, incoming)
}

public func getOutgoingMessageStatus(
    _ message: ChatMessageState,
    messages: [ChatMessageState],
    participantReadState: ChatReadState?
) -> OutgoingMessageStatus {
    ChatSelectors.getOutgoingMessageStatus(
        message,
        messages: messages,
        participantReadState: participantReadState
    )
}

public func countUnreadMessages(
    _ messages: [ChatMessageState],
    currentUserId: String,
    currentUserReadState: ChatReadState?
) -> Int {
    ChatSelectors.countUnreadMessages(
        messages,
        currentUserId: currentUserId,
        currentUserReadState: currentUserReadState
    )
}

public func getUnreadMessageSummary(
    _ messages: [ChatMessageState],
    currentUserId: String,
    currentUserReadState: ChatReadState?
) -> UnreadMessageSummary {
    ChatSelectors.getUnreadMessageSummary(
        messages,
        currentUserId: currentUserId,
        currentUserReadState: currentUserReadState
    )
}

public func getMessageSnippet(_ message: ChatMessageState) -> String {
    ChatSelectors.getMessageSnippet(message)
}

public func toReplyPreview(
    _ message: ChatMessageState,
    currentUserId: String,
    participantName: String,
    currentUserName: String
) -> ReplyPreview {
    ChatSelectors.toReplyPreview(
        message,
        currentUserId: currentUserId,
        participantName: participantName,
        currentUserName: currentUserName
    )
}
