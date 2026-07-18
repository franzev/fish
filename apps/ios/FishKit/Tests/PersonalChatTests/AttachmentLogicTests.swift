import ChatData
import DesignSystem
import Foundation
import Testing
import TestSupport
@testable import PersonalChat

struct AttachmentLogicTests {
    @Test func multiImageLayoutClampsAspectRatiosAndWrapsPredictably() {
        #expect(AttachmentLayout.clampedAspectRatio(0.1) == CGFloat(2) / 3)
        #expect(AttachmentLayout.clampedAspectRatio(9) == 2)
        let frames = AttachmentLayout.frames(
            aspectRatios: [0.1, 9, 1, 1, 1],
            containerWidth: 300
        )
        #expect(frames.count == 5)
        #expect(frames.allSatisfy { $0.width <= 300 && $0.height <= Metrics.attachmentBubbleTile })
        #expect(frames[1].minY > frames[0].minY)
        #expect(frames[4].maxY > frames[1].maxY)
    }

    @Test func singleImageKeepsItsAspectWithinTheLargeTileBounds() {
        let wide = try! #require(AttachmentLayout.frames(
            aspectRatios: [4], containerWidth: 320
        ).first)
        #expect(wide.width == Metrics.attachmentSingleMaxWidth)
        #expect(wide.height == Metrics.attachmentSingleMaxWidth / 4)

        let tall = try! #require(AttachmentLayout.frames(
            aspectRatios: [0.25], containerWidth: 320
        ).first)
        #expect(tall.height == Metrics.attachmentSingleMaxWidth)
        #expect(tall.width == Metrics.attachmentSingleMaxWidth * 0.25)
    }

    @Test func sendGatingRequiresEveryAttachmentReadyAndNoCompetingMedia() {
        let ready = StagedAttachment(
            id: "ready",
            status: .ready,
            attachmentId: "a1",
            readyAttachment: AttachmentFixtures.image
        )
        let uploading = StagedAttachment(id: "uploading", status: .uploading)
        let failed = StagedAttachment(id: "failed", status: .failed(.offline))

        #expect(MediaSelectionRules.isSendable(
            draft: "", selection: .none, stagedAttachments: [ready], connectionReady: true
        ))
        #expect(MediaSelectionRules.isSendable(
            draft: "Caption", selection: .none, stagedAttachments: [ready], connectionReady: true
        ))
        #expect(!MediaSelectionRules.isSendable(
            draft: "Caption", selection: .none, stagedAttachments: [uploading], connectionReady: true
        ))
        #expect(!MediaSelectionRules.isSendable(
            draft: "Caption", selection: .none, stagedAttachments: [failed], connectionReady: true
        ))
        #expect(!MediaSelectionRules.isSendable(
            draft: "", selection: PersonalChatFixtures.stagedSticker,
            stagedAttachments: [ready], connectionReady: true
        ))
        #expect(!MediaSelectionRules.isSendable(
            draft: "", selection: .none, stagedAttachments: [ready], connectionReady: false
        ))
    }

    @Test func accessibilityDescribesEveryUploadStateAndMixedMessages() {
        let labels = AttachmentFixtures.stagedStates.map(AttachmentAccessibility.tileLabel)
        #expect(labels.contains("Photo, loading"))
        #expect(labels.contains(where: { $0.contains("uploading 61 percent") }))
        #expect(labels.contains(where: { $0.contains("ready to send") }))
        #expect(labels.contains(where: { $0.contains("didn't finish") }))
        #expect(AttachmentAccessibility.messageDescription([
            AttachmentFixtures.imageUi,
            AttachmentFixtures.documentUi,
        ])?.contains("1 photo. Quarterly coaching notes") == true)
        #expect(AttachmentAccessibility.fileTypeLabel("application/pdf") == "PDF")
        #expect(AttachmentAccessibility.fileTypeLabel("application/octet-stream") == "File")
    }

    @Test func messageAccessibilityWeavesAttachmentsBeforeTheBody() {
        let message = MessageUiModel(
            id: "m1",
            direction: .incoming,
            senderId: "coach",
            senderName: "Sam Rivera",
            body: "Please review these.",
            attachments: [AttachmentFixtures.imageUi, AttachmentFixtures.documentUi],
            sentAt: Date(timeIntervalSince1970: 1_752_600_000)
        )
        let label = MessageAccessibility.label(
            for: MessageRowUiModel(
                message: message,
                groupPosition: .solo,
                showsMeta: true,
                showsDeliveryStatus: false
            ),
            locale: Locale(identifier: "en_US"),
            timeZone: TimeZone(identifier: "UTC")!
        )
        #expect(label.contains("1 photo"))
        #expect(label.contains("Quarterly coaching notes"))
        #expect(label.contains("Please review these"))
    }
}
