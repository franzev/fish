import Foundation
import Testing
@testable import ChatData

@Suite struct CompletedAttachmentUploadMarksTests {
    @Test func marksSucceededThenConsumesExactlyOnce() {
        let marks = CompletedAttachmentUploadMarks(rootURL: temporaryDirectory())
        marks.markSucceeded(attachmentId: "a1")
        #expect(marks.hasMark(for: "a1"))
        #expect(marks.consumeIfSucceeded(attachmentId: "a1"))
        #expect(!marks.hasMark(for: "a1"))
        #expect(!marks.consumeIfSucceeded(attachmentId: "a1"))
    }

    /// The whole point of this type is that it can't grow unboundedly: a
    /// mark older than its TTL must read as gone, both through the peek
    /// (`hasMark`) and the consuming check (`consumeIfSucceeded`) paths.
    @Test func expiredMarksAreTreatedAsGone() async throws {
        let marks = CompletedAttachmentUploadMarks(rootURL: temporaryDirectory(), ttl: 0.05)
        marks.markSucceeded(attachmentId: "expiring")
        #expect(marks.hasMark(for: "expiring"))

        try await Task.sleep(for: .milliseconds(150))

        #expect(!marks.hasMark(for: "expiring"))
        #expect(!marks.consumeIfSucceeded(attachmentId: "expiring"))
    }

    /// Pruning is scoped to expired entries only — a fresh mark recorded
    /// after an older one has aged out must survive being pruned alongside
    /// it.
    @Test func pruningDropsOnlyExpiredEntriesAndKeepsFreshOnes() async throws {
        let marks = CompletedAttachmentUploadMarks(rootURL: temporaryDirectory(), ttl: 0.1)
        marks.markSucceeded(attachmentId: "old")

        try await Task.sleep(for: .milliseconds(150))
        marks.markSucceeded(attachmentId: "fresh")

        #expect(!marks.hasMark(for: "old"))
        #expect(marks.hasMark(for: "fresh"))
        #expect(marks.consumeIfSucceeded(attachmentId: "fresh"))
    }

    private func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "fish-completed-marks-\(UUID().uuidString)", directoryHint: .isDirectory)
    }
}
