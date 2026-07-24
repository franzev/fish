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
        SELECT * FROM pending_text_sends
        WHERE conversation_id = :conversationId AND user_id = :userId
        ORDER BY created_at ASC, client_request_id ASC
        """,
    )
    suspend fun pendingTextSends(conversationId: String, userId: String): List<PendingTextSendEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPendingTextSend(send: PendingTextSendEntity)

    @Query(
        """
        DELETE FROM pending_text_sends
        WHERE conversation_id = :conversationId AND user_id = :userId
          AND client_request_id = :clientRequestId
        """,
    )
    suspend fun deletePendingTextSend(
        conversationId: String,
        userId: String,
        clientRequestId: String,
    )

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

    @Query("DELETE FROM pending_text_sends")
    suspend fun clearPendingTextSends()

    @Query("DELETE FROM conversations")
    suspend fun clearConversations()

    @Query("DELETE FROM messages WHERE conversation_id = :conversationId")
    suspend fun deleteConversationMessages(conversationId: String)

    @Query("DELETE FROM read_states WHERE conversation_id = :conversationId")
    suspend fun deleteConversationReadStates(conversationId: String)

    @Query("DELETE FROM drafts WHERE conversation_id = :conversationId")
    suspend fun deleteConversationDrafts(conversationId: String)

    @Query("DELETE FROM pending_text_sends WHERE conversation_id = :conversationId")
    suspend fun deleteConversationPendingTextSends(conversationId: String)

    @Query("DELETE FROM attachment_drafts WHERE conversation_id = :conversationId")
    suspend fun deleteConversationAttachmentDrafts(conversationId: String)

    @Query(
        """
        SELECT * FROM shared_content_cache_items
        WHERE owner_identity_id = :ownerIdentityId AND conversation_id = :conversationId
        ORDER BY source_rank ASC, item_id ASC
        """,
    )
    fun observeSharedContentCacheRows(
        ownerIdentityId: String,
        conversationId: String,
    ): Flow<List<SharedContentCacheItemEntity>>

    @Query(
        """
        SELECT * FROM shared_content_cache_items
        WHERE owner_identity_id = :ownerIdentityId AND conversation_id = :conversationId
        ORDER BY source_rank ASC, item_id ASC
        """,
    )
    suspend fun readSharedContentCacheRows(
        ownerIdentityId: String,
        conversationId: String,
    ): List<SharedContentCacheItemEntity>

    @Query(
        """
        SELECT * FROM shared_content_cache_owners
        WHERE owner_identity_id = :ownerIdentityId AND conversation_id = :conversationId
        LIMIT 1
        """,
    )
    suspend fun readSharedContentCacheOwner(
        ownerIdentityId: String,
        conversationId: String,
    ): SharedContentCacheOwnerEntity?

    @Query(
        """
        SELECT * FROM shared_content_cache_items
        WHERE owner_identity_id = :ownerIdentityId
        ORDER BY conversation_id ASC, source_rank ASC, item_id ASC
        """,
    )
    suspend fun readAllSharedContentCacheRows(ownerIdentityId: String): List<SharedContentCacheItemEntity>

    @Query(
        """
        SELECT * FROM shared_content_cache_pages
        WHERE owner_identity_id = :ownerIdentityId
        ORDER BY last_accessed_at ASC, conversation_id ASC, page_id ASC
        """,
    )
    suspend fun readAllSharedContentCachePages(ownerIdentityId: String): List<SharedContentCachePageEntity>

    @Query(
        """
        SELECT MAX(page_ordinal) FROM shared_content_cache_pages
        WHERE owner_identity_id = :ownerIdentityId
          AND conversation_id = :conversationId
          AND is_newest_window = 0
        """,
    )
    suspend fun maxSharedContentBrowsedPageOrdinal(
        ownerIdentityId: String,
        conversationId: String,
    ): Int?

    @Query(
        """
        UPDATE shared_content_cache_owners
        SET schema_version = :schemaVersion,
            saved_at = :savedAt,
            last_authoritative_at = :lastAuthoritativeAt,
            last_accessed_at = :lastAccessedAt,
            authoritative_empty_confirmed = :authoritativeEmptyConfirmed,
            retained_oldest_cursor = :retainedOldestCursor,
            retained_history_complete = :retainedHistoryComplete,
            newest_window_protected = :newestWindowProtected
        WHERE owner_identity_id = :ownerIdentityId
          AND conversation_id = :conversationId
        """,
    )
    suspend fun updateSharedContentCacheOwner(
        ownerIdentityId: String,
        conversationId: String,
        schemaVersion: Int,
        savedAt: String,
        lastAuthoritativeAt: String?,
        lastAccessedAt: String,
        authoritativeEmptyConfirmed: Boolean,
        retainedOldestCursor: String?,
        retainedHistoryComplete: Boolean,
        newestWindowProtected: Boolean,
    ): Int

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertSharedContentCacheOwner(owner: SharedContentCacheOwnerEntity)

    @Transaction
    suspend fun upsertSharedContentCacheOwner(owner: SharedContentCacheOwnerEntity) {
        val updated = updateSharedContentCacheOwner(
            ownerIdentityId = owner.ownerIdentityId,
            conversationId = owner.conversationId,
            schemaVersion = owner.schemaVersion,
            savedAt = owner.savedAt,
            lastAuthoritativeAt = owner.lastAuthoritativeAt,
            lastAccessedAt = owner.lastAccessedAt,
            authoritativeEmptyConfirmed = owner.authoritativeEmptyConfirmed,
            retainedOldestCursor = owner.retainedOldestCursor,
            retainedHistoryComplete = owner.retainedHistoryComplete,
            newestWindowProtected = owner.newestWindowProtected,
        )
        if (updated == 0) insertSharedContentCacheOwner(owner)
    }

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSharedContentCachePage(page: SharedContentCachePageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSharedContentCacheItems(items: List<SharedContentCacheItemEntity>)

    @Query(
        """
        DELETE FROM shared_content_cache_pages
        WHERE owner_identity_id = :ownerIdentityId
          AND conversation_id = :conversationId
          AND page_id = :pageId
        """,
    )
    suspend fun deleteSharedContentCachePage(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
    )

    @Query(
        """
        DELETE FROM shared_content_cache_items
        WHERE owner_identity_id = :ownerIdentityId
          AND conversation_id = :conversationId
          AND item_id IN (:itemIds)
        """,
    )
    suspend fun deleteSharedContentCacheItems(
        ownerIdentityId: String,
        conversationId: String,
        itemIds: List<String>,
    )

    @Query(
        """
        DELETE FROM shared_content_cache_items
        WHERE owner_identity_id = :ownerIdentityId
          AND conversation_id = :conversationId
          AND source_message_id IN (:sourceMessageIds)
        """,
    )
    suspend fun deleteSharedContentCacheItemsForSources(
        ownerIdentityId: String,
        conversationId: String,
        sourceMessageIds: List<String>,
    )

    @Query(
        """
        DELETE FROM shared_content_cache_owners
        WHERE owner_identity_id = :ownerIdentityId AND conversation_id = :conversationId
        """,
    )
    suspend fun deleteSharedContentCacheConversation(
        ownerIdentityId: String,
        conversationId: String,
    )

    @Query("DELETE FROM shared_content_cache_owners WHERE owner_identity_id = :ownerIdentityId")
    suspend fun deleteSharedContentCacheOwner(ownerIdentityId: String)

    @Query(
        """
        SELECT count(*) FROM shared_content_cache_owners
        WHERE owner_identity_id = :ownerIdentityId AND conversation_id = :conversationId
        """,
    )
    suspend fun sharedContentCacheConversationCount(ownerIdentityId: String, conversationId: String): Int

    @Query("SELECT count(*) FROM shared_content_cache_owners WHERE owner_identity_id = :ownerIdentityId")
    suspend fun sharedContentCacheOwnerCount(ownerIdentityId: String): Int

    @Transaction
    suspend fun replaceSharedContentNewestWindowAndPrune(
        owner: SharedContentCacheOwnerEntity,
        page: SharedContentCachePageEntity,
        items: List<SharedContentCacheItemEntity>,
        now: String,
        protectedNewestCount: Int = 40,
        perConversationLimit: Int = 400,
        perAccountLimit: Int = 2_000,
        inactivityCutoff: String,
    ) {
        validateSharedContentBatch(owner, page, items)
        val previousOwner = readSharedContentCacheOwner(
            owner.ownerIdentityId,
            owner.conversationId,
        )
        val hasRetainedBrowsedPages = readAllSharedContentCachePages(owner.ownerIdentityId)
            .any { candidate ->
                candidate.conversationId == owner.conversationId && !candidate.isNewestWindow
            }
        upsertSharedContentCacheOwner(
            if (previousOwner != null && hasRetainedBrowsedPages) {
                owner.copy(
                    retainedOldestCursor = previousOwner.retainedOldestCursor,
                    retainedHistoryComplete = previousOwner.retainedHistoryComplete,
                )
            } else {
                owner
            },
        )
        deleteSharedContentCachePage(owner.ownerIdentityId, owner.conversationId, page.pageId)
        upsertSharedContentCachePage(page)
        if (items.isNotEmpty()) upsertSharedContentCacheItems(items)
        pruneSharedContentCache(
            owner.ownerIdentityId,
            now,
            protectedNewestCount,
            perConversationLimit,
            perAccountLimit,
            inactivityCutoff,
        )
    }

    @Transaction
    suspend fun appendSharedContentBrowsedPageAndPrune(
        owner: SharedContentCacheOwnerEntity,
        page: SharedContentCachePageEntity,
        items: List<SharedContentCacheItemEntity>,
        now: String,
        protectedNewestCount: Int = 40,
        perConversationLimit: Int = 400,
        perAccountLimit: Int = 2_000,
        inactivityCutoff: String,
    ) {
        validateSharedContentBatch(owner, page, items)
        upsertSharedContentCacheOwner(owner)
        upsertSharedContentCachePage(page)
        if (items.isNotEmpty()) upsertSharedContentCacheItems(items)
        pruneSharedContentCache(
            owner.ownerIdentityId,
            now,
            protectedNewestCount,
            perConversationLimit,
            perAccountLimit,
            inactivityCutoff,
        )
    }

    @Transaction
    suspend fun appendSharedContentBrowsedPageAndPruneAllocatingOrdinal(
        owner: SharedContentCacheOwnerEntity,
        pageId: String,
        retainedCursor: String?,
        items: List<SharedContentCacheItemEntity>,
        now: String,
        protectedNewestCount: Int = 40,
        perConversationLimit: Int = 400,
        perAccountLimit: Int = 2_000,
        inactivityCutoff: String,
    ): Int {
        val ordinal = (maxSharedContentBrowsedPageOrdinal(
            owner.ownerIdentityId,
            owner.conversationId,
        ) ?: 0) + 1
        val page = SharedContentCachePageEntity(
            ownerIdentityId = owner.ownerIdentityId,
            conversationId = owner.conversationId,
            pageId = pageId,
            pageOrdinal = ordinal,
            retainedCursor = retainedCursor,
            lastAccessedAt = now,
            isNewestWindow = false,
        )
        validateSharedContentBatch(owner, page, items)
        upsertSharedContentCacheOwner(owner)
        upsertSharedContentCachePage(page)
        if (items.isNotEmpty()) upsertSharedContentCacheItems(items)
        pruneSharedContentCache(
            owner.ownerIdentityId,
            now,
            protectedNewestCount,
            perConversationLimit,
            perAccountLimit,
            inactivityCutoff,
        )
        return ordinal
    }

    @Transaction
    suspend fun applySharedContentTombstonesAndPrune(
        owner: SharedContentCacheOwnerEntity,
        sourceMessageIds: List<String>,
        now: String,
        protectedNewestCount: Int = 40,
        perConversationLimit: Int = 400,
        perAccountLimit: Int = 2_000,
        inactivityCutoff: String,
    ) {
        require(owner.ownerIdentityId.isNotBlank())
        require(owner.conversationId.isNotBlank())
        upsertSharedContentCacheOwner(owner)
        if (sourceMessageIds.isNotEmpty()) {
            deleteSharedContentCacheItemsForSources(
                owner.ownerIdentityId,
                owner.conversationId,
                sourceMessageIds,
            )
        }
        pruneSharedContentCache(
            owner.ownerIdentityId,
            now,
            protectedNewestCount,
            perConversationLimit,
            perAccountLimit,
            inactivityCutoff,
        )
    }

    @Transaction
    suspend fun pruneSharedContentCache(
        ownerIdentityId: String,
        now: String,
        protectedNewestCount: Int = 40,
        perConversationLimit: Int = 400,
        perAccountLimit: Int = 2_000,
        inactivityCutoff: String,
    ) {
        require(ownerIdentityId.isNotBlank())
        require(protectedNewestCount > 0)
        require(perConversationLimit >= protectedNewestCount)
        require(perAccountLimit >= protectedNewestCount)

        val allPages = readAllSharedContentCachePages(ownerIdentityId)
        val allItems = readAllSharedContentCacheRows(ownerIdentityId)
        val pagesByKey = allPages.associateBy { it.conversationId to it.pageId }
        val itemsByConversation = allItems.groupBy { it.conversationId }

        itemsByConversation.forEach { (conversationId, conversationItems) ->
            val newestIds = conversationItems
                .filter { pagesByKey[it.conversationId to it.pageId]?.isNewestWindow == true }
                .sortedWith(compareBy<SharedContentCacheItemEntity> { it.sourceRank }.thenBy { it.itemId })
                .take(protectedNewestCount)
                .map { it.itemId }
                .toSet()
            val newestOverflow = conversationItems
                .filter { pagesByKey[it.conversationId to it.pageId]?.isNewestWindow == true }
                .filterNot { it.itemId in newestIds }
                .map { it.itemId }
            if (newestOverflow.isNotEmpty()) {
                deleteSharedContentCacheItems(ownerIdentityId, conversationId, newestOverflow)
            }
        }

        readAllSharedContentCachePages(ownerIdentityId)
            .filterNot { it.isNewestWindow }
            .map { it.conversationId }
            .distinct()
            .forEach { conversationId ->
                while (true) {
                    val deepest = deepestSharedContentBrowsedPage(
                        ownerIdentityId,
                        conversationId,
                    ) ?: break
                    if (deepest.lastAccessedAt > inactivityCutoff) break
                    deleteDeepestSharedContentPageAndRepair(deepest)
                }
            }

        readAllSharedContentCachePages(ownerIdentityId)
            .filter { !it.isNewestWindow }
            .groupBy { it.conversationId }
            .forEach { (conversationId, _) ->
                var count = readSharedContentCacheRows(ownerIdentityId, conversationId).size
                while (count > perConversationLimit) {
                    val deepest = deepestSharedContentBrowsedPage(
                        ownerIdentityId,
                        conversationId,
                    ) ?: break
                    val pageCount = readSharedContentCacheRows(ownerIdentityId, conversationId)
                        .count { it.pageId == deepest.pageId }
                    deleteDeepestSharedContentPageAndRepair(deepest)
                    count -= pageCount
                }
            }

        var accountCount = readAllSharedContentCacheRows(ownerIdentityId).size
        while (accountCount > perAccountLimit) {
            val candidate = readAllSharedContentCachePages(ownerIdentityId)
                .filterNot { it.isNewestWindow }
                .groupBy { it.conversationId }
                .mapNotNull { (_, pages) ->
                    pages.maxWithOrNull(
                        compareBy<SharedContentCachePageEntity> { it.pageOrdinal }
                            .thenBy { it.pageId },
                    )
                }
                .minWithOrNull(
                    compareBy<SharedContentCachePageEntity> { it.lastAccessedAt }
                        .thenBy { it.conversationId }
                        .thenByDescending { it.pageOrdinal }
                        .thenBy { it.pageId },
                ) ?: break
            val count = readSharedContentCacheRows(ownerIdentityId, candidate.conversationId)
                .count { it.pageId == candidate.pageId }
            deleteDeepestSharedContentPageAndRepair(candidate)
            accountCount -= count
        }
    }

    private suspend fun deepestSharedContentBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
    ): SharedContentCachePageEntity? =
        readAllSharedContentCachePages(ownerIdentityId)
            .filter { page ->
                page.conversationId == conversationId && !page.isNewestWindow
            }
            .maxWithOrNull(
                compareBy<SharedContentCachePageEntity> { it.pageOrdinal }
                    .thenBy { it.pageId },
            )

    private suspend fun deleteDeepestSharedContentPageAndRepair(
        page: SharedContentCachePageEntity,
    ) {
        deleteSharedContentCachePage(
            page.ownerIdentityId,
            page.conversationId,
            page.pageId,
        )
        val owner = readSharedContentCacheOwner(
            page.ownerIdentityId,
            page.conversationId,
        ) ?: return
        val retainedBoundary = deepestSharedContentBrowsedPage(
            page.ownerIdentityId,
            page.conversationId,
        ) ?: readAllSharedContentCachePages(page.ownerIdentityId)
            .firstOrNull { candidate ->
                candidate.conversationId == page.conversationId &&
                    candidate.isNewestWindow
            }
        upsertSharedContentCacheOwner(
            owner.copy(
                retainedOldestCursor = retainedBoundary?.retainedCursor,
                retainedHistoryComplete = false,
            ),
        )
    }

    @Transaction
    suspend fun purgeSharedContentConversation(ownerIdentityId: String, conversationId: String) {
        deleteSharedContentCacheConversation(ownerIdentityId, conversationId)
    }

    @Transaction
    suspend fun purgeSharedContentOwner(ownerIdentityId: String) {
        deleteSharedContentCacheOwner(ownerIdentityId)
    }

    suspend fun verifyOwnerPurged(ownerIdentityId: String, conversationId: String? = null): Boolean =
        if (conversationId == null) {
            sharedContentCacheOwnerCount(ownerIdentityId) == 0
        } else {
            sharedContentCacheConversationCount(ownerIdentityId, conversationId) == 0
        }

    private fun validateSharedContentBatch(
        owner: SharedContentCacheOwnerEntity,
        page: SharedContentCachePageEntity,
        items: List<SharedContentCacheItemEntity>,
    ) {
        require(owner.ownerIdentityId.isNotBlank())
        require(owner.conversationId.isNotBlank())
        require(page.ownerIdentityId == owner.ownerIdentityId)
        require(page.conversationId == owner.conversationId)
        require(items.all {
            it.ownerIdentityId == owner.ownerIdentityId &&
                it.conversationId == owner.conversationId &&
                it.pageId == page.pageId
        })
    }

    @Query("DELETE FROM conversations WHERE conversation_id = :conversationId")
    suspend fun deleteConversation(conversationId: String)

    @Transaction
    suspend fun deleteConversationData(conversationId: String) {
        deleteConversationAttachmentDrafts(conversationId)
        deleteSharedContentCacheForConversation(conversationId)
        deleteConversationMessages(conversationId)
        deleteConversationReadStates(conversationId)
        deleteConversationDrafts(conversationId)
        deleteConversationPendingTextSends(conversationId)
        deleteConversation(conversationId)
    }

    @Transaction
    suspend fun clearAllUserData() {
        clearAttachmentDrafts()
        clearSharedContentCache()
        clearMessages()
        clearReadStates()
        clearDrafts()
        clearPendingTextSends()
        clearConversations()
    }

    @Query("DELETE FROM shared_content_cache_owners WHERE conversation_id = :conversationId")
    suspend fun deleteSharedContentCacheForConversation(conversationId: String)

    @Query("DELETE FROM shared_content_cache_owners")
    suspend fun clearSharedContentCache()
}
