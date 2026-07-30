# Notification Quick Reply Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the shipped notification quick reply on Android and iOS: content-rich Android notifications with reply echo, WorkManager-owned durable delivery, immediate iOS background drain, mark-read on reply, and honest failure notices.

**Architecture:** No backend changes. Android work extends the existing `messaging` package in the app module plus one small repository addition; delivery moves from an app coroutine scope into a `CoroutineWorker` that also flushes the Room text outbox. iOS work extends `FishAppDelegate`/`FishAppModel` plus the `ChatData` reply model; the drain runs immediately under a background-task assertion. Spec: `docs/superpowers/specs/2026-07-30-notification-quick-reply-hardening-design.md`.

**Tech Stack:** Kotlin + WorkManager + NotificationCompat.MessagingStyle (Android app module, JUnit4 pure-logic tests); Swift + UserNotifications + UIKit background tasks (iOS app target XCTest, FishKit swift-testing).

**Conventions:** Commit style is `feat(android): …` / `feat(ios): …` / `docs: …` with no co-author trailer. Never log message text, push tokens, account IDs, or conversation IDs. Copy uses sentence case with curly apostrophes ("didn’t").

---

### Task 1: Android — reply store carries the notified message ID

The reply store keeps `{id, conversationId, body}` today; add an optional `messageId` so the drain can mark the conversation read up to the notified message. Extract the JSON codec into pure functions so JUnit4 can test the migration (the app module has no Robolectric).

**Files:**
- Create: `apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyCodec.kt`
- Modify: `apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyStore.kt`
- Test: `apps/android/app/src/test/kotlin/space/fishhub/android/messaging/ChatReplyCodecTest.kt`

- [ ] **Step 1.1: Write the failing codec test**

```kotlin
package space.fishhub.android.messaging

import org.junit.Assert.assertEquals
import org.junit.Test

class ChatReplyCodecTest {
    @Test
    fun `round trips replies with and without message id`() {
        val replies = listOf(
            PendingChatReply("id-1", "conv-1", "hello", "msg-1"),
            PendingChatReply("id-2", "conv-2", "there", null),
        )
        assertEquals(replies, ChatReplyCodec.decode(ChatReplyCodec.encode(replies)))
    }

    @Test
    fun `decodes legacy entries without a message id`() {
        val legacy = """[{"id":"id-1","conversationId":"conv-1","body":"hello"}]"""
        assertEquals(
            listOf(PendingChatReply("id-1", "conv-1", "hello", null)),
            ChatReplyCodec.decode(legacy),
        )
    }

    @Test
    fun `skips entries missing required fields and tolerates garbage`() {
        assertEquals(emptyList<PendingChatReply>(), ChatReplyCodec.decode("not json"))
        assertEquals(emptyList<PendingChatReply>(), ChatReplyCodec.decode(null))
        val partial = """[{"id":"","conversationId":"conv","body":"x"},{"id":"a","conversationId":"conv","body":"  "}]"""
        assertEquals(emptyList<PendingChatReply>(), ChatReplyCodec.decode(partial))
    }
}
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `pnpm android:test`
Expected: FAIL — `ChatReplyCodec` unresolved, `PendingChatReply` has no `messageId` parameter.

- [ ] **Step 1.3: Add the codec and extend the model**

Create `ChatReplyCodec.kt`:

```kotlin
package space.fishhub.android.messaging

import org.json.JSONArray
import org.json.JSONObject

/** Pure JSON codec for the notification reply store; keeps migration testable. */
internal object ChatReplyCodec {
    fun encode(replies: List<PendingChatReply>): String {
        val json = JSONArray()
        replies.forEach { reply ->
            val item = JSONObject()
                .put("id", reply.id)
                .put("conversationId", reply.conversationId)
                .put("body", reply.body)
            reply.messageId?.let { item.put("messageId", it) }
            json.put(item)
        }
        return json.toString()
    }

    fun decode(raw: String?): List<PendingChatReply> {
        if (raw == null) return emptyList()
        val json = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return buildList {
            for (index in 0 until json.length()) {
                val item = json.optJSONObject(index) ?: continue
                val id = item.optString("id").takeIf(String::isNotBlank) ?: continue
                val conversationId = item.optString("conversationId").takeIf(String::isNotBlank) ?: continue
                val body = item.optString("body").trim().takeIf(String::isNotBlank) ?: continue
                val messageId = item.optString("messageId").takeIf(String::isNotBlank)
                add(PendingChatReply(id, conversationId, body, messageId))
            }
        }
    }
}
```

In `ChatReplyStore.kt`, extend the model and delegate the codec:

```kotlin
internal data class PendingChatReply(
    val id: String,
    val conversationId: String,
    val body: String,
    val messageId: String? = null,
)
```

```kotlin
    fun enqueue(context: Context, conversationId: String, body: String, messageId: String?) {
        synchronized(lock) {
            val replies = load(context).toMutableList()
            replies += PendingChatReply(
                id = UUID.randomUUID().toString().lowercase(),
                conversationId = conversationId,
                body = body,
                messageId = messageId,
            )
            save(context, replies)
        }
    }
```

Replace the private `load`/`save` bodies to delegate (keep the SharedPreferences plumbing):

```kotlin
    private fun load(context: Context): List<PendingChatReply> =
        ChatReplyCodec.decode(
            context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
                .getString(RepliesKey, null),
        )

    private fun save(context: Context, replies: List<PendingChatReply>) {
        context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
            .edit()
            .putString(RepliesKey, ChatReplyCodec.encode(replies))
            .commit()
    }
```

Delete the now-unused `JSONArray`/`JSONObject` imports from `ChatReplyStore.kt`. `ChatReplyReceiver` will not compile until Task 6 updates it; for this task pass `messageId = null` at its call site:

```kotlin
        ChatReplyStore.enqueue(app, conversationId, body, messageId = null)
```

- [ ] **Step 1.4: Run the tests to verify they pass**

Run: `pnpm android:test`
Expected: PASS, including the three new codec tests.

- [ ] **Step 1.5: Commit**

```bash
git add apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyCodec.kt apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyStore.kt apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyReceiver.kt apps/android/app/src/test/kotlin/space/fishhub/android/messaging/ChatReplyCodecTest.kt
git commit -m "feat(android): carry the notified message id in queued notification replies"
```

---

### Task 2: Android — MessagingStyle notifications, widened IDs, reply echo, failure notice

Rebuild `ChatNotificationFactory` around `NotificationCompat.MessagingStyle`: real message text (or the generic fallback line), history restored from the active notification, a reply-echo append, a widened collision-safe ID range, and a calm failure notice. The reply action's PendingIntent additionally carries the message ID for Task 6.

**Files:**
- Modify: `apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatNotificationFactory.kt`
- Modify: `apps/android/app/src/main/res/values/strings.xml`
- Test: `apps/android/app/src/test/kotlin/space/fishhub/android/messaging/ChatNotificationIdsTest.kt`

- [ ] **Step 2.1: Write the failing ID test**

```kotlin
package space.fishhub.android.messaging

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatNotificationIdsTest {
    private val samples = (0 until 500).map { "conversation-$it" }

    @Test
    fun `message ids are stable and stay inside their own range`() {
        samples.forEach { conversationId ->
            val id = ChatNotificationFactory.notificationId(conversationId)
            assertEquals(id, ChatNotificationFactory.notificationId(conversationId))
            assertTrue(id in 100_000 until 1_100_000)
        }
    }

    @Test
    fun `failure ids stay inside their own range`() {
        samples.forEach { conversationId ->
            val id = ChatNotificationFactory.replyFailureNotificationId(conversationId)
            assertTrue(id in 2_000_000 until 3_000_000)
        }
    }

    @Test
    fun `ranges avoid the call notification buckets`() {
        // Calls occupy 6_100 until 6_900 (CallNotificationFactory); the legacy
        // chat scheme occupied 7_100 until 7_900. Both new ranges start above.
        assertTrue(ChatNotificationFactory.notificationId("any") >= 100_000)
        assertTrue(ChatNotificationFactory.replyFailureNotificationId("any") >= 2_000_000)
    }
}
```

- [ ] **Step 2.2: Run the test to verify it fails**

Run: `pnpm android:test`
Expected: FAIL — `replyFailureNotificationId` unresolved; the existing `notificationId` returns values in `7_100 until 7_900`.

- [ ] **Step 2.3: Add strings**

In `apps/android/app/src/main/res/values/strings.xml`, after `chat_notification_reply_hint`:

```xml
    <string name="chat_notification_you">You</string>
    <string name="chat_notification_reply_failed_title">Your reply didn’t send</string>
    <string name="chat_notification_reply_failed_body">Tap to open the conversation and try again.</string>
```

- [ ] **Step 2.4: Rewrite the factory**

Replace the body of `ChatNotificationFactory.kt` with:

```kotlin
package space.fishhub.android.messaging

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import space.fishhub.android.MainActivity
import space.fishhub.android.R

internal object ChatNotificationFactory {
    const val ChannelId = "fish-messages-v1"

    fun show(context: Context, push: ChatPushMessage, messageText: String?) {
        if (!canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        ensureChannel(context, manager)
        manager.notify(notificationId(push.conversationId), build(context, push, messageText))
    }

    fun build(context: Context, push: ChatPushMessage, messageText: String?): Notification {
        val sender = Person.Builder().setName(push.senderName).setKey(push.senderId).build()
        val line = messageText ?: context.getString(R.string.chat_notification_message)
        val style = activeMessagingStyle(context, push.conversationId)
            ?: NotificationCompat.MessagingStyle(selfPerson(context))
        style.addMessage(line, System.currentTimeMillis(), sender)
        return NotificationCompat.Builder(context, ChannelId)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(push.senderName)
            .setStyle(style)
            .setContentIntent(contentIntent(context, push))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setNumber(push.unreadCount)
            .setAutoCancel(true)
            .addAction(replyAction(context, push))
            .build()
    }

    /** Appends the user's own quick reply to the visible notification instead of dismissing it. */
    fun appendReply(context: Context, conversationId: String, body: String) {
        if (!canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val id = notificationId(conversationId)
        val active = manager.activeNotifications.firstOrNull { it.id == id }?.notification ?: return
        val style = NotificationCompat.MessagingStyle
            .extractMessagingStyleFromNotification(active) ?: return
        style.addMessage(body, System.currentTimeMillis(), null as Person?)
        val rebuilt = NotificationCompat.Builder(context, active)
            .setStyle(style)
            .build()
        manager.notify(id, rebuilt)
    }

    /** One calm notice when a queued reply ultimately cannot send. */
    fun showReplyFailure(context: Context, conversationId: String?, messageId: String?) {
        if (!canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        ensureChannel(context, manager)
        val intent = if (conversationId != null && messageId != null) {
            Intent(context, MainActivity::class.java)
                .setAction(ChatIntents.ActionOpenMessage)
                .putExtra(ChatIntents.ExtraConversationId, conversationId)
                .putExtra(ChatIntents.ExtraMessageId, messageId)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        } else {
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            replyFailureNotificationId(conversationId.orEmpty()),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, ChannelId)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(context.getString(R.string.chat_notification_reply_failed_title))
            .setContentText(context.getString(R.string.chat_notification_reply_failed_body))
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .build()
        manager.notify(replyFailureNotificationId(conversationId.orEmpty()), notification)
    }

    fun clear(context: Context, conversationId: String) {
        context.getSystemService(NotificationManager::class.java)
            .cancel(notificationId(conversationId))
    }

    fun notificationId(conversationId: String): Int =
        MessageIdRangeStart + (conversationId.hashCode() and Int.MAX_VALUE) % MessageIdRangeSize

    fun replyFailureNotificationId(conversationId: String): Int =
        FailureIdRangeStart + (conversationId.hashCode() and Int.MAX_VALUE) % MessageIdRangeSize

    private const val MessageIdRangeStart = 100_000
    private const val MessageIdRangeSize = 1_000_000
    private const val FailureIdRangeStart = 2_000_000

    private fun canNotify(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun selfPerson(context: Context): Person =
        Person.Builder().setName(context.getString(R.string.chat_notification_you)).build()

    private fun activeMessagingStyle(
        context: Context,
        conversationId: String,
    ): NotificationCompat.MessagingStyle? {
        val manager = context.getSystemService(NotificationManager::class.java)
        val id = notificationId(conversationId)
        val active = manager.activeNotifications.firstOrNull { it.id == id }?.notification
            ?: return null
        return NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(active)
    }

    private fun ensureChannel(context: Context, manager: NotificationManager) {
        manager.createNotificationChannel(
            NotificationChannel(
                ChannelId,
                context.getString(R.string.chat_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.chat_channel_description)
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            },
        )
    }

    private fun contentIntent(context: Context, push: ChatPushMessage): PendingIntent =
        PendingIntent.getActivity(
            context,
            push.conversationId.hashCode(),
            Intent(context, MainActivity::class.java)
                .setAction(ChatIntents.ActionOpenMessage)
                .putExtra(ChatIntents.ExtraConversationId, push.conversationId)
                .putExtra(ChatIntents.ExtraMessageId, push.messageId)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun replyAction(context: Context, push: ChatPushMessage): NotificationCompat.Action {
        val intent = Intent(context, ChatReplyReceiver::class.java)
            .putExtra(ChatIntents.ExtraConversationId, push.conversationId)
            .putExtra(ChatIntents.ExtraMessageId, push.messageId)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            push.conversationId.hashCode() xor 0x52_45_50,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
        val input = RemoteInput.Builder(ChatReplyReceiver.RemoteInputKey)
            .setLabel(context.getString(R.string.chat_notification_reply_hint))
            .build()
        return NotificationCompat.Action.Builder(
            R.drawable.ic_call_notification,
            context.getString(R.string.chat_notification_reply),
            pendingIntent,
        ).addRemoteInput(input).build()
    }
}
```

Update the one existing `show` call in `CallPushMessagingService.onMessageReceived` to compile (`ChatNotificationFactory.show(this, it, messageText = null)` — Task 3 replaces this with the real fetch).

Note: notifications posted under the legacy `7_100`-range IDs before this update are orphaned by the ID change; they still dismiss on tap (`setAutoCancel`), which is acceptable one-time update behavior.

- [ ] **Step 2.5: Run the tests to verify they pass**

Run: `pnpm android:test`
Expected: PASS, including `ChatNotificationIdsTest`.

- [ ] **Step 2.6: Commit**

```bash
git add apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatNotificationFactory.kt apps/android/app/src/main/kotlin/space/fishhub/android/calling/CallPushMessagingService.kt apps/android/app/src/main/res/values/strings.xml apps/android/app/src/test/kotlin/space/fishhub/android/messaging/ChatNotificationIdsTest.kt
git commit -m "feat(android): render chat notifications with MessagingStyle and widened ids"
```

#### As-built amendments (post-review; commit "fix(android): quiet reply echoes and carry real message timestamps")

Code review against the androidx sources changed six things relative to the block above; any re-run must include them:

1. `appendReply`'s rebuilt notification adds `.setOnlyAlertOnce(true)` — the recover-builder does not carry a set flag, so without it replying re-alerts the user for their own message.
2. `showReplyFailure`'s builder adds `.setOnlyAlertOnce(true)` — several failures can land on one notification ID and must alert once. `build()` deliberately does NOT set it; inbound messages still alert.
3. `messageText: String?` became `message: ChatNotificationMessage?` where `internal data class ChatNotificationMessage(val text: String, val sentAtMillis: Long?)` sits above the factory object — FCM delivery can lag (Doze), so lines render with the server's sent time, falling back to now when `sentAtMillis` is null.
4. `build()` is private — `show` is its only caller and it is not a pure builder (it reads active notifications).
5. `showReplyFailure` computes its notification ID once and builds one intent, adding the deep-link action/extras onto it only when both IDs are present.
6. `contentIntent`'s request code is `notificationId(push.conversationId)` (not the raw hash) so content and failure request codes are disjoint by construction.

The ID test gained two cases: distinctness across the 500 fixed samples (threshold `>= samples.size - 2` tolerates deterministic birthday collisions while failing loudly on any 800-bucket regression) and per-conversation disjointness of message/failure/call IDs, calling `CallNotificationFactory.notificationId` directly.

Consciously declined from the same review: sourcing notification history from Room instead of the active-notification extract. The shade-extract race can drop one echoed line when two pushes land back-to-back; the newest message always renders and the store keeps the reply durable, so the failure is cosmetic and self-healing. Revisit only with device evidence.

---

### Task 3: Android — fetch the pushed message text on receipt

Payloads stay content-free. On push receipt, fetch the message over the existing authorized `refreshMessages` read, bounded to 5 seconds, falling back to the generic line on any failure (signed out, offline, unknown conversation, deleted or bodyless message). The resolver returns a `ChatNotificationMessage` (text plus the server's sent time parsed from `createdAt`; `sentAtMillis` null when unparseable) so the notification renders real timestamps.

**Files:**
- Create: `apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatPushContentResolver.kt`
- Modify: `apps/android/app/src/main/kotlin/space/fishhub/android/calling/CallPushMessagingService.kt`
- Test: `apps/android/app/src/test/kotlin/space/fishhub/android/messaging/ChatPushContentResolverTest.kt`

- [ ] **Step 3.1: Write the failing resolver test**

```kotlin
package space.fishhub.android.messaging

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.UserRole

class ChatPushContentResolverTest {
    private val push = ChatPushMessage(
        conversationId = "conv-1",
        messageId = "msg-1",
        senderId = "sender-1",
        senderName = "Maria",
        unreadCount = 1,
    )

    private fun message(
        id: String,
        body: String,
        createdAt: String = "1970-01-01T00:00:02Z",
    ) = ChatMessage(
        id = id,
        conversationId = "conv-1",
        senderId = "sender-1",
        senderRole = UserRole.Coach,
        body = body,
        clientRequestId = "req-$id",
        createdAt = createdAt,
    )

    @Test
    fun `returns the fetched body and sent time for the pushed message`() = runBlocking {
        val resolved = ChatPushContentResolver.resolve(
            push,
            isSignedIn = { true },
            refreshMessages = { _, _ -> ChatResult.Success(listOf(message("msg-1", "Hi there"))) },
        )
        assertEquals(ChatNotificationMessage("Hi there", 2_000L), resolved)
    }

    @Test
    fun `keeps the text but drops the timestamp when createdAt is unparseable`() = runBlocking {
        val resolved = ChatPushContentResolver.resolve(
            push,
            isSignedIn = { true },
            refreshMessages = { _, _ ->
                ChatResult.Success(listOf(message("msg-1", "Hi", createdAt = "not-a-time")))
            },
        )
        assertEquals(ChatNotificationMessage("Hi", null), resolved)
    }

    @Test
    fun `falls back when signed out, failed, missing, or blank`() = runBlocking {
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { false },
                refreshMessages = { _, _ -> ChatResult.Success(listOf(message("msg-1", "Hi"))) },
            ),
        )
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { true },
                refreshMessages = { _, _ ->
                    ChatResult.Failure("no", recoverable = true, category = FailureCategory.Network)
                },
            ),
        )
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { true },
                refreshMessages = { _, _ -> ChatResult.Success(listOf(message("msg-2", "Other"))) },
            ),
        )
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { true },
                refreshMessages = { _, _ -> ChatResult.Success(listOf(message("msg-1", "   "))) },
            ),
        )
    }
}
```

(Verified against the data module: `ChatMessage` and `UserRole` live in `space.fishhub.android.data.chat.model`, `UserRole` values are `Client`/`Coach`, and `ChatResult.Failure("…", recoverable = …, category = …)` is the exact shape `DefaultChatRepository` itself constructs.)

- [ ] **Step 3.2: Run the test to verify it fails**

Run: `pnpm android:test`
Expected: FAIL — `ChatPushContentResolver` unresolved.

- [ ] **Step 3.3: Implement the resolver and wire the service**

Create `ChatPushContentResolver.kt`:

```kotlin
package space.fishhub.android.messaging

import java.time.Instant
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.model.ChatMessage

/**
 * Resolves the pushed message's content over the authorized RLS read.
 * Payloads stay content-free; any failure falls back to the generic
 * notification line.
 */
internal object ChatPushContentResolver {
    suspend fun resolve(push: ChatPushMessage, repository: ChatRepository): ChatNotificationMessage? =
        resolve(
            push,
            isSignedIn = { repository.authState.value is ChatAuthState.SignedIn },
            refreshMessages = repository::refreshMessages,
        )

    internal suspend fun resolve(
        push: ChatPushMessage,
        isSignedIn: () -> Boolean,
        refreshMessages: suspend (String, List<String>) -> ChatResult<List<ChatMessage>>,
    ): ChatNotificationMessage? {
        if (!isSignedIn()) return null
        val result = refreshMessages(push.conversationId, listOf(push.messageId))
        val message = (result as? ChatResult.Success)?.value
            ?.firstOrNull { it.id == push.messageId }
            ?: return null
        if (message.deletedAt != null) return null
        val text = message.body.takeIf(String::isNotBlank) ?: return null
        return ChatNotificationMessage(
            text = text,
            sentAtMillis = runCatching { Instant.parse(message.createdAt).toEpochMilli() }.getOrNull(),
        )
    }
}
```

In `CallPushMessagingService.kt`, replace the chat branch of `onMessageReceived`:

```kotlin
    override fun onMessageReceived(message: RemoteMessage) {
        ChatPushMessage.parse(message.data)?.let { push ->
            val app = application as FishApplication
            // onMessageReceived already runs on a background thread; FCM allows
            // brief work here. Bounded so a slow network can never stall the
            // notification past the delivery window.
            val content = runBlocking {
                withTimeoutOrNull(5_000) {
                    runCatching { ChatPushContentResolver.resolve(push, app.chatRepository) }
                        .getOrNull()
                }
            }
            ChatNotificationFactory.show(this, push, content)
            return
        }
        CallPushMessage.parse(message.data)?.let {
            (application as FishApplication).callCoordinator.receivePush(it)
        }
    }
```

Add the imports `kotlinx.coroutines.runBlocking` and `kotlinx.coroutines.withTimeoutOrNull`.

- [ ] **Step 3.4: Run the tests to verify they pass**

Run: `pnpm android:test`
Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatPushContentResolver.kt apps/android/app/src/main/kotlin/space/fishhub/android/calling/CallPushMessagingService.kt apps/android/app/src/test/kotlin/space/fishhub/android/messaging/ChatPushContentResolverTest.kt
git commit -m "feat(android): show real message text in chat notifications via the authorized read"
```

#### As-built amendments (post-review; commit "fix(android): await settled auth and guard the push content fetch")

Code review found a cold-start defect plus four smaller items; any re-run must include:

1. The auth gate awaits settled state instead of snapshotting: `internal suspend fun StateFlow<ChatAuthState>.settled(): ChatAuthState = first { it !is ChatAuthState.Loading }` (in ChatPushContentResolver.kt) and the production binding is `isSignedIn = { repository.authState.settled() is ChatAuthState.SignedIn }`, with the seam widened to `isSignedIn: suspend () -> Boolean`. Without this, an FCM cold start reads `Loading` and silently renders the generic line exactly when the app has been closed longest.
2. The fetched message must match the push's conversation too: `firstOrNull { it.id == push.messageId && it.conversationId == push.conversationId }` — a malformed push can otherwise render one conversation's text in another's thread and reconcile it into the wrong Room rows.
3. The service skips the fetch entirely when notifications cannot post: `if (!ChatNotificationFactory.canNotify(this)) return` before the fetch (`canNotify` became internal).
4. `apps/android/app/src/main/kotlin/space/fishhub/android/messaging/SuspendRunCatching.kt` adds `internal suspend fun <T> suspendRunCatching(block: suspend () -> T): T?`, which rethrows `CancellationException`. The service uses it instead of `runCatching { … }.getOrNull()`; Tasks 5–6 use it for every guarded suspend call — a swallowed cancellation would keep a cancelled worker looping and break `withTimeoutOrNull`.
5. The resolver's KDoc names the real transport (chat-command Edge Function plus hydration queries, several sequential round trips) rather than "the RLS read".

Consciously accepted from the same review: FCM serializes `onMessageReceived` on one thread, so a burst queues at up to 5 s per message. Collapse keys (`fish_message_<conversationId>`) bound only the offline backlog — a live burst still serializes on-device and delays the tail notification (roughly 25 s across six rapid messages). Accepted because a live burst usually means the user is already at the device, the eventual outcome is at worst the generic line — never loss — and a batch budget is real complexity; revisit with device evidence. Also accepted: a push for a conversation not yet in the Room cache (a brand-new conversation's first message) renders the generic line; and a foreground push duplicates work realtime is already doing.

Tests grew to five: the two review cases are `ignores a fetched message from another conversation` and `settled waits out the loading state` (asserted via the `SignedOut` data object so no `SignedIn` construction is needed).

---

### Task 4: Android — expose the pending text-outbox count

The drain worker needs to know whether a conversation still has queued sends after a flush, to keep retrying with backoff. Add a count read beside the existing `flushTextOutbox`.

**Files:**
- Modify: `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatRepository.kt` (interface, near `flushTextOutbox` at line ~388)
- Modify: `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt` (near `flushTextOutbox` at line ~571)

- [ ] **Step 4.1: Add the interface member with a safe default**

In `ChatRepository.kt`, directly under `flushTextOutbox`:

```kotlin
    /** Number of plain-text sends still queued locally for this conversation. */
    suspend fun pendingTextSendCount(conversationId: String): Int = 0
```

- [ ] **Step 4.2: Implement it in `DefaultChatRepository.kt`**

Directly under the `flushTextOutbox` implementation:

```kotlin
    override suspend fun pendingTextSendCount(conversationId: String): Int {
        val conversation = dao.conversation(conversationId)?.toDomain() ?: return 0
        return dao.pendingTextSends(conversationId, conversation.currentUserId).size
    }
```

This is a passthrough over the same `dao.pendingTextSends` query `flushTextOutbox` already uses; its behavior is exercised by the Task 5 drain tests through the injected count function and by the existing outbox device coverage.

- [ ] **Step 4.3: Run the tests and commit**

Run: `pnpm android:test`
Expected: PASS (no behavior change yet).

```bash
git add apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatRepository.kt apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt
git commit -m "feat(android): expose the pending text outbox count"
```

---

### Task 5: Android — testable drain logic

Extract the drain from `FishApplication` into a pure class with injected dependencies. New behavior over today's drain: mark-read up to the notified message, failure notices, draft preservation at retry exhaustion, and outbox flushing with a retry signal.

**Files:**
- Create: `apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyDrain.kt`
- Test: `apps/android/app/src/test/kotlin/space/fishhub/android/messaging/ChatReplyDrainTest.kt`

- [ ] **Step 5.1: Write the failing drain tests**

```kotlin
package space.fishhub.android.messaging

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.AuthorizedChatIdentity
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.UserRole

class ChatReplyDrainTest {
    private val reply = PendingChatReply("reply-1", "conv-1", "hello", "msg-1")

    private class Recorder {
        val removed = mutableListOf<String>()
        val markedRead = mutableListOf<Pair<String, String>>()
        val flushed = mutableListOf<String>()
        val drafts = mutableListOf<Pair<String, String>>()
        val notices = mutableListOf<Pair<String?, String?>>()
    }

    private fun sentMessage() = ChatMessage(
        id = "server-1",
        conversationId = "conv-1",
        senderId = "me",
        senderRole = UserRole.Client,
        body = "hello",
        clientRequestId = "reply-1",
        createdAt = "2026-07-30T00:00:00Z",
    )

    private fun directory(vararg conversationIds: String): ChatResult<AuthorizedChatDirectory> =
        ChatResult.Success(
            AuthorizedChatDirectory(
                currentUser = AuthorizedChatIdentity(
                    userId = "me",
                    role = UserRole.Client,
                    displayName = "Me",
                ),
                conversations = conversationIds.map { sampleConversation(it) },
            ),
        )

    private fun drain(
        recorder: Recorder,
        entries: List<PendingChatReply> = listOf(reply),
        listConversations: suspend () -> ChatResult<AuthorizedChatDirectory> = { directory("conv-1") },
        send: suspend (String, String, String) -> ChatResult<ChatMessage> =
            { _, _, _ -> ChatResult.Success(sentMessage()) },
        pendingOutboxCount: suspend (String) -> Int = { 0 },
    ) = ChatReplyDrain(
        pending = { entries },
        remove = { recorder.removed += it },
        listConversations = listConversations,
        send = send,
        markRead = { conversationId, messageId -> recorder.markedRead += conversationId to messageId },
        flushOutbox = { recorder.flushed += it },
        pendingOutboxCount = pendingOutboxCount,
        saveDraft = { conversationId, body -> recorder.drafts += conversationId to body },
        notifyFailure = { conversationId, messageId -> recorder.notices += conversationId to messageId },
    )

    @Test
    fun `sends, marks read, flushes, and removes on success`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(recorder).run(attempt = 0)
        assertEquals(ChatReplyDrain.Outcome.Done, outcome)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf("conv-1" to "msg-1"), recorder.markedRead)
        assertEquals(listOf("conv-1"), recorder.flushed)
        assertTrue(recorder.notices.isEmpty())
    }

    @Test
    fun `skips mark read when the reply has no message id`() = runBlocking {
        val recorder = Recorder()
        drain(recorder, entries = listOf(reply.copy(messageId = null))).run(attempt = 0)
        assertTrue(recorder.markedRead.isEmpty())
        assertEquals(listOf("reply-1"), recorder.removed)
    }

    @Test
    fun `drops unauthorized replies with a generic notice`() = runBlocking {
        val recorder = Recorder()
        drain(recorder, listConversations = { directory("other-conv") }).run(attempt = 0)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf<Pair<String?, String?>>(null to null), recorder.notices)
        assertTrue(recorder.markedRead.isEmpty())
    }

    @Test
    fun `retries when the directory read fails`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            listConversations = {
                ChatResult.Failure("offline", recoverable = true, category = FailureCategory.Network)
            },
        ).run(attempt = 0)
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.removed.isEmpty())
    }

    @Test
    fun `drops with a notice on authorization failure`() = runBlocking {
        val recorder = Recorder()
        drain(
            recorder,
            send = { _, _, _ ->
                ChatResult.Failure("gone", recoverable = false, category = FailureCategory.Authorization)
            },
        ).run(attempt = 0)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf<Pair<String?, String?>>("conv-1" to "msg-1"), recorder.notices)
    }

    @Test
    fun `keeps other failures durable and signals retry`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            send = { _, _, _ ->
                ChatResult.Failure("later", recoverable = true, category = FailureCategory.Remote)
            },
        ).run(attempt = 0)
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.removed.isEmpty())
        assertTrue(recorder.notices.isEmpty())
    }

    @Test
    fun `retries while the outbox still holds queued sends`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(recorder, pendingOutboxCount = { 1 }).run(attempt = 0)
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertEquals(listOf("reply-1"), recorder.removed)
    }

    @Test
    fun `exhaustion saves drafts, notices, and stops`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(recorder).run(attempt = ChatReplyDrain.MaxAttempts)
        assertEquals(ChatReplyDrain.Outcome.Done, outcome)
        assertEquals(listOf("conv-1" to "hello"), recorder.drafts)
        assertEquals(listOf<Pair<String?, String?>>("conv-1" to "msg-1"), recorder.notices)
        assertEquals(listOf("reply-1"), recorder.removed)
    }

    @Test
    fun `empty store is done without side effects`() = runBlocking {
        val recorder = Recorder()
        assertEquals(ChatReplyDrain.Outcome.Done, drain(recorder, entries = emptyList()).run(attempt = 0))
        assertTrue(recorder.removed.isEmpty() && recorder.flushed.isEmpty())
    }

    private fun sampleConversation(id: String) =
        space.fishhub.android.data.chat.AuthorizedConversation(
            conversationId = id,
            currentUserId = "me",
            currentUserRole = UserRole.Client,
            currentUserDisplayName = "Me",
            participantId = "coach",
            participantRole = UserRole.Coach,
            participantDisplayName = "Coach",
            latestMessageText = null,
            latestMessageCreatedAt = null,
            unreadCount = 0,
        )
}
```

(Verified: `AuthorizedConversation`, `AuthorizedChatIdentity`, and `AuthorizedChatDirectory` live in `space.fishhub.android.data.chat` — `ChatRepository.kt:45` — and `participantUsername`, `participantAvatarUrl`, and `mute` all have defaults, so the fixture above compiles as written.)

- [ ] **Step 5.2: Run the tests to verify they fail**

Run: `pnpm android:test`
Expected: FAIL — `ChatReplyDrain` unresolved.

- [ ] **Step 5.3: Implement the drain**

Create `ChatReplyDrain.kt`:

```kotlin
package space.fishhub.android.messaging

import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.model.ChatMessage

/**
 * Delivery logic for queued notification replies. The worker owns retries;
 * this class owns the decisions. Marking read happens as soon as the reply is
 * processed for an authorized conversation — replying proves the user read
 * the notified message, independent of whether this send attempt succeeds.
 */
internal class ChatReplyDrain(
    private val pending: () -> List<PendingChatReply>,
    private val remove: (String) -> Unit,
    private val listConversations: suspend () -> ChatResult<AuthorizedChatDirectory>,
    private val send: suspend (conversationId: String, body: String, clientRequestId: String) -> ChatResult<ChatMessage>,
    private val markRead: suspend (conversationId: String, messageId: String) -> Unit,
    private val flushOutbox: suspend (conversationId: String) -> Unit,
    private val pendingOutboxCount: suspend (conversationId: String) -> Int,
    private val saveDraft: suspend (conversationId: String, body: String) -> Unit,
    private val notifyFailure: (conversationId: String?, messageId: String?) -> Unit,
) {
    enum class Outcome { Done, Retry }

    suspend fun run(attempt: Int): Outcome {
        val entries = pending()
        if (entries.isEmpty()) return Outcome.Done
        if (attempt >= MaxAttempts) {
            entries.forEach { reply ->
                suspendRunCatching { saveDraft(reply.conversationId, reply.body) }
                notifyFailure(reply.conversationId, reply.messageId)
                remove(reply.id)
            }
            return Outcome.Done
        }
        val directory = listConversations()
        if (directory !is ChatResult.Success) return Outcome.Retry
        val allowed = directory.value.conversations.mapTo(mutableSetOf()) { it.conversationId }
        var retry = false
        val flushTargets = mutableSetOf<String>()
        entries.forEach { reply ->
            if (reply.conversationId !in allowed) {
                // The current account cannot access this conversation; a reply
                // must not survive an account switch. The notice cannot deep
                // link anywhere useful.
                remove(reply.id)
                notifyFailure(null, null)
                return@forEach
            }
            reply.messageId?.let { messageId ->
                suspendRunCatching { markRead(reply.conversationId, messageId) }
            }
            when (val result = send(reply.conversationId, reply.body, reply.id)) {
                is ChatResult.Success -> {
                    remove(reply.id)
                    flushTargets += reply.conversationId
                }
                is ChatResult.Failure -> when (result.category) {
                    FailureCategory.Authentication, FailureCategory.Authorization -> {
                        remove(reply.id)
                        notifyFailure(reply.conversationId, reply.messageId)
                    }
                    else -> retry = true
                }
            }
        }
        flushTargets.forEach { conversationId ->
            suspendRunCatching { flushOutbox(conversationId) }
            val remaining = suspendRunCatching { pendingOutboxCount(conversationId) } ?: 0
            if (remaining > 0) retry = true
        }
        return if (retry) Outcome.Retry else Outcome.Done
    }

    companion object {
        const val MaxAttempts = 7
    }
}
```

- [ ] **Step 5.4: Run the tests to verify they pass**

Run: `pnpm android:test`
Expected: PASS — all nine drain tests.

- [ ] **Step 5.5: Commit**

```bash
git add apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyDrain.kt apps/android/app/src/test/kotlin/space/fishhub/android/messaging/ChatReplyDrainTest.kt
git commit -m "feat(android): add the notification reply drain with read marking and honest failure"
```

---

### Task 6: Android — worker, receiver echo, and application wiring

Move execution into WorkManager, make the receiver echo the reply instead of dismissing the notification, and retire the `callScope` drain.

**Files:**
- Create: `apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyDrainWorker.kt`
- Modify: `apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyReceiver.kt`
- Modify: `apps/android/app/src/main/kotlin/space/fishhub/android/FishApplication.kt`

- [ ] **Step 6.1: Create the worker**

```kotlin
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
            saveDraft = { conversationId, body -> repository.saveDraft(conversationId, body) },
            notifyFailure = { conversationId, messageId ->
                ChatNotificationFactory.showReplyFailure(app, conversationId, messageId)
            },
        )
        return when (drain.run(runAttemptCount)) {
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
```

- [ ] **Step 6.2: Update the receiver**

Replace `ChatReplyReceiver.onReceive`:

```kotlin
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
```

Remove the now-unused `kotlinx.coroutines.launch` import.

- [ ] **Step 6.3: Rewire `FishApplication`**

Delete the whole `processPendingChatReplies()` function (lines 99–123) and its now-unused imports (`ChatRepository` stays — the `chatRepository` property uses it; remove `OutgoingMessageContent` and `ChatResult` if nothing else references them). Replace the auth collector in `onCreate`:

```kotlin
        callScope.launch {
            chatRepository.authState.collectLatest { auth ->
                when (auth) {
                    is ChatAuthState.SignedIn ->
                        ChatReplyDrainWorker.enqueue(this@FishApplication)
                    ChatAuthState.SignedOut -> {
                        ChatReplyStore.clear(this@FishApplication)
                        ChatReplyDrainWorker.cancel(this@FishApplication)
                    }
                    ChatAuthState.Loading -> Unit
                }
            }
        }
```

Add the import `space.fishhub.android.messaging.ChatReplyDrainWorker`.

- [ ] **Step 6.4: Run the platform gates**

Run: `pnpm android:test`
Expected: PASS.

Run: `pnpm android:assemble`
Expected: BUILD SUCCESSFUL (worker, receiver, and application compile together).

- [ ] **Step 6.5: Commit**

```bash
git add apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyDrainWorker.kt apps/android/app/src/main/kotlin/space/fishhub/android/messaging/ChatReplyReceiver.kt apps/android/app/src/main/kotlin/space/fishhub/android/FishApplication.kt
git commit -m "feat(android): drain notification replies through WorkManager with reply echo"
```

---

### Task 7: iOS — reply model carries the notified message ID

**Files:**
- Modify: `apps/ios/FishKit/Sources/ChatData/Models/ChatNotificationReply.swift`
- Modify: `apps/ios/App/Sources/FishAppDelegate.swift` (reply construction, line ~124)
- Test: `apps/ios/FishKit/Tests/ChatDataTests/ChatNotificationReplyTests.swift` (create; if a reply-store test file already exists in `ChatDataTests`, add these tests there instead)

- [ ] **Step 7.1: Write the failing FishKit tests (swift-testing)**

```swift
import Foundation
import Testing
@testable import ChatData

struct ChatNotificationReplyTests {
    @Test func decodesLegacyPayloadWithoutMessageId() throws {
        let legacy = Data(#"{"id":"a","conversationId":"c","body":"hi","createdAt":0}"#.utf8)
        let reply = try JSONDecoder().decode(ChatNotificationReply.self, from: legacy)
        #expect(reply.messageId == nil)
        #expect(reply.body == "hi")
    }

    @Test func roundTripsMessageId() throws {
        let reply = ChatNotificationReply(conversationId: "c", body: "hi", messageId: "m")
        let decoded = try JSONDecoder().decode(
            ChatNotificationReply.self,
            from: JSONEncoder().encode(reply)
        )
        #expect(decoded == reply)
        #expect(decoded.messageId == "m")
    }
}
```

- [ ] **Step 7.2: Run to verify failure**

Run: `pnpm ios:test`
Expected: FAIL — `ChatNotificationReply` has no `messageId`.

- [ ] **Step 7.3: Extend the model**

```swift
public struct ChatNotificationReply: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let conversationId: String
    public let body: String
    public let messageId: String?
    public let createdAt: Date

    public init(
        id: String = UUID().uuidString.lowercased(),
        conversationId: String,
        body: String,
        messageId: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.conversationId = conversationId
        self.body = body
        self.messageId = messageId
        self.createdAt = createdAt
    }
}
```

(Synthesized Codable decodes absent `messageId` as `nil`; `FileChatNotificationReplyStore` needs no change.)

In `FishAppDelegate.swift`, the reply branch already has `messageId` parsed a few lines above; carry it:

```swift
                let reply = ChatNotificationReply(
                    conversationId: conversationId,
                    body: body,
                    messageId: messageId
                )
```

- [ ] **Step 7.4: Run to verify pass, then commit**

Run: `pnpm ios:test`
Expected: PASS.

```bash
git add apps/ios/FishKit/Sources/ChatData/Models/ChatNotificationReply.swift apps/ios/FishKit/Tests/ChatDataTests/ChatNotificationReplyTests.swift apps/ios/App/Sources/FishAppDelegate.swift
git commit -m "feat(ios): carry the notified message id in queued notification replies"
```

---

### Task 8: iOS — drain marks read, saves drafts, and posts honest failure notices

Extract the drain decisions into a testable value (`NotificationReplyDrainer`) with injected closures, then wire it in `FishAppModel.processPendingNotificationReplies` (line ~1197). Terminal failures save the composer draft and post a calm local notice whose tap routes through the existing notification-open path.

**Files:**
- Create: `apps/ios/App/Sources/NotificationReplyDrainer.swift`
- Modify: `apps/ios/App/Sources/FishAppModel.swift` (replace the body of `processPendingNotificationReplies`)
- Test: `apps/ios/App/Tests/NotificationReplyDrainerTests.swift`

- [ ] **Step 8.1: Write the failing app-target tests (XCTest, matching the existing App/Tests style)**

```swift
import ChatData
import XCTest
@testable import Fish

final class NotificationReplyDrainerTests: XCTestCase {
    private actor Recorder {
        var removed: [String] = []
        var markedRead: [(String, String)] = []
        var drafts: [(String, String)] = []
        var notices: [String] = []
        func remove(_ id: String) { removed.append(id) }
        func markRead(_ c: String, _ m: String) { markedRead.append((c, m)) }
        func draft(_ c: String, _ b: String) { drafts.append((c, b)) }
        func notice(_ id: String) { notices.append(id) }
    }

    private func reply(_ messageId: String? = "msg-1") -> ChatNotificationReply {
        ChatNotificationReply(id: "reply-1", conversationId: "conv-1", body: "hi", messageId: messageId)
    }

    private func drainer(
        recorder: Recorder,
        replies: [ChatNotificationReply],
        authorized: Bool = true,
        outcome: NotificationReplyDrainer.SendOutcome = .sent
    ) -> NotificationReplyDrainer {
        NotificationReplyDrainer(
            pendingReplies: { replies },
            remove: { await recorder.remove($0) },
            isAuthorized: { _ in authorized },
            send: { _ in outcome },
            markRead: { await recorder.markRead($0, $1) },
            saveDraft: { await recorder.draft($0, $1) },
            postFailureNotice: { await recorder.notice($0.id) }
        )
    }

    func testSentReplyMarksReadAndRemoves() async {
        let recorder = Recorder()
        let sentAny = await drainer(recorder: recorder, replies: [reply()]).run()
        XCTAssertTrue(sentAny)
        let removed = await recorder.removed
        let marked = await recorder.markedRead
        XCTAssertEqual(removed, ["reply-1"])
        XCTAssertEqual(marked.count, 1)
        XCTAssertEqual(marked[0].1, "msg-1")
    }

    func testLegacyReplyWithoutMessageIdSkipsMarkRead() async {
        let recorder = Recorder()
        _ = await drainer(recorder: recorder, replies: [reply(nil)]).run()
        let marked = await recorder.markedRead
        XCTAssertTrue(marked.isEmpty)
    }

    func testUnauthorizedReplyIsRemovedQuietly() async {
        let recorder = Recorder()
        let sentAny = await drainer(recorder: recorder, replies: [reply()], authorized: false).run()
        XCTAssertFalse(sentAny)
        let removed = await recorder.removed
        let notices = await recorder.notices
        XCTAssertEqual(removed, ["reply-1"])
        XCTAssertTrue(notices.isEmpty)
    }

    func testTerminalFailureSavesDraftNoticesAndRemoves() async {
        let recorder = Recorder()
        _ = await drainer(recorder: recorder, replies: [reply()], outcome: .terminal).run()
        let drafts = await recorder.drafts
        let notices = await recorder.notices
        let removed = await recorder.removed
        XCTAssertEqual(drafts.count, 1)
        XCTAssertEqual(drafts[0].1, "hi")
        XCTAssertEqual(notices, ["reply-1"])
        XCTAssertEqual(removed, ["reply-1"])
    }

    func testRetryLaterKeepsTheReply() async {
        let recorder = Recorder()
        let sentAny = await drainer(recorder: recorder, replies: [reply()], outcome: .retryLater).run()
        XCTAssertFalse(sentAny)
        let removed = await recorder.removed
        XCTAssertTrue(removed.isEmpty)
    }
}
```

- [ ] **Step 8.2: Run to verify failure**

Run: `cd apps/ios/App && xcodegen generate --spec project.yml && xcodebuild test -project Fish.xcodeproj -scheme Fish -destination "platform=iOS Simulator,name=${FISH_IOS_SIM:-iPhone 17 Pro}" CODE_SIGNING_ALLOWED=NO`
Expected: FAIL — `NotificationReplyDrainer` unresolved.

- [ ] **Step 8.3: Implement the drainer**

Create `NotificationReplyDrainer.swift`:

```swift
import ChatData
import Foundation

/// Delivery decisions for queued notification replies. Marking read happens
/// as soon as an authorized reply is processed — replying proves the user
/// read the notified message, independent of this send attempt's outcome.
struct NotificationReplyDrainer {
    enum SendOutcome {
        case sent
        case terminal
        case retryLater
    }

    var pendingReplies: () async -> [ChatNotificationReply]
    var remove: (String) async -> Void
    var isAuthorized: (String) -> Bool
    var send: (ChatNotificationReply) async -> SendOutcome
    var markRead: (String, String) async -> Void
    var saveDraft: (String, String) async -> Void
    var postFailureNotice: (ChatNotificationReply) async -> Void

    /// Returns whether at least one reply reached the server, so the caller
    /// can refresh the directory and application badge.
    func run() async -> Bool {
        var sentAny = false
        for reply in await pendingReplies() {
            guard isAuthorized(reply.conversationId) else {
                // The current account cannot access this conversation. Do not
                // retain a reply that could be sent after an account switch.
                await remove(reply.id)
                continue
            }
            if let messageId = reply.messageId {
                await markRead(reply.conversationId, messageId)
            }
            switch await send(reply) {
            case .sent:
                sentAny = true
                await remove(reply.id)
            case .terminal:
                await saveDraft(reply.conversationId, reply.body)
                await postFailureNotice(reply)
                await remove(reply.id)
            case .retryLater:
                break
            }
        }
        return sentAny
    }
}
```

- [ ] **Step 8.4: Wire it into `FishAppModel`**

Replace the body of `processPendingNotificationReplies()` (keep the signature and the guard):

```swift
    private func processPendingNotificationReplies() async {
        guard !isProcessingNotificationReplies,
              let session,
              let directory,
              directory.phase != .loading
        else { return }
        isProcessingNotificationReplies = true
        defer { isProcessingNotificationReplies = false }
        let conversationIds = Set(directory.conversations.map(\.conversationId))
        let drainer = NotificationReplyDrainer(
            pendingReplies: { [notificationReplyStore] in
                (try? await notificationReplyStore.pendingReplies()) ?? []
            },
            remove: { [notificationReplyStore] id in
                try? await notificationReplyStore.remove(id: id)
            },
            isAuthorized: { conversationIds.contains($0) },
            send: { reply in
                do {
                    _ = try await session.messaging.send(
                        SendChatMessageRequest(
                            conversationId: reply.conversationId,
                            body: reply.body,
                            clientRequestId: reply.id
                        )
                    )
                    return .sent
                } catch let failure as ChatCommandFailure {
                    if failure.statusCode == 401 || failure.statusCode == 403 ||
                        ["conversation_not_available", "invalid_request"].contains(failure.code) {
                        return .terminal
                    }
                    return .retryLater
                } catch {
                    return .retryLater
                }
            },
            markRead: { conversationId, messageId in
                _ = try? await session.messaging.markReadState(
                    conversationId: conversationId,
                    lastDeliveredMessageId: messageId,
                    lastReadMessageId: messageId
                )
            },
            saveDraft: { [draftStore] conversationId, body in
                guard let draftStore else { return }
                let existing = (try? await draftStore.draft(for: conversationId))?.body
                    .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                let joined = [existing, body]
                    .filter { !$0.isEmpty }
                    .joined(separator: "\n")
                try? await draftStore.saveDraft(joined, conversationId: conversationId)
            },
            postFailureNotice: { [notificationCenter] reply in
                await Self.postReplyFailureNotice(for: reply, center: notificationCenter)
            }
        )
        let sentAny = await drainer.run()
        if sentAny {
            await refreshDirectory()
        }
    }

    private static func postReplyFailureNotice(
        for reply: ChatNotificationReply,
        center: UNUserNotificationCenter
    ) async {
        let content = UNMutableNotificationContent()
        content.title = "Your reply didn’t send"
        content.body = "Tap to open the conversation and try again."
        var userInfo: [String: Any] = ["conversationId": reply.conversationId]
        if let messageId = reply.messageId {
            userInfo["messageId"] = messageId
        }
        content.userInfo = userInfo
        let request = UNNotificationRequest(
            identifier: "fish.reply-failure.\(reply.id)",
            content: content,
            trigger: nil
        )
        try? await center.add(request)
    }
```

The failure notice deliberately has no category (no Reply action on a failure notice) and no sound; its tap flows through the existing `didReceive` default-action branch into `.fishOpenConversation`.

- [ ] **Step 8.5: Run to verify pass, then commit**

Run: `cd apps/ios/App && xcodegen generate --spec project.yml && xcodebuild test -project Fish.xcodeproj -scheme Fish -destination "platform=iOS Simulator,name=${FISH_IOS_SIM:-iPhone 17 Pro}" CODE_SIGNING_ALLOWED=NO`
Expected: PASS — all five drainer tests.

```bash
git add apps/ios/App/Sources/NotificationReplyDrainer.swift apps/ios/App/Sources/FishAppModel.swift apps/ios/App/Tests/NotificationReplyDrainerTests.swift
git commit -m "feat(ios): mark read, save drafts, and notice failures when draining replies"
```

---

### Task 9: iOS — drain immediately under background execution time

Lock-screen replies from a terminated app currently sit unsent until the next foreground launch: `FishAppModel.start()` only runs from `FishRoot`'s `.task`, which a background launch never reaches. On `.fishQuickReply`, take a background-task assertion, drive `start()` if needed, await session/directory readiness with a deadline, then drain.

**Files:**
- Create: `apps/ios/App/Sources/DrainReadiness.swift`
- Modify: `apps/ios/App/Sources/FishAppModel.swift` (the `.fishQuickReply` observer at line ~1186 and a new method)
- Test: `apps/ios/App/Tests/DrainReadinessTests.swift`

- [ ] **Step 9.1: Write the failing readiness tests**

```swift
import XCTest
@testable import Fish

final class DrainReadinessTests: XCTestCase {
    func testReturnsImmediatelyWhenReady() async {
        var slept = 0
        let ready = await DrainReadiness.waitUntilReady(
            isReady: { true },
            attempts: 60,
            sleep: { slept += 1 }
        )
        XCTAssertTrue(ready)
        XCTAssertEqual(slept, 0)
    }

    func testPollsUntilReady() async {
        var polls = 0
        let ready = await DrainReadiness.waitUntilReady(
            isReady: { polls += 1; return polls >= 3 },
            attempts: 60,
            sleep: {}
        )
        XCTAssertTrue(ready)
        XCTAssertEqual(polls, 3)
    }

    func testGivesUpAfterTheDeadline() async {
        var slept = 0
        let ready = await DrainReadiness.waitUntilReady(
            isReady: { false },
            attempts: 5,
            sleep: { slept += 1 }
        )
        XCTAssertFalse(ready)
        XCTAssertEqual(slept, 5)
    }
}
```

- [ ] **Step 9.2: Run to verify failure**

Run: `cd apps/ios/App && xcodegen generate --spec project.yml && xcodebuild test -project Fish.xcodeproj -scheme Fish -destination "platform=iOS Simulator,name=${FISH_IOS_SIM:-iPhone 17 Pro}" CODE_SIGNING_ALLOWED=NO`
Expected: FAIL — `DrainReadiness` unresolved.

- [ ] **Step 9.3: Implement the readiness helper**

Create `DrainReadiness.swift`:

```swift
import Foundation

/// Bounded poll for "the chat session and directory are ready to drain".
/// Injectable sleep keeps it testable without wall-clock time.
enum DrainReadiness {
    static func waitUntilReady(
        isReady: () -> Bool,
        attempts: Int,
        sleep: () async -> Void
    ) async -> Bool {
        var remaining = attempts
        while !isReady() {
            guard remaining > 0 else { return false }
            remaining -= 1
            await sleep()
        }
        return true
    }
}
```

- [ ] **Step 9.4: Wire the background drain in `FishAppModel`**

Replace the `.fishQuickReply` observer registration (in `observeNotifications()`):

```swift
        NotificationCenter.default.addObserver(
            forName: .fishQuickReply,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.drainNotificationRepliesWithBackgroundTime()
            }
        }
```

Add the method (near `processPendingNotificationReplies`):

```swift
    /// Sends a quick reply right away, even when the notification action
    /// launched the app straight into the background — `start()` is otherwise
    /// only driven by FishRoot's `.task`, which a background launch never
    /// reaches. The assertion keeps the process alive for the attempt; a
    /// reply that cannot finish in time stays durably queued exactly as
    /// before.
    func drainNotificationRepliesWithBackgroundTime() async {
        let application = UIApplication.shared
        var taskId = UIBackgroundTaskIdentifier.invalid
        var ended = false
        func endAssertion() {
            guard !ended, taskId != .invalid else { return }
            ended = true
            application.endBackgroundTask(taskId)
        }
        taskId = application.beginBackgroundTask(withName: "fish.quick-reply-drain") {
            endAssertion()
        }
        defer { endAssertion() }
        if phase == .loading {
            await start()
        }
        // Up to ~15 s in 250 ms steps; well inside the ~30 s the system grants.
        _ = await DrainReadiness.waitUntilReady(
            isReady: { [weak self] in
                guard let self else { return true }
                return session != nil && directory != nil && directory?.phase != .loading
            },
            attempts: 60,
            sleep: { try? await Task.sleep(nanoseconds: 250_000_000) }
        )
        await processPendingNotificationReplies()
    }
```

- [ ] **Step 9.5: Run to verify pass, plus the FishKit suite**

Run: `cd apps/ios/App && xcodegen generate --spec project.yml && xcodebuild test -project Fish.xcodeproj -scheme Fish -destination "platform=iOS Simulator,name=${FISH_IOS_SIM:-iPhone 17 Pro}" CODE_SIGNING_ALLOWED=NO`
Expected: PASS.

Run: `pnpm ios:test`
Expected: PASS.

- [ ] **Step 9.6: Commit**

```bash
git add apps/ios/App/Sources/DrainReadiness.swift apps/ios/App/Sources/FishAppModel.swift apps/ios/App/Tests/DrainReadinessTests.swift
git commit -m "feat(ios): drain notification replies immediately under background time"
```

---

### Task 10: Docs — retire the stale quick-reply references

**Files:**
- Modify: `docs/native-mobile-feature-completion-plan.md` (deferred list, line ~640)
- Modify: `docs/ios-notifications-push-plan.md` (categories section, lines 47–50)

- [ ] **Step 10.1: Update the completion plan's deferred list**

Change:

```markdown
- Link previews, message forwarding, and pinning.
- Notification quick reply, custom notification actions, quiet hours, and
  per-conversation notification settings.
```

to:

```markdown
- Link previews, message forwarding, and pinning.
- Custom notification actions beyond Reply, quiet hours, and per-conversation
  notification settings beyond the shipped mute. (Notification quick reply
  shipped after this plan and was hardened by
  `docs/superpowers/specs/2026-07-30-notification-quick-reply-hardening-design.md`.)
```

(Link previews shipped separately — `enqueueLinkPreviewJob` exists in `send-message` — but correcting that line is out of this plan's scope; leave it.)

- [ ] **Step 10.2: Update the push plan's category section**

Change:

```markdown
- Direct message: Open. No inline reply until privacy, moderation, and draft
  behavior are approved.
```

to:

```markdown
- Direct message: Open, plus an inline Reply text action (shipped after this
  plan; hardened by
  `docs/superpowers/specs/2026-07-30-notification-quick-reply-hardening-design.md`).
```

- [ ] **Step 10.3: Commit**

```bash
git add docs/native-mobile-feature-completion-plan.md docs/ios-notifications-push-plan.md
git commit -m "docs: retire stale quick reply deferral notes"
```

---

### Task 11: Final verification

- [ ] **Step 11.1: Run every gate**

```bash
pnpm android:test
pnpm android:check
pnpm ios:test
pnpm ios:app:build
pnpm build
```

Expected: all PASS. (`android:check` includes the design-system, parity, screenshot, and notification-policy verifiers.)

- [ ] **Step 11.2: Append the device-matrix rows**

These join the already-outstanding physical-device release pass (they cannot be proven on simulators):

1. Android: push arrives → notification shows the real message text; offline receipt falls back to "Sent you a message".
2. Android: quick reply appends "You: …" to the notification instead of dismissing it; the conversation opens read (no unread badge) after a reply.
3. Android: reply while offline → airplane mode → reply survives process death and sends when connectivity returns; after seven failed attempts the calm notice appears and the text is in the conversation as a failed message or composer draft.
4. iOS: lock-screen reply with the app terminated → message arrives without opening the app; badge settles after the drain.
5. iOS: reply to a revoked conversation → "Your reply didn’t send" notice; tapping it opens the app calmly.
6. Both: no message text, token, or ID appears in logs during any of the above.

- [ ] **Step 11.3: Commit any test-run artifacts only if the repo tracks them (it does not) — otherwise nothing to commit**

---

## Self-review notes

- Spec coverage: content fetch (Task 3), MessagingStyle + echo + IDs (Task 2), WorkManager drain + outbox flush ownership (Tasks 4–6), iOS immediate drain (Task 9), mark read both platforms (Tasks 5, 8), honest failure both platforms (Tasks 2, 5, 6, 8), docs (Task 10), constraints (no backend changes — none made; no logging — none added).
- Every construction site in the test fixtures was verified against the real definitions before this plan was committed: packages, `UserRole` values, `ChatResult.Failure` shape, and the `AuthorizedConversation` defaults. If something still fails to compile, mirror the data-module definition; do not change the data module to fit the tests.
- Type consistency: `PendingChatReply(id, conversationId, body, messageId)` is used identically in Tasks 1, 5, 6; `NotificationReplyDrainer.SendOutcome` cases match between Tasks 8's tests and implementation; `DrainReadiness.waitUntilReady(isReady:attempts:sleep:)` matches between Task 9's tests and implementation.
