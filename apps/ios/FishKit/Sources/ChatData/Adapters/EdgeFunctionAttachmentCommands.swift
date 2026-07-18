import Foundation

public struct EdgeFunctionAttachmentCommands: AttachmentCommandProviding {
    public static let requestTimeout: TimeInterval = 15
    public static let completionTimeout: TimeInterval = 45

    private let configuration: ChatBackendConfiguration
    private let session: URLSession
    private let encoder = JSONEncoder()

    public init(
        configuration: ChatBackendConfiguration,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.session = session
    }

    public func initializeUpload(
        _ request: InitializeAttachmentRequest
    ) async throws -> AttachmentUploadAuthorization {
        let authorization: AttachmentUploadAuthorization = try await send(
            request,
            timeout: Self.requestTimeout
        )
        return AttachmentUploadAuthorization(
            attachmentId: authorization.attachmentId,
            bucket: authorization.bucket,
            objectPath: authorization.objectPath,
            uploadToken: authorization.uploadToken,
            uploadMimeType: authorization.uploadMimeType,
            signedUploadUrl: try publicSignedUploadUrl(
                bucket: authorization.bucket,
                objectPath: authorization.objectPath,
                token: authorization.uploadToken
            ),
            expiresAt: authorization.expiresAt
        )
    }

    private func publicSignedUploadUrl(
        bucket: String,
        objectPath: String,
        token: String
    ) throws -> URL {
        let encodedBucket = bucket.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
        ) ?? bucket
        let encodedPath = objectPath.split(separator: "/", omittingEmptySubsequences: false)
            .map { String($0).addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? String($0) }
            .joined(separator: "/")
        guard var components = URLComponents(
            url: configuration.supabaseUrl
                .appending(path: "storage/v1/object/upload/sign")
                .appending(path: encodedBucket, directoryHint: .isDirectory)
                .appending(path: encodedPath),
            resolvingAgainstBaseURL: false
        ) else { throw AttachmentCommandFailure.unavailable }
        components.queryItems = [URLQueryItem(name: "token", value: token)]
        guard let url = components.url else { throw AttachmentCommandFailure.unavailable }
        return url
    }

    public func completeUpload(attachmentId: String) async throws -> ChatAttachment {
        struct Request: Encodable { let action = "complete-upload"; let attachmentId: String }
        let response: ReadyResponse = try await send(
            Request(attachmentId: attachmentId),
            timeout: Self.completionTimeout
        )
        let urls = Dictionary(uniqueKeysWithValues: response.urls.map { ($0.path, $0.signedUrl) })
        return response.attachment.domain(urls: urls)
    }

    public func cancelUpload(attachmentId: String) async {
        struct Request: Encodable { let action = "cancel-upload"; let attachmentId: String }
        struct Response: Decodable { let cancelled: Bool }
        let _: Response? = try? await send(
            Request(attachmentId: attachmentId),
            timeout: Self.requestTimeout
        )
    }

    public func refreshUrls(
        attachmentIds: [String]
    ) async throws -> [SignedAttachmentUrl] {
        guard !attachmentIds.isEmpty, attachmentIds.count <= 50,
              Set(attachmentIds).count == attachmentIds.count else {
            throw AttachmentCommandFailure(
                code: "invalid_request",
                notice: "Those attachments are not available."
            )
        }
        struct Request: Encodable {
            let action = "refresh-attachment-urls"
            let attachmentIds: [String]
        }
        struct Response: Decodable { let attachments: [SignedAttachmentUrl] }
        let response: Response = try await send(
            Request(attachmentIds: attachmentIds),
            timeout: Self.requestTimeout
        )
        return response.attachments
    }

    private func send<Request: Encodable, Response: Decodable>(
        _ body: Request,
        timeout: TimeInterval
    ) async throws -> Response {
        guard let token = await configuration.accessToken() else {
            throw AttachmentCommandFailure(
                code: "not_authenticated",
                notice: "Sign in to continue adding attachments.",
                statusCode: 401
            )
        }
        var request = URLRequest(
            url: configuration.supabaseUrl.appending(path: "functions/v1/chat-image-command")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw AttachmentCommandFailure.unavailable
        }
        let http = response as? HTTPURLResponse
        guard let http, (200..<300).contains(http.statusCode) else {
            let failure = try? JSONDecoder().decode(FailureResponse.self, from: data)
            throw AttachmentCommandFailure(
                code: failure?.code ?? AttachmentCommandFailure.unavailable.code,
                notice: failure?.error ?? AttachmentCommandFailure.unavailable.notice,
                statusCode: http?.statusCode
            )
        }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .custom { decoder in
                let container = try decoder.singleValueContainer()
                let value = try container.decode(String.self)
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = formatter.date(from: value) { return date }
                formatter.formatOptions = [.withInternetDateTime]
                if let date = formatter.date(from: value) { return date }
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Invalid ISO-8601 date"
                )
            }
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw AttachmentCommandFailure.unavailable
        }
    }
}

private struct FailureResponse: Decodable {
    let code: String?
    let error: String?
}

private struct ReadyResponse: Decodable {
    let attachment: ReadyAttachmentWire
    let urls: [StorageSignedUrlWire]
}

private struct StorageSignedUrlWire: Decodable {
    let path: String
    let signedUrl: URL
}

struct ReadyAttachmentWire: Decodable, Sendable {
    let id: String
    let status: String
    let kind: ChatAttachment.Kind
    let originalName: String
    let storedMimeType: String?
    let storedByteSize: Int?
    let width: Int?
    let height: Int?
    let thumbnailPath: String?
    let displayPath: String

    enum CodingKeys: String, CodingKey {
        case id, status, kind, width, height
        case originalName = "original_name"
        case storedMimeType = "stored_mime_type"
        case storedByteSize = "stored_byte_size"
        case thumbnailPath = "thumbnail_path"
        case displayPath = "display_path"
    }

    func domain(urls: [String: URL] = [:]) -> ChatAttachment {
        ChatAttachment(
            id: id,
            status: status,
            kind: kind,
            originalName: originalName,
            mimeType: storedMimeType,
            byteSize: storedByteSize,
            width: width,
            height: height,
            thumbnailPath: thumbnailPath,
            displayPath: displayPath,
            thumbnailUrl: thumbnailPath.flatMap { urls[$0] },
            displayUrl: urls[displayPath]
        )
    }
}
