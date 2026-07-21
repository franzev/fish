import XCTest
@testable import Fish

final class FishSharePayloadTests: XCTestCase {
    func testRoundTripReadsAttachmentAndClearsOnlyMatchingPayload() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("fish-share-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let payload = FishSharePayload(
            id: "share-one",
            text: "https://example.com",
            items: [FishShareItem(
                relativePath: "pending-share-items/share-one/photo.shared",
                originalName: "photo.jpg",
                sourceMimeType: "image/jpeg"
            )]
        )
        let itemURL = try FishShareStore.itemURL(
            for: payload.id,
            fileName: "photo.shared",
            container: root
        )
        try Data("photo".utf8).write(to: itemURL)
        try FishShareStore.write(payload, container: root)

        XCTAssertEqual(FishShareStore.read(container: root), payload)
        XCTAssertEqual(
            FishShareStore.data(for: payload.items[0], container: root),
            Data("photo".utf8)
        )

        let replacement = FishSharePayload(id: "share-two", text: "A new share")
        try FishShareStore.write(replacement, container: root)
        FishShareStore.clear(payload, container: root)
        XCTAssertEqual(FishShareStore.read(container: root), replacement)

        FishShareStore.clear(replacement, container: root)
        XCTAssertNil(FishShareStore.read(container: root))
    }

    func testRejectsUnsafeAttachmentPaths() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("fish-share-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let unsafe = FishShareItem(
            relativePath: "pending-share-items/../secret.shared",
            originalName: "secret.txt",
            sourceMimeType: "text/plain"
        )
        XCTAssertNil(FishShareStore.data(for: unsafe, container: root))
        XCTAssertThrowsError(try FishShareStore.itemURL(
            for: "share/other",
            fileName: "secret.shared",
            container: root
        )) { error in
            XCTAssertEqual(error as? FishShareStoreError, .invalidPath)
        }
    }
}
