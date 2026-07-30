package space.fishhub.android.messaging

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.withTimeoutOrNull
import space.fishhub.android.FishApplication
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.OutgoingMessageContent

/**
 * Durable executor for queued notification replies. Instantiated by
 * WorkManager's default reflection factory (the chat WorkerFactory returns
 * null for unknown class names); dependencies come from the application.
 */
internal class ChatReplyDrainWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? FishApplication ?: return Result.success()
        val repository = app.chatRepository
        // Wait out Loading with a bound (cold starts settle asynchronously; a
        // hung refresh must not park the execution slot), retry when
        // unsettled, and stop quietly when signed out — the auth collector in
        // FishApplication re-enqueues this work when sign-in completes.
        val auth = withTimeoutOrNull(30_000) { repository.authState.settled() }
            ?: return Result.retry()
        if (auth !is ChatAuthState.SignedIn) return Result.success()
        val drain = ChatReplyDrain(
            pending = { ChatReplyStore.pending(app) },
            remove = { ChatReplyStore.remove(app, it) },
            recordAttempt = { ChatReplyStore.recordAttempt(app, it) },
            listConversations = { repository.listAuthorizedConversations() },
            send = { conversationId, body, clientRequestId ->
                repository.sendMessage(
                    conversationId = conversationId,
                    content = OutgoingMessageContent(body = body),
                    clientRequestId = clientRequestId,
                )
            },
            markRead = { conversationId, messageId ->
                repository.markRead(conversationId, messageId, messageId)
            },
            flushOutbox = { repository.flushTextOutbox(it) },
            pendingOutboxCount = { repository.pendingTextSendCount(it) },
            saveDraft = { conversationId, body ->
                // appendDraft reports real persistence and joins onto any
                // existing composer text instead of replacing it. The drain
                // reaches this only after a successful directory read, which
                // upserts the conversation row the owner check needs.
                suspendRunCatching { repository.appendDraft(conversationId, body) } == true
            },
            notifyFailure = { conversationId, messageId ->
                ChatNotificationFactory.showReplyFailure(app, conversationId, messageId)
            },
        )
        return when (drain.run()) {
            ChatReplyDrain.Outcome.Done -> Result.success()
            ChatReplyDrain.Outcome.Retry -> Result.retry()
        }
    }

    companion object {
        private const val UniqueName = "chat-reply-drain"

        fun enqueue(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                UniqueName,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                OneTimeWorkRequestBuilder<ChatReplyDrainWorker>()
                    .setConstraints(
                        Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED)
                            .build(),
                    )
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                    .build(),
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UniqueName)
        }
    }
}
