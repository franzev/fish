package space.fishhub.android.messaging

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import kotlinx.coroutines.launch
import space.fishhub.android.FishApplication

internal class ChatReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val conversationId = intent.getStringExtra(ChatIntents.ExtraConversationId)
            ?.trim()
            ?.takeIf(String::isNotEmpty)
            ?: return
        val body = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(RemoteInputKey)
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() && it.length <= 4_000 }
            ?: return

        val app = context.applicationContext as? FishApplication ?: return
        ChatReplyStore.enqueue(app, conversationId, body)
        ChatNotificationFactory.clear(app, conversationId)
        app.callScope.launch { app.processPendingChatReplies() }
    }

    companion object {
        const val RemoteInputKey = "space.fishhub.android.extra.CHAT_REPLY"
    }
}
