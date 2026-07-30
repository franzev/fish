package space.fishhub.android.messaging

import kotlinx.coroutines.CancellationException

/**
 * runCatching for suspend blocks that must not swallow cancellation: a caught
 * CancellationException would keep cancelled workers looping and break
 * withTimeoutOrNull. Returns null on any other failure.
 */
internal suspend fun <T> suspendRunCatching(block: suspend () -> T): T? =
    try {
        block()
    } catch (cancellation: CancellationException) {
        throw cancellation
    } catch (_: Throwable) {
        null
    }
