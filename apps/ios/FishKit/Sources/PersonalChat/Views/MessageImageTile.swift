import ChatData
import DesignSystem
import SwiftUI
import UIComponents

public struct MessageImageTile: View {
    private let attachment: MessageAttachmentUiModel
    private let author: String
    private let loader: MessageImageLoader
    private let commands: (any AttachmentCommandProviding)?
    private let onOpen: () -> Void

    @Environment(\.fishReduceMotion) private var reduceMotion
    @Environment(\.displayScale) private var displayScale
    @State private var thumbnail: UIImage?
    @State private var display: UIImage?
    @State private var failed = false
    @State private var reloadId = 0

    public init(
        attachment: MessageAttachmentUiModel,
        author: String,
        loader: MessageImageLoader = .shared,
        commands: (any AttachmentCommandProviding)? = nil,
        onOpen: @escaping () -> Void
    ) {
        self.attachment = attachment
        self.author = author
        self.loader = loader
        self.commands = commands
        self.onOpen = onOpen
    }

    public var body: some View {
        GeometryReader { geometry in
            ZStack {
                Button(action: onOpen) {
                    imageLayers
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(failed)
                .accessibilityLabel("Image shared by \(author)")
                if failed {
                    VStack(spacing: Spacing.xs) {
                        Text("Image unavailable")
                            .textStyle(.caption)
                            .foregroundStyle(Palette.body)
                        ActionButton("Try again", variant: .link) {
                            failed = false
                            reloadId += 1
                        }
                    }
                }
            }
            .task(id: reloadId) {
                await load(targetSize: geometry.size)
            }
        }
        .background(Palette.surface2)
        .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
    }

    @ViewBuilder private var imageLayers: some View {
        ZStack {
            Palette.surface2
            if let thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .scaledToFill()
                    .blur(radius: display == nil ? Spacing.twoXs : 0)
            }
            if let display {
                Image(uiImage: display)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            }
        }
    }

    private func load(targetSize: CGSize) async {
        failed = false
        let pixels = CGSize(
            width: targetSize.width * displayScale,
            height: targetSize.height * displayScale
        )
        do {
            if let local = attachment.localPreviewUrl {
                do {
                    display = try await loader.image(
                        storagePath: "local:\(attachment.id)",
                        url: local,
                        attachmentId: attachment.id,
                        targetPixelSize: pixels,
                        commands: commands
                    )
                    return
                } catch is CancellationError {
                    return
                } catch {
                    // Optimistic previews are short-lived. Continue with the
                    // immutable remote object after local staging is swept.
                }
            }
            if let path = attachment.thumbnailPath,
               let url = attachment.thumbnailUrl {
                thumbnail = try? await loader.image(
                    storagePath: path,
                    url: url,
                    attachmentId: attachment.id,
                    targetPixelSize: pixels,
                    commands: commands
                )
            }
            guard let url = attachment.displayUrl else {
                failed = true
                return
            }
            let loaded = try await loader.image(
                storagePath: attachment.displayPath,
                url: url,
                attachmentId: attachment.id,
                targetPixelSize: pixels,
                commands: commands
            )
            withAnimation(Motion.animation(MotionDuration.fade, reduceMotion: reduceMotion)) {
                display = loaded
            }
        } catch is CancellationError {
            return
        } catch {
            failed = true
        }
    }
}
