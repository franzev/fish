import ChatCore
import Foundation
import Testing
@testable import ChatData

private final class ChatDataURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: @Sendable (URLRequest) throws -> (Int, Data) = {
        _ in (500, Data())
    }
    nonisolated(unsafe) static var requests: [URLRequest] = []
    private static let lock = NSLock()

    static func reset(
        handler: @escaping @Sendable (URLRequest) throws -> (Int, Data)
    ) {
        lock.withLock { requests = [] }
        self.handler = handler
    }

    static var capturedRequests: [URLRequest] { lock.withLock { requests } }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        do {
            var captured = request
            if captured.httpBody == nil, let stream = captured.httpBodyStream {
                stream.open()
                defer { stream.close() }
                var body = Data()
                let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 4_096)
                defer { buffer.deallocate() }
                while stream.hasBytesAvailable {
                    let count = stream.read(buffer, maxLength: 4_096)
                    guard count > 0 else { break }
                    body.append(buffer, count: count)
                }
                captured.httpBody = body
            }
            Self.lock.withLock { Self.requests.append(captured) }
            let (status, data) = try Self.handler(captured)
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: nil,
                headerFields: nil
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private struct NoAttachments: AttachmentHydrating {
    func readyAttachments(forMessageIds messageIds: [String]) async throws
        -> [String: [ChatAttachment]] { [:] }
}

private let chatBackend = ChatBackendConfiguration(
    supabaseUrl: URL(string: "https://fish.test")!,
    anonKey: "anon",
    accessToken: { "token" }
)

private func chatSession() -> URLSession {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [ChatDataURLProtocol.self]
    return URLSession(configuration: configuration)
}

private func row(_ id: String, at timestamp: String = "2026-07-18T00:00:00.000Z") -> String {
    """
    {"id":"\(id)","conversation_id":"c1","sender_id":"u2","sender_role":"coach",
     "body":"\(id)","client_request_id":"r-\(id)","created_at":"\(timestamp)",
     "edited_at":null,"deleted_at":null,"reply_to_message_id":null,"sticker_id":null}
    """
}

@Suite(.serialized)
struct ChatLiveDataTests {
    @Test func olderPageUsesCompositeCursorAndNPlusOneProbe() async throws {
        ChatDataURLProtocol.reset { request in
            switch request.url?.path() {
            case "/rest/v1/messages":
                return (200, Data("[\(row("m3")),\(row("m2")),\(row("m1"))]".utf8))
            case "/rest/v1/message_gifs", "/rest/v1/message_reactions":
                return (200, Data("[]".utf8))
            default:
                return (200, Data("[]".utf8))
            }
        }
        let messaging = RestChatMessaging(
            configuration: chatBackend,
            hydration: NoAttachments(),
            session: chatSession()
        )
        let cursor = ChatMessageCursor(
            createdAt: "2026-07-18T00:00:00.000Z",
            id: "m4"
        )
        let page = try await messaging.messages(
            conversationId: "c1",
            before: cursor,
            limit: 2
        )
        #expect(page.messages.map(\.id) == ["m2", "m3"])
        #expect(page.hasMoreOlder)
        #expect(page.oldestCursor?.id == "m2")

        let request = try #require(ChatDataURLProtocol.capturedRequests.first {
            $0.url?.path() == "/rest/v1/messages"
        })
        let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
        #expect(query.first { $0.name == "limit" }?.value == "3")
        #expect(query.first { $0.name == "order" }?.value == "created_at.desc,id.desc")
        #expect(query.first { $0.name == "or" }?.value?.contains("created_at.lt.") == true)
        #expect(query.first { $0.name == "or" }?.value?.contains("id.lt.m4") == true)
    }

    @Test func backfillSignalsResetWhenGapExceedsOnePage() async throws {
        ChatDataURLProtocol.reset { request in
            switch request.url?.path() {
            case "/rest/v1/messages":
                return (200, Data("[\(row("m4")),\(row("m5")),\(row("m6"))]".utf8))
            case "/rest/v1/message_gifs", "/rest/v1/message_reactions":
                return (200, Data("[]".utf8))
            default:
                return (200, Data("[]".utf8))
            }
        }
        let page = try await RestChatMessaging(
            configuration: chatBackend,
            hydration: NoAttachments(),
            session: chatSession()
        ).messages(
            conversationId: "c1",
            after: ChatMessageCursor(createdAt: "2026-07-17T00:00:00.000Z", id: "m3"),
            limit: 2
        )
        #expect(page.messages.map(\.id) == ["m4", "m5"])
        #expect(page.needsReset)
        let request = try #require(ChatDataURLProtocol.capturedRequests.first {
            $0.url?.path() == "/rest/v1/messages"
        })
        #expect(request.url?.query?.contains("id.gt.m3") == true)
        #expect(request.url?.query?.contains("created_at.asc") == true)
    }

    @Test func commandAdapterUsesExactActionsAndCalmFailureBodies() async throws {
        ChatDataURLProtocol.reset { request in
            let body = try #require(request.httpBody)
            let object = try #require(
                JSONSerialization.jsonObject(with: body) as? [String: Any]
            )
            #expect(object["action"] as? String == "edit-message")
            #expect(object["messageId"] as? String == "m1")
            #expect(object["body"] as? String == "Updated")
            return (200, Data("{\"message\":\(row("m1"))}".utf8))
        }
        let commands = EdgeFunctionChatCommands(
            configuration: chatBackend,
            session: chatSession()
        )
        #expect(try await commands.execute(.edit(messageId: "m1", body: "Updated")).id == "m1")

        ChatDataURLProtocol.reset { _ in
            (403, Data(#"{"code":"not_authorized","error":"That message is not available."}"#.utf8))
        }
        do {
            _ = try await commands.execute(.delete(messageId: "m1"))
            Issue.record("Expected a typed failure")
        } catch let failure as ChatCommandFailure {
            #expect(failure.code == "not_authorized")
            #expect(failure.notice == "That message is not available.")
            #expect(failure.statusCode == 403)
        }
    }

    @Test func readAndUnreadWiresMatchBackendContracts() async throws {
        ChatDataURLProtocol.reset { request in
            if request.url?.path() == "/functions/v1/chat-command" {
                let body = try #require(request.httpBody)
                let object = try #require(
                    JSONSerialization.jsonObject(with: body) as? [String: Any]
                )
                #expect(object["action"] as? String == "mark-read-state")
                #expect(object["conversationId"] as? String == "c1")
                #expect(object["lastDeliveredMessageId"] as? String == "m2")
                #expect(object["lastReadMessageId"] as? String == "m1")
                return (200, Data(#"{"readState":{"user_id":"u1","last_delivered_message_id":"m2","delivered_at":"2026-07-18T00:00:01Z","last_read_message_id":"m1","read_at":"2026-07-18T00:00:01Z"}}"#.utf8))
            }
            let body = try #require(request.httpBody)
            let object = try #require(
                JSONSerialization.jsonObject(with: body) as? [String: Any]
            )
            #expect(object["p_conversation_id"] as? String == "c1")
            return (200, Data(#"[{"unread_count":2,"oldest_unread_at":"2026-07-18T00:00:00Z","latest_unread_message_id":"m3"}]"#.utf8))
        }
        let commands = EdgeFunctionChatCommands(
            configuration: chatBackend,
            session: chatSession()
        )
        let read = try await commands.markReadState(
            conversationId: "c1",
            lastDeliveredMessageId: "m2",
            lastReadMessageId: "m1"
        )
        #expect(read.lastReadMessageId == "m1")
        let unread = try await commands.unreadSummary(conversationId: "c1")
        #expect(unread.count == 2)
        #expect(unread.latestUnreadMessageId == "m3")
    }

    @Test func directoryAdaptersDecodePreviewsAttentionAndFailures() async throws {
        ChatDataURLProtocol.reset { request in
            switch request.url?.path() {
            case "/rest/v1/rpc/list_direct_conversation_previews":
                return (200, Data(#"[{"conversation_id":"c1","participant_id":"u2","participant_role":"coach","participant_display_name":"Coach Mina","latest_message_sender_id":"u2","latest_message_text":"Hello","latest_message_created_at":"2026-07-18T00:00:00Z","unread_count":2}]"#.utf8))
            case "/rest/v1/rpc/list_navigation_attention":
                return (200, Data(#"[{"surface":"direct","entity_id":"c1","conversation_id":"c1","unread_count":2,"mention_count":0,"new_activity":true}]"#.utf8))
            default:
                return (404, Data())
            }
        }
        let directory = RestConversationDirectory(
            configuration: chatBackend,
            session: chatSession()
        )
        let previews = try await directory.conversations()
        #expect(previews.first?.participantDisplayName == "Coach Mina")
        #expect(previews.first?.unreadCount == 2)
        let attention = try await directory.navigationAttention()
        #expect(attention.first?.conversationId == "c1")
        #expect(attention.first?.newActivity == true)
        #expect(ChatDataURLProtocol.capturedRequests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == "Bearer token"
        })

        ChatDataURLProtocol.reset { _ in
            (503, Data(#"{"code":"database","error":"Please try conversations again."}"#.utf8))
        }
        do {
            _ = try await directory.conversations()
            Issue.record("Expected a directory failure")
        } catch let failure as ChatCommandFailure {
            #expect(failure.code == "database")
            #expect(failure.notice == "Please try conversations again.")
            #expect(failure.statusCode == 503)
        }
    }

    @Test func timeoutMapsToACalmTypedFailure() async throws {
        ChatDataURLProtocol.reset { _ in throw URLError(.timedOut) }
        let commands = EdgeFunctionChatCommands(
            configuration: chatBackend,
            session: chatSession()
        )
        do {
            _ = try await commands.execute(.delete(messageId: "m1"))
            Issue.record("Expected a timeout failure")
        } catch let failure as ChatCommandFailure {
            #expect(failure.code == "chat_unavailable")
            #expect(failure.notice == ChatCommandFailure.unavailable.notice)
            #expect(failure.statusCode == nil)
        }
    }

    @Test func expiredHttpSessionMapsToTheEstablishedSignInCopy() async throws {
        ChatDataURLProtocol.reset { _ in
            (401, Data(#"{"error":"token expired"}"#.utf8))
        }
        let session = chatSession()
        let commands = EdgeFunctionChatCommands(
            configuration: chatBackend,
            session: session
        )
        let messaging = RestChatMessaging(
            configuration: chatBackend,
            hydration: NoAttachments(),
            session: session
        )
        let directory = RestConversationDirectory(
            configuration: chatBackend,
            session: session
        )

        for operation in [
            { _ = try await commands.execute(.delete(messageId: "m1")) },
            { _ = try await messaging.messages(conversationId: "c1") },
            { _ = try await directory.conversations() },
        ] {
            do {
                try await operation()
                Issue.record("Expected an authentication failure")
            } catch let failure as ChatCommandFailure {
                #expect(failure == .notAuthenticated)
            }
        }
    }

    @Test func lifecycleCoalescesDisconnectAndOneReconnectAcrossChannels() async {
        let lifecycle = ChatChannelLifecycle(expected: 4)
        #expect(await lifecycle.update(topic: "messages", isSubscribed: true).isEmpty)
        #expect(await lifecycle.update(topic: "reads", isSubscribed: true).isEmpty)
        #expect(await lifecycle.update(topic: "reactions", isSubscribed: true).isEmpty)
        #expect(await lifecycle.update(topic: "typing", isSubscribed: true) == [.connected])
        #expect(await lifecycle.update(topic: "messages", isSubscribed: false) == [.disconnected])
        #expect(await lifecycle.update(topic: "reads", isSubscribed: false).isEmpty)
        #expect(await lifecycle.update(topic: "messages", isSubscribed: true).isEmpty)
        #expect(await lifecycle.update(topic: "reads", isSubscribed: true) == [.reconnected])
        #expect(await lifecycle.update(topic: "reads", isSubscribed: true).isEmpty)
    }

    @Test func realtimeTopicAndTypingPayloadKeysStaySharedWithWeb() {
        #expect(ChatRealtimeWire.messageTopic("c1") == "conversation:c1:messages")
        #expect(ChatRealtimeWire.readTopic("c1") == "conversation:c1:reads")
        #expect(ChatRealtimeWire.reactionTopic("c1") == "conversation:c1:reactions")
        #expect(ChatRealtimeWire.typingTopic("c1") == "conversation:c1:typing")
        #expect(ChatRealtimeWire.typingEvent == "typing")
        #expect(ChatRealtimeWire.typingUserIdKey == "userId")
        #expect(ChatRealtimeWire.typingValueKey == "typing")
    }
}
