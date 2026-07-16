import Foundation

/// One entry of the bundled sticker pack, decoded from the shared
/// `sticker-catalog.json` contract (same file web and Android read). Styles
/// and keywords stay plain strings so future catalog additions never break
/// decoding.
public struct ChatSticker: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let phrase: String
    public let animal: String
    public let description: String
    public let src: String
    public let styles: [String]
    public let keywords: [String]

    public init(
        id: String,
        phrase: String,
        animal: String,
        description: String,
        src: String,
        styles: [String],
        keywords: [String]
    ) {
        self.id = id
        self.phrase = phrase
        self.animal = animal
        self.description = description
        self.src = src
        self.styles = styles
        self.keywords = keywords
    }

    /// Asset file name without directory or extension, derived from the
    /// catalog's web path (`/stickers/aquatic/hello-otter.webp` → `hello-otter`).
    public var assetBaseName: String {
        let file = src.split(separator: "/").last.map(String.init) ?? src
        return file.hasSuffix(".webp") ? String(file.dropLast(".webp".count)) : file
    }
}
