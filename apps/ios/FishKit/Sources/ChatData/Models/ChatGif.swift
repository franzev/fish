import Foundation

/// GIF providers the backend accepts. The database and Edge Function allowlist
/// exactly these two; only KLIPY has a client implementation.
public enum ChatGifProvider: String, Codable, Sendable, CaseIterable {
    case klipy
    case giphy
}

/// One shareable GIF, shaped exactly like the web contract in
/// `packages/core/src/chat.ts` (`ChatGif`). FISH never copies the media into
/// private storage — every URL points at the provider's CDN and the server
/// re-validates hosts, lengths, and dimensions on send.
public struct ChatGif: Codable, Equatable, Hashable, Sendable, Identifiable {
    public var provider: ChatGifProvider
    public var providerId: String
    public var title: String
    public var description: String
    public var sourceUrl: URL
    public var posterUrl: URL
    public var previewUrl: URL
    public var mediaUrl: URL
    public var width: Int
    public var height: Int

    /// Stable identity used for grid keys and page deduplication — the same
    /// `provider:providerId` key web uses for tiles.
    public var id: String { "\(provider.rawValue):\(providerId)" }

    public init(
        provider: ChatGifProvider,
        providerId: String,
        title: String,
        description: String,
        sourceUrl: URL,
        posterUrl: URL,
        previewUrl: URL,
        mediaUrl: URL,
        width: Int,
        height: Int
    ) {
        self.provider = provider
        self.providerId = providerId
        self.title = title
        self.description = description
        self.sourceUrl = sourceUrl
        self.posterUrl = posterUrl
        self.previewUrl = previewUrl
        self.mediaUrl = mediaUrl
        self.width = width
        self.height = height
    }
}

/// One page of GIF results plus the opaque cursor for the next page.
public struct GifPage: Equatable, Sendable {
    public var gifs: [ChatGif]
    public var next: String?

    public init(gifs: [ChatGif], next: String?) {
        self.gifs = gifs
        self.next = next
    }
}
