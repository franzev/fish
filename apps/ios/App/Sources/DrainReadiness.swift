import Foundation

/// Bounded poll for "the chat session and directory are ready to drain".
/// Injectable sleep keeps it testable without wall-clock time.
enum DrainReadiness {
    /// The closures are pinned to the main actor rather than left
    /// unisolated: `FishAppModel` calls this with closures that read its own
    /// `@MainActor`-isolated state, and under Swift 6 strict concurrency a
    /// plain nonisolated closure type cannot safely carry that capture
    /// across the call. A main-actor closure value stays safe to hand
    /// around because it can only ever run back on that actor.
    static func waitUntilReady(
        isReady: @MainActor () -> Bool,
        attempts: Int,
        sleep: @MainActor () async -> Void
    ) async -> Bool {
        var remaining = attempts
        while await !isReady() {
            guard remaining > 0 else { return false }
            remaining -= 1
            await sleep()
        }
        return true
    }
}
