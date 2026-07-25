import ChatData
import DesignSystem
import SwiftUI
import UIComponents

struct ZoomableAttachmentImage: View {
    let attachment: MessageAttachmentUiModel
    let loader: MessageImageLoader
    let commands: (any AttachmentCommandProviding)?

    @Environment(\.displayScale) private var displayScale
    @State private var image: UIImage?
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var failed = false
    @State private var reloadId = 0

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .scaleEffect(scale)
                        .gesture(MagnifyGesture()
                            .onChanged { value in
                                scale = min(4, max(1, lastScale * value.magnification))
                            }
                            .onEnded { _ in lastScale = scale }
                        )
                } else if failed {
                    VStack(spacing: Spacing.xs) {
                        Text("Image unavailable")
                            .textStyle(.body)
                            .foregroundStyle(Palette.body)
                        ActionButton("Try again", variant: .link) {
                            failed = false
                            reloadId += 1
                        }
                    }
                } else {
                    ProgressView()
                        .accessibilityLabel("Loading image")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .task(id: reloadId) {
                await load(size: geometry.size)
            }
        }
    }

    private func load(size: CGSize) async {
        do {
            let pixels = CGSize(
                width: size.width * displayScale,
                height: size.height * displayScale
            )
            if let local = attachment.localPreviewUrl {
                do {
                    image = try await loader.image(
                        storagePath: "viewer-local:\(attachment.id)",
                        url: local,
                        attachmentId: attachment.id,
                        targetPixelSize: pixels,
                        commands: commands
                    )
                    return
                } catch is CancellationError {
                    return
                } catch {
                    // Fall through after the optimistic preview expires.
                }
            }
            guard let url = attachment.displayUrl else { failed = true; return }
            image = try await loader.image(
                storagePath: attachment.displayPath,
                url: url,
                attachmentId: attachment.id,
                targetPixelSize: pixels,
                commands: commands
            )
        } catch is CancellationError {
            return
        } catch {
            failed = true
        }
    }
}
