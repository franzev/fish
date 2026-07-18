import ChatData
import Foundation

public actor AttachmentFileDownloader {
    private let session: URLSession
    private let allowedHost: String?
    private let commands: (any AttachmentCommandProviding)?

    public init(
        session: URLSession = .shared,
        allowedHost: String? = nil,
        commands: (any AttachmentCommandProviding)? = nil
    ) {
        self.session = session
        self.allowedHost = allowedHost?.lowercased()
        self.commands = commands
    }

    public func download(_ attachment: MessageAttachmentUiModel) async throws -> URL {
        if let local = attachment.localPreviewUrl,
           FileManager.default.fileExists(atPath: local.path) {
            return local
        }
        guard let url = attachment.displayUrl else { throw MessageImageLoadFailure.unavailable }
        do {
            return try await fetch(url, attachment: attachment)
        } catch {
            guard let loadError = error as? MessageImageLoadFailure,
                  loadError.isRefreshable,
                  let commands else { throw error }
            let refreshed = try await commands.refreshUrls(attachmentIds: [attachment.id])
            guard let url = refreshed.first?.displayUrl else { throw loadError }
            return try await fetch(url, attachment: attachment)
        }
    }

    private func fetch(
        _ url: URL,
        attachment: MessageAttachmentUiModel
    ) async throws -> URL {
        guard let allowedHost,
              url.scheme == "https" || (url.scheme == "http" && isLocal(url)),
              url.host?.lowercased() == allowedHost else {
            throw MessageImageLoadFailure.untrustedUrl
        }
        let (temporary, response) = try await session.download(from: url)
        guard let http = response as? HTTPURLResponse else {
            throw MessageImageLoadFailure.unavailable
        }
        if [400, 401, 403].contains(http.statusCode) {
            throw MessageImageLoadFailure.expiredUrl
        }
        guard (200..<300).contains(http.statusCode) else {
            throw MessageImageLoadFailure.unavailable
        }
        let values = try temporary.resourceValues(forKeys: [.fileSizeKey])
        if let expected = attachment.byteSize,
           let actual = values.fileSize,
           expected != actual {
            throw MessageImageLoadFailure.unavailable
        }
        let suffix = Self.fileExtension(
            mimeType: attachment.mimeType,
            originalName: attachment.originalName
        )
        let destination = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString.lowercased())
            .appendingPathExtension(suffix)
        try FileManager.default.moveItem(at: temporary, to: destination)
        return destination
    }

    private func isLocal(_ url: URL) -> Bool {
        ["localhost", "127.0.0.1"].contains(url.host ?? "")
    }

    private nonisolated static func fileExtension(
        mimeType: String?,
        originalName: String
    ) -> String {
        switch mimeType {
        case "image/webp": "webp"
        case "image/jpeg": "jpg"
        case "application/pdf": "pdf"
        case "text/plain": "txt"
        case "text/csv": "csv"
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
        case "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx"
        default: originalName.split(separator: ".").last.map(String.init) ?? "bin"
        }
    }
}
