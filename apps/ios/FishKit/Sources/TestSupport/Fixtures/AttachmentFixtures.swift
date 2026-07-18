import ChatData
import Foundation
import PersonalChat

public enum AttachmentFixtures {
    public static var imageUrl: URL {
        Bundle.module.url(forResource: "poster-otter-wave", withExtension: "png")!
    }

    public static var pdfUrl: URL {
        Bundle.module.url(forResource: "sample", withExtension: "pdf", subdirectory: "Attachments")
            ?? Bundle.module.url(forResource: "sample", withExtension: "pdf")!
    }

    public static let image = ChatAttachment(
        id: "attachment-image-1",
        kind: .image,
        originalName: "Photo",
        mimeType: "image/webp",
        byteSize: 182_400,
        width: 400,
        height: 300,
        thumbnailPath: "conversation/attachment-image-1/thumbnail.webp",
        displayPath: "conversation/attachment-image-1/display.webp"
    )

    public static let portraitImage = ChatAttachment(
        id: "attachment-image-2",
        kind: .image,
        originalName: "Photo",
        mimeType: "image/webp",
        byteSize: 152_800,
        width: 300,
        height: 450,
        thumbnailPath: "conversation/attachment-image-2/thumbnail.webp",
        displayPath: "conversation/attachment-image-2/display.webp"
    )

    public static let document = ChatAttachment(
        id: "attachment-file-1",
        kind: .file,
        originalName: "Quarterly coaching notes with a long filename.pdf",
        mimeType: "application/pdf",
        byteSize: 2_100_000,
        displayPath: "conversation/attachment-file-1/file.pdf"
    )

    public static var imageUi: MessageAttachmentUiModel {
        MessageAttachmentUiModel(attachment: image, localPreviewUrl: imageUrl)
    }

    public static func imageUi(
        id: String,
        width: Int = 400,
        height: Int = 300
    ) -> MessageAttachmentUiModel {
        MessageAttachmentUiModel(
            attachment: ChatAttachment(
                id: id,
                kind: .image,
                originalName: "Photo",
                mimeType: "image/webp",
                byteSize: 182_400,
                width: width,
                height: height,
                thumbnailPath: "conversation/\(id)/thumbnail.webp",
                displayPath: "conversation/\(id)/display.webp"
            ),
            localPreviewUrl: imageUrl
        )
    }

    public static var portraitImageUi: MessageAttachmentUiModel {
        MessageAttachmentUiModel(attachment: portraitImage, localPreviewUrl: imageUrl)
    }

    public static var documentUi: MessageAttachmentUiModel {
        MessageAttachmentUiModel(attachment: document, localPreviewUrl: pdfUrl)
    }

    public static var stagedStates: [StagedAttachment] {
        [
            StagedAttachment(id: "loading", originalName: "Photo", status: .loading),
            StagedAttachment(
                id: "preparing",
                originalName: "Photo",
                localUrl: imageUrl,
                progress: 0.12,
                status: .preparing
            ),
            StagedAttachment(
                id: "uploading",
                originalName: "Photo",
                localUrl: imageUrl,
                progress: 0.61,
                status: .uploading
            ),
            StagedAttachment(
                id: "finishing",
                originalName: "Photo",
                localUrl: imageUrl,
                progress: 0.94,
                status: .finishing(queuePosition: 2)
            ),
            StagedAttachment(
                id: "ready",
                originalName: "Photo",
                localUrl: imageUrl,
                progress: 1,
                status: .ready,
                attachmentId: image.id,
                readyAttachment: image
            ),
            StagedAttachment(
                id: "failed",
                originalName: "Coaching notes.pdf",
                kind: .file,
                sourceMimeType: "application/pdf",
                localUrl: pdfUrl,
                progress: 0.4,
                status: .failed(.offline),
                notice: "That attachment did not finish yet. Try again."
            ),
        ]
    }
}
