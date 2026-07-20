import ChatData
import CoreTransferable
import DesignSystem
import PhotosUI
import SwiftUI
import UIComponents
import UniformTypeIdentifiers

public enum ComposerSendState: Sendable, Equatable {
    case ready
    case sending
    case offline
}

/// The chat's single primary action. Blank and offline drafts expose no send
/// affordance; sending preserves a busy control even after the draft clears.
/// One expression trigger stages a GIF or sticker beside the draft — a staged
/// sticker replaces the trigger in place, a staged GIF previews above the
/// field, and either combines with text.
public struct MessageComposer: View {
    @Binding private var draft: String
    @Binding private var selection: ComposerSelection
    private let sendState: ComposerSendState
    private let onSend: () -> Void
    private let onOpenMediaPicker: () -> Void
    private let attachmentUploads: AttachmentUploadsModel?
    private let attachmentsDisabled: Bool
    private let context: ComposerContextUiModel?
    private let onCancelContext: () -> Void
    private let onFocusChanged: (Bool) -> Void
    private let onVoiceRecorded: (AttachmentCandidate) -> Void

    @State private var showsAttachmentMenu = false
    @State private var showsPhotoPicker = false
    @State private var showsFileImporter = false
    @State private var photoItems: [PhotosPickerItem] = []
    @FocusState private var isMessageFocused: Bool
    @State private var voiceRecorder = VoiceMessageRecorder()

    public init(
        draft: Binding<String>,
        selection: Binding<ComposerSelection>,
        sendState: ComposerSendState,
        attachmentUploads: AttachmentUploadsModel? = nil,
        attachmentsDisabled: Bool = false,
        context: ComposerContextUiModel? = nil,
        onCancelContext: @escaping () -> Void = {},
        onFocusChanged: @escaping (Bool) -> Void = { _ in },
        onVoiceRecorded: @escaping (AttachmentCandidate) -> Void = { _ in },
        onSend: @escaping () -> Void,
        onOpenMediaPicker: @escaping () -> Void
    ) {
        self._draft = draft
        self._selection = selection
        self.sendState = sendState
        self.attachmentUploads = attachmentUploads
        self.attachmentsDisabled = attachmentsDisabled
        self.context = context
        self.onCancelContext = onCancelContext
        self.onFocusChanged = onFocusChanged
        self.onVoiceRecorded = onVoiceRecorded
        self.onSend = onSend
        self.onOpenMediaPicker = onOpenMediaPicker
    }

    nonisolated static func showsSend(
        draft: String,
        selection: ComposerSelection,
        sendState: ComposerSendState,
        stagedAttachments: [StagedAttachment] = []
    ) -> Bool {
        if sendState == .sending { return true }
        if sendState == .offline { return false }
        return MediaSelectionRules.isSendable(
            draft: draft,
            selection: selection,
            stagedAttachments: stagedAttachments,
            connectionReady: true
        )
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.twoXs) {
            if let context {
                composerContext(context)
            }
            Text("Message")
                .textStyle(.label)
                .foregroundStyle(Palette.muted)
            if let gif = selection.stagedGif {
                GifSelectionPreview(gif: gif) {
                    selection = .none
                }
            }
            if let attachmentUploads, !attachmentUploads.items.isEmpty {
                StagedAttachmentStrip(
                    items: attachmentUploads.items,
                    onRetry: { attachmentUploads.retry($0) },
                    onRemove: attachmentUploads.remove
                )
            }
            HStack(alignment: .bottom, spacing: Spacing.xs) {
                if let attachmentUploads {
                    IconButton(
                        .paperclip,
                        accessibilityLabel: "Add to message"
                    ) {
                        showsAttachmentMenu = true
                    }
                    .disabled(
                        attachmentsDisabled
                            || !attachmentUploads.canAdd
                            || selection != .none
                    )
                }
                if let sticker = selection.stagedSticker {
                    StickerSelectionThumbnail(sticker: sticker) {
                        selection = .none
                    }
                } else {
                    IconButton(
                        .moodSmile,
                        accessibilityLabel: MediaAccessibility.triggerLabel,
                        action: onOpenMediaPicker
                    )
                }
                TextField("", text: $draft, axis: .vertical)
                    .focused($isMessageFocused)
                    .textInputStyle(.body)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1...6)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.compact)
                    .background(Palette.surface)
                    .clipShape(RoundedRectangle(
                        cornerRadius: Radius.control,
                        style: .continuous
                    ))
                    .overlay {
                        RoundedRectangle(
                            cornerRadius: Radius.control,
                            style: .continuous
                        )
                        .strokeBorder(Palette.border, lineWidth: 1)
                    }
                    .accessibilityLabel("Message")
                    .onChange(of: isMessageFocused) { _, focused in
                        onFocusChanged(focused)
                    }
                if Self.showsSend(
                    draft: draft,
                    selection: selection,
                    sendState: sendState,
                    stagedAttachments: attachmentUploads?.items ?? []
                ) {
                    IconButton(
                        .send,
                        style: .solid,
                        accessibilityLabel: "Send message",
                        isBusy: sendState == .sending
                    ) {
                        guard MediaSelectionRules.isSendable(
                            draft: draft,
                            selection: selection,
                            stagedAttachments: attachmentUploads?.items ?? [],
                            connectionReady: sendState != .offline
                        ) else { return }
                        onSend()
                    }
                } else if canRecordVoice {
                    VoiceRecordingControl(
                        recorder: voiceRecorder,
                        onRecord: onVoiceRecorded
                    )
                }
            }
            if let notice = attachmentUploads?.notice {
                Text(notice)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.notice)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let notice = voiceRecorder.notice {
                Text(notice)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.notice)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let guidance = attachmentUploads?.sendGuidance {
                Text(guidance)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.notice)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let guidance = ChatRules.counterGuidance(draft) {
                Text(guidance)
                    .textStyle(.caption)
                    .foregroundStyle(
                        draft.count > ChatRules.maxMessageLength
                            ? Palette.error
                            : Palette.muted
                    )
                    .fixedSize(horizontal: false, vertical: true)
            }
            if sendState == .offline {
                Text(
                    "You're offline. Your draft is saved and will be ready to send when you reconnect."
                )
                .textStyle(.caption)
                .foregroundStyle(Palette.notice)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, Spacing.page)
        .padding(.vertical, Spacing.xs)
        .background(Palette.bg)
        .confirmationDialog(
            "Add to message",
            isPresented: $showsAttachmentMenu,
            titleVisibility: .visible
        ) {
            Button("Photo library") { showsPhotoPicker = true }
            Button("File") { showsFileImporter = true }
            Button("Cancel", role: .cancel) {}
        }
        .photosPicker(
            isPresented: $showsPhotoPicker,
            selection: $photoItems,
            maxSelectionCount: availableAttachmentSlots,
            selectionBehavior: .ordered,
            matching: .images,
            preferredItemEncoding: .current
        )
        .onChange(of: photoItems) { _, selected in
            guard !selected.isEmpty else { return }
            loadPhotos(selected)
            photoItems = []
        }
        .fileImporter(
            isPresented: $showsFileImporter,
            allowedContentTypes: Self.documentTypes,
            allowsMultipleSelection: true
        ) { result in
            importDocuments(result)
        }
        .onChange(of: canRecordVoice) { _, available in
            if !available { voiceRecorder.cancel() }
        }
        .onDisappear { voiceRecorder.cancel() }
    }

    private func composerContext(_ context: ComposerContextUiModel) -> some View {
        HStack(alignment: .top, spacing: Spacing.xs) {
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                switch context {
                case .reply(let authorName, let snippet):
                    Text("Replying to \(authorName)")
                        .textStyle(.label)
                        .foregroundStyle(Palette.foreground)
                    Text(snippet)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(2)
                case .edit:
                    Text("Editing message")
                        .textStyle(.label)
                        .foregroundStyle(Palette.foreground)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            IconButton(.close, accessibilityLabel: "Cancel") {
                onCancelContext()
            }
        }
        .padding(Spacing.xs)
        .background(
            Palette.surface2,
            in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
        )
    }

    private var availableAttachmentSlots: Int {
        max(1, AttachmentRules.maxCount - (attachmentUploads?.items.count ?? 0))
    }

    private var canRecordVoice: Bool {
        guard attachmentUploads != nil,
              sendState == .ready,
              draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              selection == .none,
              attachmentUploads?.items.isEmpty == true
        else { return false }
        if case .edit = context { return false }
        return true
    }

    private func loadPhotos(_ selected: [PhotosPickerItem]) {
        guard let attachmentUploads else { return }
        let reservations = selected.compactMap { _ in
            attachmentUploads.reserveLoadingItem()
        }
        Task {
            for (item, id) in zip(selected, reservations) {
                do {
                    guard let transfer = try await item.loadTransferable(
                        type: AttachmentPhotoTransfer.self
                    ) else {
                        attachmentUploads.failLoadingItem(id)
                        continue
                    }
                    let mimeType = ByteSignature.detectedMimeType(transfer.data) ?? "image/jpeg"
                    attachmentUploads.fulfillLoadingItem(
                        id,
                        with: AttachmentCandidate(
                            data: transfer.data,
                            originalName: "Photo",
                            sourceMimeType: mimeType
                        )
                    )
                } catch {
                    attachmentUploads.failLoadingItem(id)
                }
            }
        }
    }

    private func importDocuments(_ result: Result<[URL], any Error>) {
        guard let attachmentUploads, case .success(let urls) = result else { return }
        let available = max(0, AttachmentRules.maxCount - attachmentUploads.items.count)
        let selected = Array(urls.prefix(available))
        let excess = max(0, urls.count - selected.count)
        Task {
            let results = await Task.detached(priority: .userInitiated) {
                selected.map(Self.documentCandidate)
            }.value
            attachmentUploads.add(
                results.compactMap { result in
                    guard case .candidate(let candidate) = result else { return nil }
                    return candidate
                },
                admissionFailures: results.compactMap { result in
                    guard case .failure(let failure) = result else { return nil }
                    return failure
                } + Array(
                    repeating: .serverRejected("too_many_attachments"),
                    count: excess
                )
            )
        }
    }

    private nonisolated static func documentCandidate(_ url: URL) -> DocumentImportResult {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        let values = try? url.resourceValues(forKeys: [.contentTypeKey, .nameKey])
        if let byteSize = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize,
           byteSize > AttachmentRules.documentSourceMaxBytes {
            return .failure(.tooLarge)
        }
        guard let data = try? Data(contentsOf: url, options: .mappedIfSafe) else {
            return .failure(.preparationFailed)
        }
        guard data.count <= AttachmentRules.documentSourceMaxBytes else {
            return .failure(.tooLarge)
        }
        let name = values?.name ?? url.lastPathComponent
        guard let mimeType = AttachmentRules.sourceMimeType(
            declared: values?.contentType?.preferredMIMEType,
            filename: name,
            data: data
        ) else { return .failure(.unsupportedType) }
        return .candidate(AttachmentCandidate(
            data: data,
            originalName: name,
            sourceMimeType: mimeType
        ))
    }

    private static let documentTypes: [UTType] = [
        .pdf,
        .plainText,
        .commaSeparatedText,
    ] + ["docx", "xlsx", "pptx"].compactMap {
        UTType(filenameExtension: $0)
    }
}

private enum DocumentImportResult: Sendable {
    case candidate(AttachmentCandidate)
    case failure(AttachmentFailureReason)
}

private struct AttachmentPhotoTransfer: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { data in
            Self(data: data)
        }
    }
}
