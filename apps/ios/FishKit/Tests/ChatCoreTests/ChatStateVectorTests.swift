import ChatCore
import Foundation
import Testing
import TestSupport

struct ChatStateVectorTests {
    @Test func sharedReducerAndSelectorVectorsReplay() throws {
        let vectors = try ChatStateVectors.load()
        #expect(vectors.count == 24)

        for vector in vectors {
            let actual = ChatStateReducer.apply(vector.events, to: vector.initialState)
            if let expected = vector.expectedState {
                #expect(actual == expected, Comment(rawValue: vector.name))
            }
            try assertSelectors(vector.expectedSelectors, state: actual, name: vector.name)
        }
    }

    @Test func mediaMergeVectorsReplay() throws {
        let vectors = try ChatStateVectors.loadMediaMerge()
        #expect(vectors.count == 4)
        for vector in vectors {
            let merged = ChatSelectors.mergeChatMessage([vector.existing], vector.incoming)
            #expect(merged.count == 1, Comment(rawValue: vector.name))
            #expect(merged[0].gif?.providerId == vector.expectedGifProviderId)
            #expect(merged[0].stickerId == vector.expectedStickerId)
            #expect((merged[0].attachments ?? merged[0].images ?? []).map(\.id) == vector.expectedAttachmentIds)
        }
    }

    @Test func equalTimestampOrderingAndIdempotentRequestMerge() {
        let laterId = message(id: "b", request: "request-b", createdAt: "2026-07-18T01:00:00.123456Z")
        let earlierId = message(id: "a", request: "request-a", createdAt: "2026-07-18T01:00:00.123456Z")
        #expect([laterId, earlierId].sorted(by: compareChatMessages).map(\.id) == ["a", "b"])

        let acknowledged = message(id: "server", request: "request-a", createdAt: "2026-07-18T01:00:01Z")
        let merged = mergeChatMessage([earlierId], acknowledged)
        #expect(merged.count == 1)
        #expect(merged[0].id == "server")
    }

    @Test func snippetCoversEveryMediaFallbackAndUnicodeBoundary() {
        var value = message(id: "m", request: "r", createdAt: "2026-07-18T01:00:00Z", body: "")
        value.deletedAt = "2026-07-18T01:01:00Z"
        #expect(getMessageSnippet(value) == "Message deleted")
        value.deletedAt = nil
        value.stickerId = "known"
        #expect(getMessageSnippet(value) == "Sticker")
        value.stickerId = nil
        value.gif = ChatStateGif(
            provider: "klipy", providerId: "g", title: "", description: "",
            sourceUrl: "https://example.com", posterUrl: "https://example.com/p",
            previewUrl: "https://example.com/v", mediaUrl: "https://example.com/m",
            width: 1, height: 1
        )
        #expect(getMessageSnippet(value) == "GIF")
        value.gif = nil
        value.attachments = [attachment(id: "1", kind: "image"), attachment(id: "2", kind: "image")]
        #expect(getMessageSnippet(value) == "2 images")
        value.attachments = [attachment(id: "1", kind: "image"), attachment(id: "2", kind: "file")]
        #expect(getMessageSnippet(value) == "2 files")
        value.attachments = nil
        value.body = String(repeating: "😀", count: 97)
        #expect(getMessageSnippet(value).count == 96)
        #expect(getMessageSnippet(value).last == "…")
    }

    private func assertSelectors(
        _ selectors: ChatStateVector.ExpectedSelectors?,
        state: ChatState,
        name: String
    ) throws {
        guard let selectors else { return }
        if let input = selectors.unreadCount {
            let conversation = try #require(state.conversations[input.conversationId])
            let read = conversation.readStates.first { $0.userId == input.readStateUserId }
            #expect(countUnreadMessages(
                conversation.messages,
                currentUserId: input.currentUserId,
                currentUserReadState: read
            ) == input.expected, Comment(rawValue: name))
        }
        if let input = selectors.snippet {
            let message = try #require(state.conversations[input.conversationId]?.messages.first {
                $0.id == input.messageId
            })
            #expect(getMessageSnippet(message) == input.expected, Comment(rawValue: name))
        }
        if let input = selectors.outgoingStatus {
            let conversation = try #require(state.conversations[input.conversationId])
            let message = try #require(conversation.messages.first { $0.id == input.messageId })
            let read = conversation.readStates.first { $0.userId == input.readStateUserId }
            #expect(getOutgoingMessageStatus(
                message,
                messages: conversation.messages,
                participantReadState: read
            ) == input.expected, Comment(rawValue: name))
        }
        if let input = selectors.replyPreview {
            let message = try #require(state.conversations[input.conversationId]?.messages.first {
                $0.id == input.messageId
            })
            #expect(toReplyPreview(
                message,
                currentUserId: input.currentUserId,
                participantName: input.participantName,
                currentUserName: input.currentUserName
            ) == input.expected, Comment(rawValue: name))
        }
    }

    private func message(
        id: String,
        request: String,
        createdAt: String,
        body: String = "Hello"
    ) -> ChatMessageState {
        ChatMessageState(
            id: id,
            conversationId: "conversation",
            senderId: "client",
            senderRole: .client,
            body: body,
            clientRequestId: request,
            createdAt: createdAt
        )
    }

    private func attachment(id: String, kind: String) -> ChatStateAttachment {
        ChatStateAttachment(
            id: id,
            kind: kind,
            originalName: id,
            displayPath: "path/\(id)"
        )
    }
}
