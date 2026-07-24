package space.fishhub.android.data.chat.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
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
    @ColumnInfo(name = "link_preview_json") val linkPreviewJson: String? = null,
    @ColumnInfo(name = "client_request_id") val clientRequestId: String,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "edited_at") val editedAt: String?,
    @ColumnInfo(name = "deleted_at") val deletedAt: String?,
    @ColumnInfo(name = "reply_to_message_id") val replyToMessageId: String?,
    @ColumnInfo(name = "reactions_json") val reactionsJson: String? = null,
    @ColumnInfo(name = "local_status") val localStatus: String?,
    @ColumnInfo(name = "failure_reason") val failureReason: String?,
)

@Entity(
    tableName = "message_attachments",
    foreignKeys = [
        ForeignKey(
            entity = MessageEntity::class,
            parentColumns = ["id"],
            childColumns = ["message_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index(value = ["message_id", "position"], unique = true),
        Index(value = ["conversation_id", "message_id"]),
    ],
)
data class MessageAttachmentEntity(
    @androidx.room.PrimaryKey val id: String,
    @ColumnInfo(name = "message_id") val messageId: String,
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    val position: Int,
    val kind: String,
    val available: Boolean,
    @ColumnInfo(name = "original_name") val originalName: String,
    @ColumnInfo(name = "stored_mime_type") val storedMimeType: String?,
    @ColumnInfo(name = "stored_byte_size") val storedByteSize: Long?,
    val width: Int?,
    val height: Int?,
    @ColumnInfo(name = "thumbnail_path") val thumbnailPath: String?,
    @ColumnInfo(name = "display_path") val displayPath: String?,
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

@Entity(
    tableName = "pending_text_sends",
    primaryKeys = ["conversation_id", "user_id", "client_request_id"],
    indices = [Index(value = ["conversation_id", "user_id", "created_at"])],
)
data class PendingTextSendEntity(
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "user_id") val userId: String,
    @ColumnInfo(name = "client_request_id") val clientRequestId: String,
    val body: String,
    @ColumnInfo(name = "reply_to_message_id") val replyToMessageId: String?,
    @ColumnInfo(name = "created_at") val createdAt: String,
)

@Entity(
    tableName = "attachment_drafts",
    indices = [
        Index(value = ["conversation_id", "user_id", "scope", "position"], unique = true),
        Index(value = ["conversation_id", "user_id", "sha256"], unique = true),
        Index(value = ["expires_at"]),
    ],
)
data class AttachmentDraftEntity(
    @androidx.room.PrimaryKey val id: String,
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "user_id") val userId: String,
    val position: Int,
    val kind: String,
    val scope: String,
    @ColumnInfo(name = "display_name") val displayName: String,
    @ColumnInfo(name = "source_mime_type") val sourceMimeType: String,
    @ColumnInfo(name = "stored_mime_type") val storedMimeType: String,
    @ColumnInfo(name = "byte_size") val byteSize: Long,
    @ColumnInfo(name = "source_byte_size", defaultValue = "0") val sourceByteSize: Long = byteSize,
    val width: Int?,
    val height: Int?,
    @ColumnInfo(name = "local_path") val localPath: String,
    @ColumnInfo(name = "thumbnail_path") val thumbnailPath: String?,
    val sha256: String,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
    @ColumnInfo(name = "expires_at") val expiresAt: String,
    @ColumnInfo(name = "client_upload_id", defaultValue = "") val clientUploadId: String = "",
    @ColumnInfo(name = "server_attachment_id") val serverAttachmentId: String? = null,
    @ColumnInfo(name = "transfer_state", defaultValue = "selected") val transferState: String = "selected",
    @ColumnInfo(name = "progress_bytes", defaultValue = "0") val progressBytes: Long = 0,
    @ColumnInfo(name = "attempt_count", defaultValue = "0") val attemptCount: Int = 0,
    @ColumnInfo(name = "failure_code") val failureCode: String? = null,
    @ColumnInfo(name = "retry_after") val retryAfter: String? = null,
    @ColumnInfo(name = "tus_upload_url") val tusUploadUrl: String? = null,
    @ColumnInfo(name = "tus_upload_offset", defaultValue = "0") val tusUploadOffset: Long = 0,
    @ColumnInfo(name = "tus_expires_at") val tusExpiresAt: String? = null,
)

@Entity(
    tableName = "shared_content_cache_owners",
    primaryKeys = ["owner_identity_id", "conversation_id"],
    indices = [
        Index(value = ["owner_identity_id", "last_accessed_at"]),
    ],
)
data class SharedContentCacheOwnerEntity(
    @ColumnInfo(name = "owner_identity_id") val ownerIdentityId: String,
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "schema_version") val schemaVersion: Int = 1,
    @ColumnInfo(name = "saved_at") val savedAt: String,
    @ColumnInfo(name = "last_authoritative_at") val lastAuthoritativeAt: String? = null,
    @ColumnInfo(name = "last_accessed_at") val lastAccessedAt: String,
    @ColumnInfo(name = "authoritative_empty_confirmed") val authoritativeEmptyConfirmed: Boolean = false,
    @ColumnInfo(name = "retained_oldest_cursor") val retainedOldestCursor: String? = null,
    @ColumnInfo(name = "retained_history_complete") val retainedHistoryComplete: Boolean = true,
    @ColumnInfo(name = "newest_window_protected") val newestWindowProtected: Boolean = true,
)

@Entity(
    tableName = "shared_content_cache_pages",
    primaryKeys = ["owner_identity_id", "conversation_id", "page_id"],
    indices = [
        Index(value = ["owner_identity_id", "conversation_id", "last_accessed_at"]),
        Index(value = ["owner_identity_id", "last_accessed_at"]),
        Index(value = ["owner_identity_id", "conversation_id", "page_ordinal", "retained_cursor"], unique = true),
    ],
    foreignKeys = [
        ForeignKey(
            entity = SharedContentCacheOwnerEntity::class,
            parentColumns = ["owner_identity_id", "conversation_id"],
            childColumns = ["owner_identity_id", "conversation_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
)
data class SharedContentCachePageEntity(
    @ColumnInfo(name = "owner_identity_id") val ownerIdentityId: String,
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "page_id") val pageId: String,
    @ColumnInfo(name = "page_ordinal") val pageOrdinal: Int,
    @ColumnInfo(name = "retained_cursor") val retainedCursor: String?,
    @ColumnInfo(name = "last_accessed_at") val lastAccessedAt: String,
    @ColumnInfo(name = "is_newest_window") val isNewestWindow: Boolean,
)

@Entity(
    tableName = "shared_content_cache_items",
    primaryKeys = ["owner_identity_id", "conversation_id", "item_id"],
    indices = [
        Index(value = ["owner_identity_id", "conversation_id", "source_rank", "item_id"]),
        Index(value = ["owner_identity_id", "conversation_id", "source_message_id"]),
        Index(value = ["owner_identity_id", "conversation_id", "page_id"]),
    ],
    foreignKeys = [
        ForeignKey(
            entity = SharedContentCachePageEntity::class,
            parentColumns = ["owner_identity_id", "conversation_id", "page_id"],
            childColumns = ["owner_identity_id", "conversation_id", "page_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
)
data class SharedContentCacheItemEntity(
    @ColumnInfo(name = "owner_identity_id") val ownerIdentityId: String,
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "item_id") val itemId: String,
    @ColumnInfo(name = "source_message_id") val sourceMessageId: String,
    @ColumnInfo(name = "sender_id") val senderId: String,
    @ColumnInfo(name = "source_created_at") val sourceCreatedAt: String,
    @ColumnInfo(name = "source_rank") val sourceRank: Int,
    val category: String,
    val kind: String,
    @ColumnInfo(name = "attachment_id") val attachmentId: String? = null,
    @ColumnInfo(name = "attachment_original_name") val attachmentOriginalName: String? = null,
    @ColumnInfo(name = "attachment_mime_type") val attachmentMimeType: String? = null,
    @ColumnInfo(name = "attachment_byte_size") val attachmentByteSize: Long? = null,
    @ColumnInfo(name = "attachment_width") val attachmentWidth: Int? = null,
    @ColumnInfo(name = "attachment_height") val attachmentHeight: Int? = null,
    @ColumnInfo(name = "duration_ms") val durationMs: Long? = null,
    @ColumnInfo(name = "gif_provider") val gifProvider: String? = null,
    @ColumnInfo(name = "gif_provider_content_id") val gifProviderContentId: String? = null,
    @ColumnInfo(name = "gif_title") val gifTitle: String? = null,
    @ColumnInfo(name = "gif_description") val gifDescription: String? = null,
    @ColumnInfo(name = "sticker_id") val stickerId: String? = null,
    @ColumnInfo(name = "link_metadata_json") val linkMetadataJson: String? = null,
    @ColumnInfo(name = "page_id") val pageId: String,
)
