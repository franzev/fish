import Foundation
import Testing
@testable import ChatData

struct AttachmentContractTests {
    private let attachment = ChatAttachment(
        id: "attachment-1",
        kind: .image,
        originalName: "Photo",
        mimeType: "image/webp",
        byteSize: 123_456,
        width: 800,
        height: 600,
        thumbnailPath: "conversation/attachment-1/thumbnail.webp",
        displayPath: "conversation/attachment-1/display.webp",
        thumbnailUrl: URL(string: "https://example.test/thumbnail")!,
        displayUrl: URL(string: "https://example.test/display")!
    )

    @Test func attachmentUsesTheExactSharedWireKeys() throws {
        let data = try JSONEncoder().encode(attachment)
        let object = try #require(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        #expect(Set(object.keys) == [
            "id", "status", "kind", "originalName", "mimeType", "byteSize",
            "width", "height", "thumbnailPath", "displayPath",
            "thumbnailUrl", "displayUrl",
        ])
        #expect(object["status"] as? String == "ready")
        #expect(try JSONDecoder().decode(ChatAttachment.self, from: data) == attachment)
    }

    @Test func unknownAttachmentKindsStayReadableAsFiles() throws {
        let data = Data(#"""
        {
          "id":"future-1","status":"ready","kind":"archive",
          "originalName":"notes.zip","displayPath":"c/future-1/file.zip"
        }
        """#.utf8)
        let decoded = try JSONDecoder().decode(ChatAttachment.self, from: data)
        #expect(decoded.kind == .file)
    }

    @Test func initializePayloadPinsWireKeysAndJpegStaging() throws {
        let request = InitializeAttachmentRequest(
            conversationId: "conversation-1",
            clientUploadId: "client-1",
            originalName: "Photo",
            sourceMimeType: "image/heic",
            sourceByteSize: 2_000_000,
            uploadMimeType: "image/jpeg",
            uploadSha256: String(repeating: "a", count: 64)
        )
        let data = try JSONEncoder().encode(request)
        let object = try #require(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        #expect(Set(object.keys) == [
            "action", "conversationId", "clientUploadId", "originalName",
            "sourceMimeType", "sourceByteSize", "uploadMimeType", "uploadSha256",
        ])
        #expect(object["action"] as? String == "initialize-upload")
        #expect(object["uploadMimeType"] as? String == "image/jpeg")
    }

    @Test func validationConstantsMatchTheSharedContract() {
        #expect(AttachmentRules.maxCount == 5)
        #expect(AttachmentRules.imageSourceMaxBytes == 25 * 1024 * 1024)
        #expect(AttachmentRules.documentSourceMaxBytes == 10 * 1024 * 1024)
        #expect(AttachmentRules.imagePreparedMaxBytes == 5 * 1024 * 1024)
        #expect(AttachmentRules.imageMaxDimension == 2_560)
        #expect(AttachmentRules.imageMimeTypes == [
            "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif",
        ])
        #expect(AttachmentRules.documentMimeTypes.count == 7)
        #expect(AttachmentRules.voiceMimeTypes == ["audio/mp4"])
    }

    @Test func validationReportsTypeSizeCountAndEmptyDataIndependently() {
        let valid = AttachmentCandidate(
            data: Data("hello".utf8),
            originalName: "notes.txt",
            sourceMimeType: "text/plain"
        )
        #expect(AttachmentRules.validate(valid, currentCount: 0) == nil)
        #expect(AttachmentRules.validate(valid, currentCount: 5) == .serverRejected("too_many_attachments"))
        #expect(AttachmentRules.validate(
            AttachmentCandidate(data: valid.data, originalName: "x", sourceMimeType: "application/zip"),
            currentCount: 0
        ) == .unsupportedType)
        #expect(AttachmentRules.validate(
            AttachmentCandidate(data: Data(), originalName: "notes.txt", sourceMimeType: "text/plain"),
            currentCount: 0
        ) == .preparationFailed)
        #expect(AttachmentRules.validate(
            AttachmentCandidate(
                data: Data(repeating: 1, count: AttachmentRules.documentSourceMaxBytes + 1),
                originalName: "notes.txt",
                sourceMimeType: "text/plain"
            ),
            currentCount: 0
        ) == .tooLarge)
    }

    @Test func sourceTypeUsesDeclarationThenMagicThenExtensionFallback() {
        #expect(AttachmentRules.sourceMimeType(
            declared: " IMAGE/JPEG ", filename: "Photo", data: Data([0xFF, 0xD8, 0xFF])
        ) == "image/jpeg")
        #expect(AttachmentRules.sourceMimeType(
            declared: nil, filename: "download", data: Data("%PDF-1.7".utf8)
        ) == "application/pdf")
        #expect(AttachmentRules.sourceMimeType(
            declared: nil, filename: "notes.CSV", data: Data("a,b".utf8)
        ) == "text/csv")
        #expect(AttachmentRules.sourceMimeType(
            declared: nil, filename: "archive.zip", data: Data([0, 1, 2])
        ) == nil)
    }

    @Test func byteSignaturesRejectMismatchesAndMacroArchives() {
        #expect(ByteSignature.matches(Data([0xFF, 0xD8, 0xFF, 0]), mimeType: "image/jpeg"))
        #expect(!ByteSignature.matches(Data("%PDF-1.7".utf8), mimeType: "image/jpeg"))
        #expect(ByteSignature.matches(Data("plain text".utf8), mimeType: "text/plain"))
        #expect(!ByteSignature.matches(Data([65, 0, 66]), mimeType: "text/plain"))

        let m4a = Data([
            0, 0, 0, 16, 102, 116, 121, 112, 77, 52, 65, 32, 0, 0, 0, 0,
            0, 0, 0, 12, 109, 111, 111, 118, 0, 0, 0, 0,
            0, 0, 0, 12, 109, 100, 97, 116, 0, 0, 0, 0,
        ])
        #expect(ByteSignature.matches(m4a, mimeType: "audio/mp4"))
        #expect(!ByteSignature.matches(Data([0, 1, 2]), mimeType: "audio/mp4"))

        let safeOffice = Data("PK\u{3}\u{4} [Content_Types].xml word/document.xml".utf8)
        let macroOffice = Data("PK\u{3}\u{4} [Content_Types].xml word/vbaProject.bin".utf8)
        let docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        #expect(ByteSignature.matches(safeOffice, mimeType: docx))
        #expect(!ByteSignature.matches(macroOffice, mimeType: docx))
    }

    @Test func reducerClampsProgressAndIgnoresEventsAfterRemoval() {
        var state = AttachmentUploadItemState(id: "item")
        state = AttachmentStateReducer.reduce(state, .staged)
        state = AttachmentStateReducer.reduce(state, .preparationStarted)
        state = AttachmentStateReducer.reduce(state, .initialized)
        state = AttachmentStateReducer.reduce(state, .uploadProgress(2))
        #expect(state.phase == .uploading(1))
        state = AttachmentStateReducer.reduce(state, .completionStarted(position: 0, total: 0))
        #expect(state.phase == .completing(position: 1, total: 1))
        state = AttachmentStateReducer.reduce(state, .completed(attachment))
        #expect(state.phase == .ready(attachment))
        state = AttachmentStateReducer.reduce(state, .remove)
        #expect(state.phase == .removed)
        #expect(AttachmentStateReducer.reduce(state, .retry).phase == .removed)
    }

    @Test func reducerAllowsFailedItemsToRestartFromStaging() {
        var state = AttachmentUploadItemState(id: "item")
        state = AttachmentStateReducer.reduce(state, .failed(.offline))
        #expect(state.phase == .failed(.offline))
        #expect(AttachmentStateReducer.reduce(state, .retry).phase == .staging)
        #expect(AttachmentFailureReason.offline.isTransient)
        #expect(AttachmentFailureReason.serverRejected("scan_unavailable").isTransient)
        #expect(!AttachmentFailureReason.rateLimited.isTransient)
    }

    @Test func reducerReplaysPortableJsonVectors() throws {
        let url = try #require(Bundle.module.url(
            forResource: "attachment-upload-state-vectors",
            withExtension: "json",
            subdirectory: "Fixtures"
        ) ?? Bundle.module.url(
            forResource: "attachment-upload-state-vectors",
            withExtension: "json"
        ))
        let vectors = try JSONDecoder().decode(
            [AttachmentStateVector].self,
            from: Data(contentsOf: url)
        )
        #expect(vectors.count >= 4)
        for vector in vectors {
            var state = AttachmentUploadItemState(id: vector.name)
            for event in vector.events {
                state = AttachmentStateReducer.reduce(state, event.domain(attachment: attachment))
            }
            #expect(describe(state.phase) == vector.expected, Comment(rawValue: vector.name))
        }
    }

    private func describe(_ phase: AttachmentUploadPhase) -> String {
        switch phase {
        case .picked: "picked"
        case .staging: "staging"
        case .preparing: "preparing"
        case .initializing: "initializing"
        case .uploading(let progress): "uploading:\(progress)"
        case .completing(let position, let total): "completing:\(position)/\(total)"
        case .ready(let attachment): "ready:\(attachment.id)"
        case .failed(.offline): "failed:offline"
        case .failed: "failed:other"
        case .removed: "removed"
        }
    }
}

private struct AttachmentStateVector: Decodable {
    let name: String
    let events: [AttachmentStateVectorEvent]
    let expected: String
}

private struct AttachmentStateVectorEvent: Decodable {
    let type: String
    let value: Double?
    let position: Int?
    let total: Int?
    let reason: String?

    func domain(attachment: ChatAttachment) -> AttachmentUploadEvent {
        switch type {
        case "staged": .staged
        case "preparationStarted": .preparationStarted
        case "initialized": .initialized
        case "uploadProgress": .uploadProgress(value ?? 0)
        case "completionStarted": .completionStarted(
            position: position ?? 1,
            total: total ?? 1
        )
        case "completed": .completed(attachment)
        case "failed": .failed(reason == "offline" ? .offline : .preparationFailed)
        case "retry": .retry
        case "remove": .remove
        default: .failed(.serverRejected("unknown_vector_event"))
        }
    }
}
