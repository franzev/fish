package space.fishhub.android.data.chat.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatDao {
    @Query("SELECT * FROM attachment_drafts WHERE id = :id LIMIT 1")
    suspend fun attachmentDraft(id: String): AttachmentDraftEntity?

    @Query(
        """
        SELECT * FROM attachment_drafts
        WHERE conversation_id = :conversationId AND user_id = :userId
        ORDER BY CASE scope WHEN 'preview' THEN 0 ELSE 1 END, position ASC, id ASC
        """,
    )
    fun observeAttachmentDrafts(
        conversationId: String,
        userId: String,
    ): Flow<List<AttachmentDraftEntity>>

    @Query(
        """
        SELECT * FROM attachment_drafts
        WHERE conversation_id = :conversationId AND user_id = :userId
        ORDER BY CASE scope WHEN 'preview' THEN 0 ELSE 1 END, position ASC, id ASC
        """,
    )
    suspend fun attachmentDrafts(
        conversationId: String,
        userId: String,
    ): List<AttachmentDraftEntity>

    @Query("SELECT * FROM attachment_drafts WHERE conversation_id = :conversationId")
    suspend fun attachmentDraftsForConversation(conversationId: String): List<AttachmentDraftEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertAttachmentDraft(attachment: AttachmentDraftEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAttachmentDrafts(attachments: List<AttachmentDraftEntity>)

    @Query(
        """
        UPDATE attachment_drafts
        SET transfer_state = :state,
            attempt_count = attempt_count + CASE WHEN :consumeAttempt THEN 1 ELSE 0 END,
            failure_code = NULL, retry_after = NULL, updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
          AND (NOT :consumeAttempt OR attempt_count < :maximumAttempts)
        """,
    )
    suspend fun claimAttachmentTransfer(
        id: String,
        userId: String,
        conversationId: String,
        state: String,
        maximumAttempts: Int,
        consumeAttempt: Boolean,
        updatedAt: String,
    ): Int

    @Query(
        """
        UPDATE attachment_drafts
        SET attempt_count = attempt_count + 1, transfer_state = :state,
            failure_code = :failureCode, retry_after = :retryAfter, updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
          AND attempt_count < :maximumAttempts
        """,
    )
    suspend fun markAttachmentFailureConsumingAttempt(
        id: String,
        userId: String,
        conversationId: String,
        state: String,
        failureCode: String,
        retryAfter: String?,
        maximumAttempts: Int,
        updatedAt: String,
    ): Int

    @Query(
        """
        UPDATE attachment_drafts
        SET server_attachment_id = :serverAttachmentId,
            tus_upload_url = :uploadUrl,
            tus_upload_offset = :offset,
            tus_expires_at = :expiresAt,
            transfer_state = :state,
            updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
        """,
    )
    suspend fun recordAttachmentSession(
        id: String,
        userId: String,
        conversationId: String,
        serverAttachmentId: String,
        uploadUrl: String?,
        offset: Long,
        expiresAt: String?,
        state: String,
        updatedAt: String,
    ): Int

    @Query(
        """
        UPDATE attachment_drafts
        SET progress_bytes = CASE WHEN :progressBytes > progress_bytes THEN :progressBytes ELSE progress_bytes END,
            tus_upload_offset = CASE WHEN :offset > tus_upload_offset THEN :offset ELSE tus_upload_offset END,
            transfer_state = :state,
            updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
        """,
    )
    suspend fun recordAttachmentProgress(
        id: String,
        userId: String,
        conversationId: String,
        progressBytes: Long,
        offset: Long,
        state: String,
        updatedAt: String,
    ): Int

    @Query(
        """
        UPDATE attachment_drafts
        SET transfer_state = :state, progress_bytes = byte_size,
            tus_upload_offset = byte_size, tus_upload_url = NULL,
            tus_expires_at = NULL, failure_code = NULL, retry_after = NULL,
            server_attachment_id = :serverAttachmentId, updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
        """,
    )
    suspend fun markAttachmentReady(
        id: String,
        userId: String,
        conversationId: String,
        serverAttachmentId: String,
        state: String,
        updatedAt: String,
    ): Int

    @Query(
        """
        UPDATE attachment_drafts
        SET transfer_state = :state, failure_code = :failureCode,
            retry_after = :retryAfter, updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
        """,
    )
    suspend fun markAttachmentFailure(
        id: String,
        userId: String,
        conversationId: String,
        state: String,
        failureCode: String,
        retryAfter: String?,
        updatedAt: String,
    ): Int

    @Query(
        """
        UPDATE attachment_drafts
        SET transfer_state = 'waiting_for_network', failure_code = NULL,
            retry_after = NULL, attempt_count = 0, updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
          AND scope = 'composer'
        """,
    )
    suspend fun resetAttachmentForManualRetry(
        id: String,
        userId: String,
        conversationId: String,
        updatedAt: String,
    ): Int

    @Query(
        """
        UPDATE attachment_drafts
        SET tus_upload_url = NULL, tus_upload_offset = 0, tus_expires_at = NULL,
            progress_bytes = 0, updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
        """,
    )
    suspend fun clearAttachmentUploadSession(
        id: String,
        userId: String,
        conversationId: String,
        updatedAt: String,
    ): Int

    @Query(
        """
        UPDATE attachment_drafts
        SET client_upload_id = :clientUploadId, server_attachment_id = NULL,
            tus_upload_url = NULL, tus_upload_offset = 0, tus_expires_at = NULL,
            progress_bytes = 0, updated_at = :updatedAt
        WHERE id = :id AND user_id = :userId AND conversation_id = :conversationId
        """,
    )
    suspend fun rotateAttachmentUploadIdentity(
        id: String,
        userId: String,
        conversationId: String,
        clientUploadId: String,
        updatedAt: String,
    ): Int

    @Query(
        """
        SELECT * FROM attachment_drafts
        WHERE conversation_id = :conversationId AND user_id = :userId AND scope = 'composer'
        ORDER BY position ASC, id ASC
        """,
    )
    suspend fun composerAttachmentDrafts(
        conversationId: String,
        userId: String,
    ): List<AttachmentDraftEntity>

    @Query("DELETE FROM attachment_drafts WHERE id = :id")
    suspend fun deleteAttachmentDraft(id: String)

    @Query(
        """
        DELETE FROM attachment_drafts
        WHERE conversation_id = :conversationId AND user_id = :userId AND scope = :scope
        """,
    )
    suspend fun deleteAttachmentDraftsByScope(
        conversationId: String,
        userId: String,
        scope: String,
    )

    @Query("SELECT * FROM attachment_drafts WHERE expires_at <= :cutoff")
    suspend fun expiredAttachmentDrafts(cutoff: String): List<AttachmentDraftEntity>

    @Query("DELETE FROM attachment_drafts WHERE expires_at <= :cutoff")
    suspend fun deleteExpiredAttachmentDrafts(cutoff: String)

    @Query("SELECT * FROM attachment_drafts")
    suspend fun allAttachmentDrafts(): List<AttachmentDraftEntity>

    @Query("DELETE FROM attachment_drafts")
    suspend fun clearAttachmentDrafts()

    @Query(
        """
        SELECT * FROM messages
        WHERE conversation_id = :conversationId
        ORDER BY created_at ASC, id ASC
        """,
    )
    fun observeMessages(conversationId: String): Flow<List<MessageEntity>>

    @Query(
        """
        SELECT * FROM message_attachments
        WHERE conversation_id = :conversationId
        ORDER BY message_id ASC, position ASC, id ASC
        """,
    )
    fun observeMessageAttachments(conversationId: String): Flow<List<MessageAttachmentEntity>>

    @Query(
        """
        SELECT * FROM message_attachments
        WHERE message_id = :messageId
        ORDER BY position ASC, id ASC
        """,
    )
    suspend fun messageAttachments(messageId: String): List<MessageAttachmentEntity>

    @Query(
        """
        SELECT * FROM read_states
        WHERE conversation_id = :conversationId
        ORDER BY user_id ASC
        """,
    )
    fun observeReadStates(conversationId: String): Flow<List<ReadStateEntity>>

    @Query(
        """
        SELECT body FROM drafts
        WHERE conversation_id = :conversationId AND user_id = :userId
        LIMIT 1
        """,
    )
    fun observeDraft(conversationId: String, userId: String): Flow<String?>

    @Query("SELECT * FROM conversations WHERE conversation_id = :conversationId LIMIT 1")
    suspend fun conversation(conversationId: String): ConversationEntity?

    @Query(
        """
        SELECT * FROM conversations
        WHERE current_user_id = :userId
        ORDER BY latest_message_created_at DESC, conversation_id ASC
        """,
    )
    suspend fun conversations(userId: String): List<ConversationEntity>

    @Query(
        """
        SELECT * FROM messages
        WHERE conversation_id = :conversationId AND client_request_id = :clientRequestId
        LIMIT 1
        """,
    )
    suspend fun messageByRequestId(conversationId: String, clientRequestId: String): MessageEntity?

    @Query("SELECT * FROM messages WHERE id = :messageId LIMIT 1")
    suspend fun message(messageId: String): MessageEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertConversation(conversation: ConversationEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMessage(message: MessageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMessageAttachments(attachments: List<MessageAttachmentEntity>)

    @Query("DELETE FROM message_attachments WHERE message_id = :messageId")
    suspend fun deleteMessageAttachments(messageId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertReadStates(readStates: List<ReadStateEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDraft(draft: DraftEntity)

    @Query(
        """
        DELETE FROM messages
        WHERE conversation_id = :conversationId
          AND client_request_id = :clientRequestId
          AND id != :authoritativeId
        """,
    )
    suspend fun deleteRequestDuplicates(
        conversationId: String,
        clientRequestId: String,
        authoritativeId: String,
    )

    @Query(
        """
        UPDATE messages
        SET local_status = 'failed', failure_reason = :reason
        WHERE conversation_id = :conversationId AND client_request_id = :clientRequestId
        """,
    )
    suspend fun markMessageFailed(conversationId: String, clientRequestId: String, reason: String)

    @Transaction
    suspend fun reconcileMessage(
        message: MessageEntity,
        attachments: List<MessageAttachmentEntity> = emptyList(),
        replaceAttachments: Boolean = true,
    ) {
        val priorMessage = messageByRequestId(message.conversationId, message.clientRequestId)
        val retained = if (replaceAttachments) {
            attachments
        } else {
            priorMessage?.let { messageAttachments(it.id) }.orEmpty()
                .ifEmpty { messageAttachments(message.id) }
                .ifEmpty { attachments }
        }.map { it.copy(messageId = message.id, conversationId = message.conversationId) }
        deleteRequestDuplicates(message.conversationId, message.clientRequestId, message.id)
        upsertMessage(message)
        deleteMessageAttachments(message.id)
        if (retained.isNotEmpty()) upsertMessageAttachments(retained)
    }

    @Transaction
    suspend fun reconcileMessages(
        messages: List<MessageEntity>,
        attachments: List<MessageAttachmentEntity> = emptyList(),
        preserveAttachmentMessageIds: Set<String> = emptySet(),
    ) {
        val byMessage = attachments.groupBy(MessageAttachmentEntity::messageId)
        messages.forEach {
            reconcileMessage(
                it,
                byMessage[it.id].orEmpty(),
                replaceAttachments = it.id !in preserveAttachmentMessageIds,
            )
        }
    }

    @Query("DELETE FROM messages")
    suspend fun clearMessages()

    @Query("DELETE FROM read_states")
    suspend fun clearReadStates()

    @Query("DELETE FROM drafts")
    suspend fun clearDrafts()

    @Query("DELETE FROM conversations")
    suspend fun clearConversations()

    @Query("DELETE FROM messages WHERE conversation_id = :conversationId")
    suspend fun deleteConversationMessages(conversationId: String)

    @Query("DELETE FROM read_states WHERE conversation_id = :conversationId")
    suspend fun deleteConversationReadStates(conversationId: String)

    @Query("DELETE FROM drafts WHERE conversation_id = :conversationId")
    suspend fun deleteConversationDrafts(conversationId: String)

    @Query("DELETE FROM attachment_drafts WHERE conversation_id = :conversationId")
    suspend fun deleteConversationAttachmentDrafts(conversationId: String)

    @Query("DELETE FROM conversations WHERE conversation_id = :conversationId")
    suspend fun deleteConversation(conversationId: String)

    @Transaction
    suspend fun deleteConversationData(conversationId: String) {
        deleteConversationAttachmentDrafts(conversationId)
        deleteConversationMessages(conversationId)
        deleteConversationReadStates(conversationId)
        deleteConversationDrafts(conversationId)
        deleteConversation(conversationId)
    }

    @Transaction
    suspend fun clearAllUserData() {
        clearAttachmentDrafts()
        clearMessages()
        clearReadStates()
        clearDrafts()
        clearConversations()
    }
}
