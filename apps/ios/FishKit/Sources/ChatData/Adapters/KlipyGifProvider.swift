import Foundation

/// Live KLIPY adapter — the same Tenor-v2-compatible API, parameters, and
/// result mapping as the web client (`apps/web/features/chat/model/gif-provider.ts`).
/// Every media URL is validated against the backend's host allowlist before it
/// can reach the UI, so the app never renders or sends a URL the server would
/// reject.
public struct KlipyGifProvider: GifProviding {
    /// Pseudonymous per-install id (never a device identifier), stored under
    /// the same key web uses in localStorage.
    static let customerIdDefaultsKey = "fish-gif-customer-id"

    private static let baseUrl = URL(string: "https://api.klipy.com/v2")!
    private static let maxPageSize = 24
    private static let maxQueryLength = 50

    private let apiKey: String
    private let clientKey: String
    private let pageSize: Int
    private let localeIdentifier: String
    private let customerId: String
    private let session: URLSession

    public init(
        apiKey: String?,
        clientKey: String = "fish_chat",
        pageSize: Int = 12,
        locale: Locale = .current,
        defaults: UserDefaults = .standard,
        session: URLSession = .shared
    ) {
        self.apiKey = apiKey?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.clientKey = clientKey
        self.pageSize = min(max(1, pageSize), Self.maxPageSize)
        self.localeIdentifier = locale.identifier.replacingOccurrences(of: "_", with: "-")
        self.customerId = Self.customerId(in: defaults)
        self.session = session
    }

    public var isAvailable: Bool { !apiKey.isEmpty }

    public func trending(cursor: String?) async throws -> GifPage {
        try await loadPage(endpoint: "featured", query: nil, cursor: cursor)
    }

    public func search(query: String, cursor: String?) async throws -> GifPage {
        try await loadPage(endpoint: "search", query: query, cursor: cursor)
    }

    public func registerShare(gif: ChatGif, query: String) async {
        guard isAvailable else { return }
        var parameters = baseParameters
        parameters.append(URLQueryItem(name: "id", value: gif.providerId))
        parameters.append(URLQueryItem(name: "q", value: String(query.prefix(Self.maxQueryLength))))
        guard let request = request(endpoint: "registershare", parameters: parameters) else { return }
        _ = try? await session.data(for: request)
    }

    // MARK: - Requests

    private var baseParameters: [URLQueryItem] {
        [
            URLQueryItem(name: "key", value: apiKey),
            URLQueryItem(name: "client_key", value: clientKey),
            URLQueryItem(name: "customer_id", value: customerId),
            URLQueryItem(name: "locale", value: localeIdentifier),
            URLQueryItem(name: "contentfilter", value: "high"),
            URLQueryItem(name: "media_filter", value: "preview,tinymp4,mp4"),
        ]
    }

    private func loadPage(endpoint: String, query: String?, cursor: String?) async throws -> GifPage {
        guard isAvailable else { throw URLError(.userAuthenticationRequired) }
        var parameters = baseParameters
        parameters.append(URLQueryItem(name: "limit", value: String(pageSize)))
        if let query {
            parameters.append(URLQueryItem(name: "q", value: String(query.prefix(Self.maxQueryLength))))
        }
        if let cursor, !cursor.isEmpty {
            parameters.append(URLQueryItem(name: "pos", value: cursor))
        }
        guard let request = request(endpoint: endpoint, parameters: parameters) else {
            throw URLError(.badURL)
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let page = try decoder.decode(KlipyPage.self, from: data)
        let next = page.next?.isEmpty == false ? page.next : nil
        return GifPage(gifs: page.results.compactMap(Self.mapResult), next: next)
    }

    private func request(endpoint: String, parameters: [URLQueryItem]) -> URLRequest? {
        var components = URLComponents(
            url: Self.baseUrl.appending(path: endpoint),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = parameters
        return components?.url.map { URLRequest(url: $0) }
    }

    private static func customerId(in defaults: UserDefaults) -> String {
        if let existing = defaults.string(forKey: customerIdDefaultsKey) {
            return existing
        }
        let created = UUID().uuidString.lowercased()
        defaults.set(created, forKey: customerIdDefaultsKey)
        return created
    }

    // MARK: - Mapping

    private struct KlipyPage: Decodable {
        let results: [KlipyResult]
        let next: String?
    }

    private struct KlipyResult: Decodable {
        struct Format: Decodable {
            let url: String
            let dims: [Int]?
        }

        let id: String
        let title: String?
        let contentDescription: String?
        let itemurl: String?
        let mediaFormats: [String: Format]
    }

    /// Web-mapping parity: preview → poster, tinymp4 → preview, mp4 → media;
    /// results with a missing rendition or an off-allowlist media host are
    /// dropped; dimensions clamp to the server's 1…4096 bound.
    private static func mapResult(_ result: KlipyResult) -> ChatGif? {
        guard
            let poster = allowlistedMediaUrl(result.mediaFormats["preview"]?.url),
            let preview = allowlistedMediaUrl(result.mediaFormats["tinymp4"]?.url),
            let media = allowlistedMediaUrl(result.mediaFormats["mp4"]?.url)
        else { return nil }
        let dims = result.mediaFormats["mp4"]?.dims ?? []
        let title = normalized(result.title, fallback: "GIF", maxLength: 300)
        return ChatGif(
            provider: .klipy,
            providerId: result.id,
            title: title,
            description: normalized(result.contentDescription, fallback: title, maxLength: 500),
            sourceUrl: sourceUrl(itemUrl: result.itemurl, id: result.id),
            posterUrl: poster,
            previewUrl: preview,
            mediaUrl: media,
            width: clampedDimension(dims.first),
            height: clampedDimension(dims.count > 1 ? dims[1] : nil)
        )
    }

    private static func allowlistedMediaUrl(_ value: String?) -> URL? {
        guard
            let value,
            let url = URL(string: value),
            url.scheme == "https",
            let host = url.host(),
            isAllowlistedMediaHost(host)
        else { return nil }
        return url
    }

    /// The server's `^static\d*\.klipy\.com$` allowlist, verbatim.
    private static func isAllowlistedMediaHost(_ host: String) -> Bool {
        let suffix = ".klipy.com"
        let prefix = "static"
        guard host.hasSuffix(suffix), host.hasPrefix(prefix) else { return false }
        let digits = host.dropFirst(prefix.count).dropLast(suffix.count)
        return digits.allSatisfy { $0.isASCII && $0.isNumber }
    }

    private static func sourceUrl(itemUrl: String?, id: String) -> URL {
        if
            let itemUrl,
            let url = URL(string: itemUrl),
            url.scheme == "https",
            let host = url.host(),
            host == "klipy.com" || host.hasSuffix(".klipy.com")
        {
            return url
        }
        return URL(string: "https://klipy.com/gifs/\(id)")!
    }

    private static func normalized(_ value: String?, fallback: String, maxLength: Int) -> String {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let base = trimmed.isEmpty ? fallback : trimmed
        return String(base.prefix(maxLength))
    }

    private static func clampedDimension(_ value: Int?) -> Int {
        min(max(value ?? 1, 1), 4096)
    }
}
