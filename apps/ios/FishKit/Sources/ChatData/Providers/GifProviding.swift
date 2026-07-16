import Foundation

/// The GIF search port the picker consumes. Implementations must be safe to
/// call from any actor; results arrive as immutable pages.
public protocol GifProviding: Sendable {
    /// False when the provider has no credentials — the picker shows a calm
    /// unavailable notice without a retry action.
    var isAvailable: Bool { get }

    /// Curated results for an empty query.
    func trending(cursor: String?) async throws -> GifPage

    /// Phrase search. Callers pass the query verbatim (punctuation preserved);
    /// implementations own provider-specific limits.
    func search(query: String, cursor: String?) async throws -> GifPage

    /// Provider relevance ping after a confirmed send. Fire-and-forget:
    /// failures are swallowed, nothing user-visible depends on it.
    func registerShare(gif: ChatGif, query: String) async
}
