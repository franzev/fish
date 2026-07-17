package space.fishhub.android.data.chat.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index

@Entity(tableName = "conversations")
data class ConversationEntity(
    @androidx.room.PrimaryKey
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "current_user_id") val currentUserId: String,
    @ColumnInfo(name = "current_user_role") val currentUserRole: String,
    @ColumnInfo(name = "current_user_display_name") val currentUserDisplayName: String,
    @ColumnInfo(name = "participant_id") val participantId: String,
    @ColumnInfo(name = "participant_role") val participantRole: String,
    @ColumnInfo(name = "participant_display_name") val participantDisplayName: String,
    @ColumnInfo(name = "latest_message_text") val latestMessageText: String?,
    @ColumnInfo(name = "latest_message_created_at") val latestMessageCreatedAt: String?,
    @ColumnInfo(name = "unread_count") val unreadCount: Int,
)

@Entity(
    tableName = "messages",
    indices = [
        Index(value = ["conversation_id", "created_at", "id"]),
        Index(value = ["conversation_id", "client_request_id"]),
    ],
)
data class MessageEntity(
    @androidx.room.PrimaryKey val id: String,
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "sender_id") val senderId: String,
    @ColumnInfo(name = "sender_role") val senderRole: String,
    @ColumnInfo(name = "sender_display_name") val senderDisplayName: String?,
    val body: String,
    @ColumnInfo(name = "sticker_id") val stickerId: String? = null,
    @ColumnInfo(name = "gif_json") val gifJson: String? = null,
    @ColumnInfo(name = "client_request_id") val clientRequestId: String,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "edited_at") val editedAt: String?,
    @ColumnInfo(name = "deleted_at") val deletedAt: String?,
    @ColumnInfo(name = "reply_to_message_id") val replyToMessageId: String?,
    @ColumnInfo(name = "local_status") val localStatus: String?,
    @ColumnInfo(name = "failure_reason") val failureReason: String?,
)

@Entity(
    tableName = "read_states",
    primaryKeys = ["conversation_id", "user_id"],
)
data class ReadStateEntity(
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "user_id") val userId: String,
    @ColumnInfo(name = "last_delivered_message_id") val lastDeliveredMessageId: String?,
    @ColumnInfo(name = "delivered_at") val deliveredAt: String?,
    @ColumnInfo(name = "last_read_message_id") val lastReadMessageId: String?,
    @ColumnInfo(name = "read_at") val readAt: String?,
)

@Entity(
    tableName = "drafts",
    primaryKeys = ["conversation_id", "user_id"],
)
data class DraftEntity(
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "user_id") val userId: String,
    val body: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
)
