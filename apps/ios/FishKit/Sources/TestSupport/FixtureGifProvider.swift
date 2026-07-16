import ChatData
import Foundation

/// Deterministic GIF data for snapshots, previews, and the catalog app —
/// no network, stable ordering, allowlist-shaped URLs.
public enum ChatMediaFixtures {
    public static let gifs: [ChatGif] = [
        gif("otter-wave", description: "An otter waving hello", width: 400, height: 300),
        gif("whale-sleep", description: "A whale drifting to sleep", width: 480, height: 360),
        gif("dolphin-jump", description: "A dolphin leaping from a wave", width: 400, height: 226),
        gif("crab-dance", description: "A crab dancing sideways", width: 320, height: 320),
        gif("turtle-swim", description: "A sea turtle gliding calmly", width: 400, height: 300),
        gif("puffer-pop", description: "A pufferfish puffing up", width: 300, height: 400),
    ]

    public static let pages: [GifPage] = [
        GifPage(gifs: Array(gifs.prefix(4)), next: "page-2"),
        GifPage(gifs: Array(gifs.dropFirst(4)), next: nil),
    ]

    private static func gif(
        _ id: String,
        description: String,
        width: Int,
        height: Int
    ) -> ChatGif {
        // Posters are bundled file URLs so every render is synchronous and
        // deterministic — no network, no cache-order flakiness in snapshots.
        let poster = Bundle.module.url(
            forResource: "poster-\(id)",
            withExtension: "png"
        ) ?? URL(string: "https://static.klipy.com/\(id)/poster.webp")!
        return ChatGif(
            provider: .klipy,
            providerId: id,
            title: description,
            description: description,
            sourceUrl: URL(string: "https://klipy.com/gifs/\(id)")!,
            posterUrl: poster,
            previewUrl: URL(string: "https://static.klipy.com/\(id)/tiny.mp4")!,
            mediaUrl: URL(string: "https://static.klipy.com/\(id)/full.mp4")!,
            width: width,
            height: height
        )
    }
}

/// Offline `GifProviding` stand-in with one knob per picker state.
public struct FixtureGifProvider: GifProviding {
    public enum Behavior: Sendable {
        /// Two deterministic pages of fixtures.
        case pages
        /// Zero results for every request.
        case empty
        /// Every request throws — drives the calm notice state.
        case failing
        /// No credentials — the notice state without a retry action.
        case unavailable
    }

    private let behavior: Behavior

    public init(behavior: Behavior = .pages) {
        self.behavior = behavior
    }

    public var isAvailable: Bool {
        if case .unavailable = behavior { return false }
        return true
    }

    public func trending(cursor: String?) async throws -> GifPage {
        try page(for: cursor)
    }

    public func search(query: String, cursor: String?) async throws -> GifPage {
        try page(for: cursor)
    }

    public func registerShare(gif: ChatGif, query: String) async {}

    private func page(for cursor: String?) throws -> GifPage {
        switch behavior {
        case .pages:
            cursor == "page-2" ? ChatMediaFixtures.pages[1] : ChatMediaFixtures.pages[0]
        case .empty:
            GifPage(gifs: [], next: nil)
        case .failing, .unavailable:
            throw URLError(.notConnectedToInternet)
        }
    }
}
