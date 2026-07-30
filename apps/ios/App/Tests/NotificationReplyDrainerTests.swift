import ChatData
import XCTest
@testable import Fish

final class NotificationReplyDrainerTests: XCTestCase {
    private actor Recorder {
        enum Event: Equatable {
            case markedRead(String, String)
            case sent(String)
            case removed(String)
            case draft(String, String)
            case notice(String)
        }
        var events: [Event] = []
        func record(_ event: Event) { events.append(event) }
    }

    private final class Flag: @unchecked Sendable {
        var calls = 0
        var allowFirstOnly = false
        func check() -> Bool {
            calls += 1
            return allowFirstOnly ? calls <= 1 : true
        }
    }

    private func reply(
        _ id: String = "reply-1",
        conversationId: String = "conv-1",
        messageId: String? = "msg-1"
    ) -> ChatNotificationReply {
        ChatNotificationReply(id: id, conversationId: conversationId, body: "hi", messageId: messageId)
    }

    private func drainer(
        recorder: Recorder,
        replies: [ChatNotificationReply],
        authorized: Set<String> = ["conv-1"],
        outcomes: [String: NotificationReplyDrainer.SendOutcome] = [:],
        defaultOutcome: NotificationReplyDrainer.SendOutcome = .sent,
        draftSucceeds: Bool = true,
        flag: Flag = Flag()
    ) -> NotificationReplyDrainer {
        NotificationReplyDrainer(
            pendingReplies: { replies },
            remove: { await recorder.record(.removed($0)) },
            isAuthorized: { authorized.contains($0) },
            send: { reply in
                await recorder.record(.sent(reply.id))
                return outcomes[reply.id] ?? defaultOutcome
            },
            markRead: { await recorder.record(.markedRead($0, $1)) },
            saveDraft: { conversationId, body in
                await recorder.record(.draft(conversationId, body))
                return draftSucceeds
            },
            postFailureNotice: { await recorder.record(.notice($0.id)) },
            isStillCurrentAccount: { flag.check() }
        )
    }

    func testSentReplyMarksReadBeforeSendingThenRemoves() async {
        let recorder = Recorder()
        let sentAny = await drainer(recorder: recorder, replies: [reply()]).run()
        XCTAssertTrue(sentAny)
        let events = await recorder.events
        XCTAssertEqual(events, [.markedRead("conv-1", "msg-1"), .sent("reply-1"), .removed("reply-1")])
    }

    func testLegacyReplyWithoutMessageIdSkipsMarkRead() async {
        let recorder = Recorder()
        _ = await drainer(recorder: recorder, replies: [reply(messageId: nil)]).run()
        let events = await recorder.events
        XCTAssertEqual(events, [.sent("reply-1"), .removed("reply-1")])
    }

    func testUnauthorizedReplyIsRemovedWithoutMarkReadOrSend() async {
        let recorder = Recorder()
        let entries = [reply("reply-a", conversationId: "conv-x"), reply("reply-b", conversationId: "conv-1")]
        let sentAny = await drainer(recorder: recorder, replies: entries).run()
        XCTAssertTrue(sentAny)
        let events = await recorder.events
        XCTAssertEqual(events, [
            .removed("reply-a"),
            .markedRead("conv-1", "msg-1"),
            .sent("reply-b"),
            .removed("reply-b"),
        ])
    }

    func testTerminalFailureStillMarksReadThenPreservesNoticesRemoves() async {
        let recorder = Recorder()
        _ = await drainer(recorder: recorder, replies: [reply()], defaultOutcome: .terminal).run()
        let events = await recorder.events
        XCTAssertEqual(events, [
            .markedRead("conv-1", "msg-1"),
            .sent("reply-1"),
            .draft("conv-1", "hi"),
            .notice("reply-1"),
            .removed("reply-1"),
        ])
    }

    func testFailedPreservationKeepsTheEntry() async {
        let recorder = Recorder()
        let sentAny = await drainer(
            recorder: recorder,
            replies: [reply()],
            defaultOutcome: .terminal,
            draftSucceeds: false
        ).run()
        XCTAssertFalse(sentAny)
        let events = await recorder.events
        XCTAssertEqual(events, [
            .markedRead("conv-1", "msg-1"),
            .sent("reply-1"),
            .draft("conv-1", "hi"),
        ])
    }

    func testRetryLaterKeepsTheReplyButStillMarksRead() async {
        let recorder = Recorder()
        let sentAny = await drainer(recorder: recorder, replies: [reply()], defaultOutcome: .retryLater).run()
        XCTAssertFalse(sentAny)
        let events = await recorder.events
        XCTAssertEqual(events, [.markedRead("conv-1", "msg-1"), .sent("reply-1")])
    }

    func testMixedOutcomesRemoveSuccessesAndKeepFailures() async {
        let recorder = Recorder()
        let entries = [reply("reply-1"), reply("reply-2", messageId: "msg-2")]
        let sentAny = await drainer(
            recorder: recorder,
            replies: entries,
            outcomes: ["reply-1": .sent, "reply-2": .retryLater]
        ).run()
        XCTAssertTrue(sentAny)
        let events = await recorder.events
        XCTAssertEqual(events, [
            .markedRead("conv-1", "msg-1"),
            .sent("reply-1"),
            .removed("reply-1"),
            .markedRead("conv-1", "msg-2"),
            .sent("reply-2"),
        ])
    }

    func testAccountSwitchStopsTheDrain() async {
        let recorder = Recorder()
        let flag = Flag()
        flag.allowFirstOnly = true
        let entries = [reply("reply-1"), reply("reply-2", messageId: "msg-2")]
        let sentAny = await drainer(recorder: recorder, replies: entries, flag: flag).run()
        XCTAssertTrue(sentAny)
        let events = await recorder.events
        XCTAssertEqual(events, [.markedRead("conv-1", "msg-1"), .sent("reply-1"), .removed("reply-1")])
    }

    func testOutcomeMapping() {
        XCTAssertEqual(NotificationReplyDrainer.outcome(for: failure(statusCode: 401, code: "x")), .terminal)
        XCTAssertEqual(NotificationReplyDrainer.outcome(for: failure(statusCode: 403, code: "x")), .terminal)
        XCTAssertEqual(
            NotificationReplyDrainer.outcome(for: failure(statusCode: nil, code: "conversation_not_available")),
            .terminal
        )
        XCTAssertEqual(
            NotificationReplyDrainer.outcome(for: failure(statusCode: nil, code: "invalid_request")),
            .terminal
        )
        XCTAssertEqual(
            NotificationReplyDrainer.outcome(for: failure(statusCode: 500, code: "send_unavailable")),
            .retryLater
        )
    }

    func testJoinedDraft() {
        XCTAssertEqual(NotificationReplyDrainer.joinedDraft(existing: nil, reply: "hi"), "hi")
        XCTAssertEqual(NotificationReplyDrainer.joinedDraft(existing: "  ", reply: "hi"), "hi")
        XCTAssertEqual(NotificationReplyDrainer.joinedDraft(existing: "typed", reply: "hi"), "typed\nhi")
    }

    private func failure(statusCode: Int?, code: String) -> ChatCommandFailure {
        // ChatCommandFailure's real initializer is
        // `init(code: String, notice: String, statusCode: Int? = nil)` — the
        // `notice` copy is irrelevant to `outcome(for:)`, which only reads
        // `code`/`statusCode`.
        ChatCommandFailure(code: code, notice: "notice", statusCode: statusCode)
    }
}
