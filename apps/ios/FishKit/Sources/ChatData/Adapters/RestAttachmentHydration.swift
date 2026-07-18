import Foundation

public struct RestAttachmentHydration: AttachmentHydrating {
    private let configuration: ChatBackendConfiguration
    private let commands: any AttachmentCommandProviding
    private let session: URLSession

    public init(
        configuration: ChatBackendConfiguration,
        commands: any AttachmentCommandProviding,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.commands = commands
        self.session = session
    }

    public func readyAttachments(
        forMessageIds messageIds: [String]
    ) async throws -> [String: [ChatAttachment]] {
        let ids = Array(Set(messageIds)).sorted()
        guard !ids.isEmpty else { return [:] }
        guard let token = await configuration.accessToken() else {
            throw AttachmentCommandFailure(
                code: "not_authenticated",
                notice: "Sign in to load attachments.",
                statusCode: 401
            )
        }
        guard var components = URLComponents(
            url: configuration.supabaseUrl.appending(path: "rest/v1/message_attachments"),
            resolvingAgainstBaseURL: false
        ) else { throw AttachmentCommandFailure.unavailable }
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,message_id,position,status,kind,original_name,stored_mime_type,stored_byte_size,width,height,thumbnail_path,display_path"),
            URLQueryItem(name: "message_id", value: "in.(\(ids.joined(separator: ",")))"),
            URLQueryItem(name: "status", value: "eq.ready"),
            URLQueryItem(name: "order", value: "position.asc"),
        ]
        guard let url = components.url else { throw AttachmentCommandFailure.unavailable }
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            throw AttachmentCommandFailure.unavailable
        }
        let rows = try JSONDecoder().decode([HydratedAttachmentWire].self, from: data)
        var delivery: [String: SignedAttachmentUrl] = [:]
        for batch in rows.map(\.id).chunked(maximumCount: 50) {
            for url in try await commands.refreshUrls(attachmentIds: batch) {
                delivery[url.attachmentId] = url
            }
        }
        return Dictionary(grouping: rows, by: \.messageId).mapValues { values in
            values.sorted { $0.position < $1.position }.map { row in
                let urls = delivery[row.id]
                var urlsByPath: [String: URL] = [:]
                if let path = row.attachment.thumbnailPath,
                   let url = urls?.thumbnailUrl {
                    urlsByPath[path] = url
                }
                if let url = urls?.displayUrl {
                    urlsByPath[row.attachment.displayPath] = url
                }
                return row.attachment.domain(
                    urls: urlsByPath
                )
            }
        }
    }
}

private struct HydratedAttachmentWire: Decodable {
    let messageId: String
    let position: Int
    let attachment: ReadyAttachmentWire

    enum CodingKeys: String, CodingKey {
        case messageId = "message_id"
        case position
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        messageId = try container.decode(String.self, forKey: .messageId)
        position = try container.decode(Int.self, forKey: .position)
        attachment = try ReadyAttachmentWire(from: decoder)
    }

    var id: String { attachment.id }
}

private extension Array {
    func chunked(maximumCount: Int) -> [[Element]] {
        guard maximumCount > 0 else { return [] }
        return stride(from: 0, to: count, by: maximumCount).map { start in
            Array(self[start..<Swift.min(start + maximumCount, count)])
        }
    }
}
