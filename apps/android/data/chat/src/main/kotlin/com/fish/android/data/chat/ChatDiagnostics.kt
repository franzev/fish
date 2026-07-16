package com.fish.android.data.chat

import android.util.Log
import com.fish.android.data.chat.FailureCategory

internal enum class ChatOperation {
    SignIn,
    ListConversations,
    SyncNewest,
    LoadOlder,
    SendMessage,
    ReportGif,
    MarkRead,
    ReconnectBackfill,
    Realtime,
}

internal fun interface ChatDiagnostics {
    fun record(event: ChatDiagnosticEvent)
}

internal data class ChatDiagnosticEvent(
    val operation: ChatOperation,
    val succeeded: Boolean,
    val durationMs: Long,
    val failureCategory: FailureCategory? = null,
)

internal object NoOpChatDiagnostics : ChatDiagnostics {
    override fun record(event: ChatDiagnosticEvent) = Unit
}

/** Debug-only diagnostics. Events deliberately contain no user, conversation, or message data. */
internal object RedactedLogcatChatDiagnostics : ChatDiagnostics {
    override fun record(event: ChatDiagnosticEvent) {
        Log.d(
            "ChatRepository",
            "operation=${event.operation} succeeded=${event.succeeded} " +
                "durationMs=${event.durationMs} category=${event.failureCategory ?: "none"}",
        )
    }
}
