import ChatData
import DesignSystem
import SwiftUI
import Testing
import TestSupport
@testable import PersonalChat

@MainActor struct AttachmentSnapshotTests {
    @Test func stagedStripCoversEveryStateAndFiveItemGeometry() {
        let view = VStack(alignment: .leading, spacing: Spacing.lg) {
            StagedAttachmentStrip(
                items: Array(AttachmentFixtures.stagedStates.prefix(4)),
                onRetry: { _ in },
                onRemove: { _ in }
            )
            StagedAttachmentStrip(
                items: Array(AttachmentFixtures.stagedStates.suffix(2)),
                onRetry: { _ in },
                onRemove: { _ in }
            )
            StagedAttachmentStrip(
                items: Array(AttachmentFixtures.stagedStates.prefix(5)),
                onRetry: { _ in },
                onRemove: { _ in }
            )
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: view, named: "attachment-strip-states")
        assertAccessibilitySnapshots(of: view, named: "attachment-strip-states")
    }

    @Test func transcriptCoversOneThroughFiveImagesFilesAndMixedContent() {
        let view = ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                ForEach(1...5, id: \.self) { count in
                    MessageAttachments(
                        attachments: (1...count).map { index in
                            AttachmentFixtures.imageUi(
                                id: "snapshot-\(count)-\(index)",
                                width: index.isMultiple(of: 2) ? 200 : 600,
                                height: index.isMultiple(of: 2) ? 600 : 300
                            )
                        },
                        author: "Sam Rivera"
                    )
                }
                MessageAttachments(
                    attachments: [
                        AttachmentFixtures.imageUi(id: "mixed-image"),
                        AttachmentFixtures.documentUi,
                    ],
                    author: "Sam Rivera"
                )
                MessageAttachments(
                    attachments: [unavailableImage, AttachmentFixtures.documentUi],
                    author: "Sam Rivera"
                )
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: view, named: "attachment-transcript-matrix")
        assertAccessibilitySnapshots(of: view, named: "attachment-transcript-matrix")
    }

    @Test func imageWithTextOptimisticFileAndViewerChrome() {
        let gallery = VStack(spacing: Spacing.lg) {
            MessageBubble(row: bubbleRow(
                id: "image-text",
                body: "Here is the worksheet we discussed.",
                attachments: [AttachmentFixtures.imageUi(id: "bubble-image")],
                direction: .incoming
            ))
            MessageBubble(row: bubbleRow(
                id: "optimistic",
                body: "",
                attachments: [MessageAttachmentUiModel(
                    attachment: AttachmentFixtures.document,
                    localPreviewUrl: AttachmentFixtures.pdfUrl,
                    isOptimistic: true
                )],
                direction: .outgoing
            ))
            AttachmentViewer(
                images: [
                    AttachmentFixtures.imageUi(id: "viewer-1"),
                    AttachmentFixtures.imageUi(id: "viewer-2", width: 300, height: 450),
                ],
                initialIndex: 0,
                author: "Sam Rivera"
            )
            .frame(height: 320)
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: gallery, named: "attachment-bubbles-viewer")
        assertAccessibilitySnapshots(of: gallery, named: "attachment-bubbles-viewer")
    }

    private var unavailableImage: MessageAttachmentUiModel {
        MessageAttachmentUiModel(attachment: ChatAttachment(
            id: "unavailable",
            kind: .image,
            originalName: "Photo",
            mimeType: "image/webp",
            byteSize: nil,
            width: 400,
            height: 300,
            displayPath: "c/unavailable/display.webp"
        ))
    }

    private func bubbleRow(
        id: String,
        body: String,
        attachments: [MessageAttachmentUiModel],
        direction: MessageDirection
    ) -> MessageRowUiModel {
        MessageRowUiModel(
            message: MessageUiModel(
                id: id,
                direction: direction,
                senderId: direction == .incoming ? "coach" : "client",
                senderName: "Sam Rivera",
                body: body,
                attachments: attachments,
                sentAt: Date(timeIntervalSince1970: 1_784_200_000),
                delivery: direction == .outgoing ? .sending : nil
            ),
            groupPosition: .solo,
            showsMeta: true,
            showsDeliveryStatus: direction == .outgoing
        )
    }
}
