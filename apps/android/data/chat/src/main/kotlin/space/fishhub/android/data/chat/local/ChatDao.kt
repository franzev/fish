package space.fishhub.android.data.chat.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatDao {
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

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertConversation(conversation: ConversationEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMessage(message: MessageEntity)

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
    suspend fun reconcileMessage(message: MessageEntity) {
        deleteRequestDuplicates(message.conversationId, message.clientRequestId, message.id)
        upsertMessage(message)
    }

    @Transaction
    suspend fun reconcileMessages(messages: List<MessageEntity>) {
        messages.forEach { reconcileMessage(it) }
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

    @Query("DELETE FROM conversations WHERE conversation_id = :conversationId")
    suspend fun deleteConversation(conversationId: String)

    @Transaction
    suspend fun deleteConversationData(conversationId: String) {
        deleteConversationMessages(conversationId)
        deleteConversationReadStates(conversationId)
        deleteConversationDrafts(conversationId)
        deleteConversation(conversationId)
    }

    @Transaction
    suspend fun clearAllUserData() {
        clearMessages()
        clearReadStates()
        clearDrafts()
        clearConversations()
    }
}
