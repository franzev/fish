import ChatData
import XCTest
@testable import Fish

final class NotificationReplyDrainerTests: XCTestCase {
    private actor Recorder {
        var removed: [String] = []
        var markedRead: [(String, String)] = []
        var drafts: [(String, String)] = []
        var notices: [String] = []
        func remove(_ id: String) { removed.append(id) }
        func markRead(_ c: String, _ m: String) { markedRead.append((c, m)) }
        func draft(_ c: String, _ b: String) { drafts.append((c, b)) }
        func notice(_ id: String) { notices.append(id) }
    }

    private func reply(_ messageId: String? = "msg-1") -> ChatNotificationReply {
        ChatNotificationReply(id: "reply-1", conversationId: "conv-1", body: "hi", messageId: messageId)
    }

    private func drainer(
        recorder: Recorder,
        replies: [ChatNotificationReply],
        authorized: Bool = true,
        outcome: NotificationReplyDrainer.SendOutcome = .sent
    ) -> NotificationReplyDrainer {
        NotificationReplyDrainer(
            pendingReplies: { replies },
            remove: { await recorder.remove($0) },
            isAuthorized: { _ in authorized },
            send: { _ in outcome },
            markRead: { await recorder.markRead($0, $1) },
            saveDraft: { await recorder.draft($0, $1) },
            postFailureNotice: { await recorder.notice($0.id) }
        )
    }

    func testSentReplyMarksReadAndRemoves() async {
        let recorder = Recorder()
        let sentAny = await drainer(recorder: recorder, replies: [reply()]).run()
        XCTAssertTrue(sentAny)
        let removed = await recorder.removed
        let marked = await recorder.markedRead
        XCTAssertEqual(removed, ["reply-1"])
        XCTAssertEqual(marked.count, 1)
        XCTAssertEqual(marked[0].1, "msg-1")
    }

    func testLegacyReplyWithoutMessageIdSkipsMarkRead() async {
        let recorder = Recorder()
        _ = await drainer(recorder: recorder, replies: [reply(nil)]).run()
        let marked = await recorder.markedRead
        XCTAssertTrue(marked.isEmpty)
    }

    func testUnauthorizedReplyIsRemovedQuietly() async {
        let recorder = Recorder()
        let sentAny = await drainer(recorder: recorder, replies: [reply()], authorized: false).run()
        XCTAssertFalse(sentAny)
        let removed = await recorder.removed
        let notices = await recorder.notices
        XCTAssertEqual(removed, ["reply-1"])
        XCTAssertTrue(notices.isEmpty)
    }

    func testTerminalFailureSavesDraftNoticesAndRemoves() async {
        let recorder = Recorder()
        _ = await drainer(recorder: recorder, replies: [reply()], outcome: .terminal).run()
        let drafts = await recorder.drafts
        let notices = await recorder.notices
        let removed = await recorder.removed
        XCTAssertEqual(drafts.count, 1)
        XCTAssertEqual(drafts[0].1, "hi")
        XCTAssertEqual(notices, ["reply-1"])
        XCTAssertEqual(removed, ["reply-1"])
    }

    func testRetryLaterKeepsTheReply() async {
        let recorder = Recorder()
        let sentAny = await drainer(recorder: recorder, replies: [reply()], outcome: .retryLater).run()
        XCTAssertFalse(sentAny)
        let removed = await recorder.removed
        XCTAssertTrue(removed.isEmpty)
    }
}
