import PersonalChat
import Testing

@Suite
struct SharedContentPreviewTests {
    @Test func transferRequiresServerCapabilityAndNeverAllowsGifOrSticker() {
        #expect(!SharedContentPreviewCapabilities.canTransfer(item(kind: "gif", canExport: true)))
        #expect(!SharedContentPreviewCapabilities.canTransfer(item(kind: "sticker", canExport: true)))
        #expect(SharedContentPreviewCapabilities.canTransfer(item(
            kind: "document",
            canExport: true
        )))
        #expect(SharedContentPreviewCapabilities.canOpen(item(kind: "document")))
        #expect(!SharedContentPreviewCapabilities.canOpen(item(
            kind: "document",
            sourceMessageId: nil,
            attachmentId: nil
        )))
        #expect(!SharedContentPreviewCapabilities.canOpen(item(
            kind: "document",
            mimeType: nil,
            byteSize: nil
        )))
    }

    @Test func deleteRequiresServerCapabilityAndSourceMessage() {
        #expect(SharedContentPreviewCapabilities.canDelete(item(canDelete: true)))
        #expect(!SharedContentPreviewCapabilities.canDelete(item(canDelete: false)))
        #expect(!SharedContentPreviewCapabilities.canDelete(item(
            canDelete: true,
            sourceMessageId: nil
        )))
    }

    @Test func previewItemRetainsSenderDateAndLinkContext() {
        let value = item(
            kind: "link",
            senderId: "coach-1",
            sourceCreatedAt: "2026-07-24T10:30:00.000Z",
            linkUrl: "https://example.test/lesson"
        )
        #expect(value.senderId == "coach-1")
        #expect(value.sourceCreatedAt == "2026-07-24T10:30:00.000Z")
        #expect(value.linkUrl == "https://example.test/lesson")
    }

    @Test func linksRequireHttpHostAndOpenDoesNotDependOnExportAuthority() {
        let safeLink = item(
            kind: "link",
            canExport: true,
            linkUrl: "https://example.test/lesson",
            attachmentId: nil
        )
        let unsafeLink = item(
            kind: "link",
            canExport: true,
            linkUrl: "javascript:alert(1)",
            attachmentId: nil
        )
        let document = item(kind: "document", canExport: false)
        let photo = item(kind: "photo", canExport: true)

        #expect(SharedContentPreviewCapabilities.canTransfer(safeLink))
        #expect(SharedContentPreviewCapabilities.canOpen(safeLink))
        #expect(!SharedContentPreviewCapabilities.canTransfer(unsafeLink))
        #expect(!SharedContentPreviewCapabilities.canOpen(unsafeLink))
        #expect(SharedContentPreviewCapabilities.canOpen(document))
        #expect(!SharedContentPreviewCapabilities.canOpen(photo))
    }
}

private func item(
    kind: String = "document",
    canDelete: Bool = false,
    canExport: Bool = false,
    sourceMessageId: String? = "message-1",
    senderId: String = "sender-1",
    sourceCreatedAt: String = "2026-07-24T10:30:00.000Z",
    linkUrl: String? = nil,
    attachmentId: String? = "attachment-1",
    mimeType: String? = "application/pdf",
    byteSize: Int64? = 4
) -> SharedContentAcceptedItem {
    SharedContentAcceptedItem(
        itemId: "item-\(kind)",
        conversationId: "conversation-1",
        category: kind == "document" ? "files" : kind == "link" ? "links" : "media",
        kind: kind,
        originalName: "file.pdf",
        mimeType: mimeType,
        byteSize: byteSize,
        linkUrl: linkUrl,
        sourceMessageId: sourceMessageId,
        attachmentId: kind == "link" ? nil : attachmentId,
        contentVersion: sourceCreatedAt,
        senderId: senderId,
        sourceCreatedAt: sourceCreatedAt,
        canDelete: canDelete,
        canExport: canExport
    )
}
