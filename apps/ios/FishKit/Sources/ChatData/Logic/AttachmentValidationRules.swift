import Foundation

public enum AttachmentRules {
    public static let maxCount = 5
    public static let imageSourceMaxBytes = 25 * 1024 * 1024
    public static let videoSourceMaxBytes = 25 * 1024 * 1024
    public static let documentSourceMaxBytes = 10 * 1024 * 1024
    public static let imagePreparedMaxBytes = 5 * 1024 * 1024
    public static let imageMaxDimension = 2_560
    public static let jpegQuality = 0.8

    public static let imageMimeTypes: Set<String> = [
        "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif",
    ]

    public static let documentMimeTypes: Set<String> = [
        "audio/mp4",
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]

    public static let videoMimeTypes: Set<String> = ["video/mp4"]

    public static let allowedSourceMimeTypes = imageMimeTypes.union(documentMimeTypes).union(videoMimeTypes)

    public static let voiceMimeTypes: Set<String> = ["audio/mp4"]

    public static func validate(
        _ candidate: AttachmentCandidate,
        currentCount: Int
    ) -> AttachmentFailureReason? {
        guard currentCount < maxCount else { return .serverRejected("too_many_attachments") }
        guard allowedSourceMimeTypes.contains(candidate.sourceMimeType) else {
            return .unsupportedType
        }
        guard !candidate.data.isEmpty else { return .preparationFailed }
        let limit = if imageMimeTypes.contains(candidate.sourceMimeType) {
            imageSourceMaxBytes
        } else if videoMimeTypes.contains(candidate.sourceMimeType) {
            videoSourceMaxBytes
        } else {
            documentSourceMaxBytes
        }
        return candidate.data.count <= limit ? nil : .tooLarge
    }

    public static func sourceMimeType(
        declared: String?,
        filename: String,
        data: Data
    ) -> String? {
        let normalized = declared?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if let normalized, allowedSourceMimeTypes.contains(normalized) {
            return normalized
        }
        if let detected = ByteSignature.detectedMimeType(data),
           allowedSourceMimeTypes.contains(detected) {
            return detected
        }
        return switch filename.split(separator: ".").last?.lowercased() {
        case "pdf": "application/pdf"
        case "txt": "text/plain"
        case "csv": "text/csv"
        case "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        case "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        case "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        case "mp4": "video/mp4"
        default: nil
        }
    }
}
