import ChatData
import DesignSystem
import SwiftUI

public struct MessageAttachments: View {
    private let attachments: [MessageAttachmentUiModel]
    private let author: String
    private let loader: MessageImageLoader
    private let commands: (any AttachmentCommandProviding)?
    private let downloader: AttachmentFileDownloader
    @State private var selectedImageIndex: Int?

    public init(
        attachments: [MessageAttachmentUiModel],
        author: String,
        loader: MessageImageLoader = .shared,
        commands: (any AttachmentCommandProviding)? = nil,
        downloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.attachments = attachments
        self.author = author
        self.loader = loader
        self.commands = commands
        self.downloader = downloader
    }

    private var images: [MessageAttachmentUiModel] {
        attachments.filter { $0.kind == .image }
    }

    private var files: [MessageAttachmentUiModel] {
        attachments.filter { $0.kind == .file }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.twoXs) {
            if !images.isEmpty {
                AttachmentFlowLayout {
                    ForEach(Array(images.enumerated()), id: \.element.id) { index, image in
                        MessageImageTile(
                            attachment: image,
                            author: author,
                            loader: loader,
                            commands: commands
                        ) {
                            selectedImageIndex = index
                        }
                        .layoutValue(key: AttachmentAspectLayoutKey.self, value: image.aspectRatio)
                    }
                }
            }
            ForEach(files) { file in
                MessageFileCard(attachment: file, downloader: downloader)
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { selectedImageIndex != nil },
            set: { if !$0 { selectedImageIndex = nil } }
        )) {
            AttachmentViewer(
                images: images,
                initialIndex: selectedImageIndex ?? 0,
                author: author,
                loader: loader,
                commands: commands,
                downloader: downloader
            )
        }
    }
}
