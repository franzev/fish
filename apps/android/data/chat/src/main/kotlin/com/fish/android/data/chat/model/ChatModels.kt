@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package com.fish.android.data.chat.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class UserRole {
    @SerialName("client") Client,
    @SerialName("coach") Coach,
}

@Serializable
enum class LocalMessageStatus {
    @SerialName("pending") Pending,
    @SerialName("sending") Sending,
    @SerialName("sent") Sent,
    @SerialName("failed") Failed,
}

@Serializable
data class ChatReaction(
    val emoji: String,
    val count: Int,
    val byMe: Boolean,
)

@Serializable
data class ChatGif(
    val provider: String,
    val providerId: String,
    val title: String,
    val description: String,
    val sourceUrl: String,
    val posterUrl: String,
    val previewUrl: String,
    val mediaUrl: String,
    val width: Int,
    val height: Int,
)

@Serializable
data class ChatAttachment(
    val id: String,
    val status: String = "ready",
    val kind: String? = null,
    val originalName: String,
    val mimeType: String? = null,
    val byteSize: Long? = null,
    val width: Int? = null,
    val height: Int? = null,
    val thumbnailPath: String? = null,
    val displayPath: String,
    val thumbnailUrl: String? = null,
    val displayUrl: String? = null,
)

@Serializable
data class ChatMessage(
    val id: String,
    val conversationId: String,
    val senderId: String,
    val senderRole: UserRole,
    val senderDisplayName: String? = null,
    val body: String,
    val gif: ChatGif? = null,
    val gifUnavailable: Boolean = false,
    val stickerId: String? = null,
    val images: List<ChatAttachment> = emptyList(),
    val clientRequestId: String,
    val createdAt: String,
    val editedAt: String? = null,
    val deletedAt: String? = null,
    val replyToMessageId: String? = null,
    val reactions: List<ChatReaction> = emptyList(),
    val localStatus: LocalMessageStatus? = null,
    val failureReason: String? = null,
)

@Serializable
data class ChatReadState(
    val userId: String,
    val lastDeliveredMessageId: String? = null,
    val deliveredAt: String? = null,
    val lastReadMessageId: String? = null,
    val readAt: String? = null,
)

@Serializable
data class ChatMessageCursor(
    val createdAt: String,
    val id: String,
)
