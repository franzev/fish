import ChatData
import Foundation

public enum AttachmentAccessibility {
    public static func tileLabel(_ item: StagedAttachment) -> String {
        let name = item.sourceMimeType == "audio/mp4"
            ? "Voice message"
            : (item.originalName.isEmpty ? "Photo" : item.originalName)
        return switch item.status {
        case .loading: "\(name), loading"
        case .preparing: "\(name), preparing"
        case .uploading: "\(name), uploading \(Int(item.progress * 100)) percent"
        case .finishing: "\(name), finishing"
        case .ready: "\(name), ready to send"
        case .failed: "\(name), didn't finish"
        }
    }

    public static func messageDescription(
        _ attachments: [MessageAttachmentUiModel]
    ) -> String? {
        guard !attachments.isEmpty else { return nil }
        let photos = attachments.filter { $0.kind == .image }.count
        let voices = attachments.filter(\.isVoiceMessage)
        let videos = attachments.filter(\.isVideoAttachment)
        let files = attachments.filter { $0.kind == .file && !$0.isVoiceMessage && !$0.isVideoAttachment }
        var parts: [String] = []
        if photos > 0 { parts.append("\(photos) \(photos == 1 ? "photo" : "photos")") }
        if !voices.isEmpty {
            parts.append(contentsOf: voices.map {
                "\($0.originalName), voice message, \(formattedByteSize($0.byteSize))"
            })
        }
        parts.append(contentsOf: videos.map {
            "\($0.originalName), video, \(formattedByteSize($0.byteSize))"
        })
        parts.append(contentsOf: files.map {
            "\($0.originalName), \(fileTypeLabel($0.mimeType)), \(formattedByteSize($0.byteSize))"
        })
        return parts.joined(separator: ". ")
    }

    public static func fileTypeLabel(_ mimeType: String?) -> String {
        switch mimeType {
        case "audio/mp4": "Voice message"
        case "video/mp4": "Video"
        case "application/pdf": "PDF"
        case "text/plain": "Text file"
        case "text/csv": "CSV"
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            "Word document"
        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            "Excel workbook"
        case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            "PowerPoint presentation"
        default: "File"
        }
    }

    public static func formattedByteSize(_ size: Int?) -> String {
        guard let size, size >= 0 else { return "Size unavailable" }
        return ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file)
    }
}
