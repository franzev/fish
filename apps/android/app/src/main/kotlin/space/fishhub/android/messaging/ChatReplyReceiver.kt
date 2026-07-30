package space.fishhub.android.messaging

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import space.fishhub.android.FishApplication

internal class ChatReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val conversationId = intent.getStringExtra(ChatIntents.ExtraConversationId)
            ?.trim()
            ?.takeIf(String::isNotEmpty)
            ?: return
        val messageId = intent.getStringExtra(ChatIntents.ExtraMessageId)
            ?.trim()
            ?.takeIf(String::isNotEmpty)
        val body = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(RemoteInputKey)
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() && it.length <= 4_000 }
            ?: return

        val app = context.applicationContext as? FishApplication ?: return
        ChatReplyStore.enqueue(app, conversationId, body, messageId)
        ChatNotificationFactory.appendReply(app, conversationId, body)
        ChatReplyDrainWorker.enqueue(app)
    }

    companion object {
        const val RemoteInputKey = "space.fishhub.android.extra.CHAT_REPLY"
    }
}
