import ChatData
import DesignSystem
import SwiftUI
import UIComponents

public struct AttachmentViewer: View {
    private let images: [MessageAttachmentUiModel]
    private let author: String
    private let loader: MessageImageLoader
    private let commands: (any AttachmentCommandProviding)?
    private let downloader: AttachmentFileDownloader

    @Environment(\.dismiss) private var dismiss
    @Environment(\.fishReduceMotion) private var reduceMotion
    @State private var selection: Int
    @State private var isPreparingShare = false
    @State private var shareUrl: URL?
    @State private var shareFileIsTemporary = false
    @State private var showsShareSheet = false
    @State private var shareNotice: String?

    public init(
        images: [MessageAttachmentUiModel],
        initialIndex: Int,
        author: String,
        loader: MessageImageLoader = .shared,
        commands: (any AttachmentCommandProviding)? = nil,
        downloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.images = images
        self.author = author
        self.loader = loader
        self.commands = commands
        self.downloader = downloader
        _selection = State(initialValue: min(max(0, initialIndex), max(0, images.count - 1)))
    }

    public var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            if images.isEmpty {
                Text("Image unavailable")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
            } else {
                TabView(selection: $selection) {
                    ForEach(Array(images.enumerated()), id: \.element.id) { index, image in
                        ZoomableAttachmentImage(
                            attachment: image,
                            loader: loader,
                            commands: commands
                        )
                        .tag(index)
                        .accessibilityLabel(
                            "Image \(index + 1) of \(images.count), shared by \(author)"
                        )
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(
                    Motion.animation(MotionDuration.message, reduceMotion: reduceMotion),
                    value: selection
                )
                .accessibilityAdjustableAction { direction in
                    switch direction {
                    case .increment: selection = min(images.count - 1, selection + 1)
                    case .decrement: selection = max(0, selection - 1)
                    @unknown default: break
                    }
                }
            }
        }
        .safeAreaInset(edge: .top) {
            HStack(spacing: Spacing.xs) {
                if currentImage != nil {
                    IconButton(
                        .share,
                        accessibilityLabel: isPreparingShare ? "Preparing image to share" : "Share image",
                        isBusy: isPreparingShare
                    ) {
                        Task { await prepareShare() }
                    }
                }
                Spacer()
                IconButton(.close, accessibilityLabel: "Close image") { dismiss() }
            }
            .padding(.horizontal, Spacing.page)
            .background(Palette.bg)
        }
        .sheet(isPresented: $showsShareSheet, onDismiss: clearShareFile) {
            if let shareUrl {
                AttachmentActivitySheet(item: shareUrl)
            }
        }
        .alert(
            "Image not ready to share",
            isPresented: Binding(
                get: { shareNotice != nil },
                set: { if !$0 { shareNotice = nil } }
            )
        ) {
            Button("OK") { shareNotice = nil }
        } message: {
            Text(shareNotice ?? "Try again in a moment.")
        }
        .safeAreaInset(edge: .bottom) {
            if images.count > 1 {
                HStack(spacing: Spacing.md) {
                    IconButton(.chevronLeft, accessibilityLabel: "Previous image") {
                        selection = max(0, selection - 1)
                    }
                    .disabled(selection == 0)
                    Text("\(selection + 1) of \(images.count)")
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                        .environment(\.layoutDirection, .leftToRight)
                    IconButton(.chevronRight, accessibilityLabel: "Next image") {
                        selection = min(images.count - 1, selection + 1)
                    }
                    .disabled(selection == images.count - 1)
                }
                .padding(.vertical, Spacing.xs)
                .frame(maxWidth: .infinity)
                .background(Palette.bg)
            }
        }
    }

    private var currentImage: MessageAttachmentUiModel? {
        guard images.indices.contains(selection) else { return nil }
        return images[selection]
    }

    private func prepareShare() async {
        guard let currentImage, !isPreparingShare else { return }
        isPreparingShare = true
        defer { isPreparingShare = false }
        do {
            shareUrl = try await downloader.download(currentImage)
            shareFileIsTemporary = currentImage.localPreviewUrl != shareUrl
            showsShareSheet = true
        } catch {
            shareUrl = nil
            shareFileIsTemporary = false
            shareNotice = "Try again in a moment."
        }
    }

    private func clearShareFile() {
        guard let shareUrl else { return }
        if shareFileIsTemporary {
            try? FileManager.default.removeItem(at: shareUrl)
        }
        self.shareUrl = nil
        shareFileIsTemporary = false
    }
}

private struct ZoomableAttachmentImage: View {
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
