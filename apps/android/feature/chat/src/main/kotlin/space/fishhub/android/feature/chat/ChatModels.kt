package space.fishhub.android.feature.chat

import androidx.compose.runtime.Immutable
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.model.LocalAttachmentDraft
import space.fishhub.android.data.chat.model.LocalAttachmentKind
import space.fishhub.android.data.chat.model.LocalAttachmentScope
import space.fishhub.android.data.chat.model.LocalAttachmentTransferState

@Immutable
data class ChatUiModel(
    val screenState: ChatScreenState,
    val currentUserDisplayName: String = "",
    val participant: ParticipantUiModel? = null,
    val messages: List<MessageUiModel> = emptyList(),
    val conversations: List<ConversationPreviewUiModel> = emptyList(),
    val selectedConversationId: String? = null,
    val connection: ChatConnectionUiState = ChatConnectionUiState.Connected,
    val pagination: OlderMessagesUiState = OlderMessagesUiState.Idle,
    val hasMoreOlder: Boolean = false,
    val typingParticipantName: String? = null,
    val replyTarget: ReplyPreviewUiModel? = null,
    val focusedMessageId: String? = null,
    val hasPreviousDestination: Boolean = false,
    val isSending: Boolean = false,
    val notice: String? = null,
)

enum class ChatScreenState { Loading, Available, Unavailable }

@Immutable
data class ParticipantUiModel(
    val id: String,
    val displayName: String,
    val contextLabel: String,
    val username: String? = null,
    val avatarUrl: String? = null,
    val friendSafetyAvailable: Boolean = false,
)

@Immutable
data class ConversationPreviewUiModel(
    val conversationId: String,
    val participantName: String,
    val snippet: String,
    val timeLabel: String,
    val unreadCount: Int,
)

@Immutable
data class MessageUiModel(
    val id: String,
    val senderName: String,
    val body: String,
    val timeLabel: String,
    val isOutgoing: Boolean,
    val delivery: MessageDeliveryUiState? = null,
    val groupedWithPrevious: Boolean = false,
    val groupedWithNext: Boolean = false,
    val dateLabel: String? = null,
    val startsUnread: Boolean = false,
    val deleted: Boolean = false,
    val edited: Boolean = false,
    val replyPreview: ReplyPreviewUiModel? = null,
    val reactions: List<ReactionUiModel> = emptyList(),
    val actionsEnabled: Boolean = false,
    val reactionsEnabled: Boolean = actionsEnabled,
    val canEdit: Boolean = false,
    val canDelete: Boolean = false,
    val gif: GifUiModel? = null,
    val sticker: StickerUiModel? = null,
    val gifPlaying: Boolean = false,
    val gifUnavailable: Boolean = false,
    val attachments: List<AttachmentUiModel> = emptyList(),
)

@Immutable
data class ReplyPreviewUiModel(
    val messageId: String,
    val authorName: String,
    val snippet: String,
)

@Immutable
data class ReactionUiModel(
    val emoji: String,
    val count: Int,
    val byMe: Boolean,
)

enum class AttachmentUiKind { Photo, Voice, File, Unavailable }

@Immutable
data class VoiceRecordingUiState(
    val recording: Boolean = false,
    val elapsedMillis: Long = 0L,
    val notice: String? = null,
)

@Immutable
data class AttachmentUiModel(
    val id: String,
    val position: Int,
    val kind: AttachmentUiKind,
    val available: Boolean,
    val name: String,
    val mimeType: String?,
    val byteSize: Long?,
    val width: Int?,
    val height: Int?,
    val thumbnailUrl: String?,
    val displayUrl: String?,
    val contentVersion: String,
) {
    companion object {
        fun from(attachment: ChatAttachment): AttachmentUiModel = AttachmentUiModel(
            id = attachment.id,
            position = attachment.position,
            kind = when (attachment.kind) {
                ChatAttachmentKind.Image -> AttachmentUiKind.Photo
                ChatAttachmentKind.File -> if (attachment.mimeType == "audio/mp4") {
                    AttachmentUiKind.Voice
                } else {
                    AttachmentUiKind.File
                }
                ChatAttachmentKind.Unavailable -> AttachmentUiKind.Unavailable
            },
            available = attachment.available,
            name = attachment.originalName,
            mimeType = attachment.mimeType,
            byteSize = attachment.byteSize,
            width = attachment.width,
            height = attachment.height,
            thumbnailUrl = attachment.thumbnailUrl,
            displayUrl = attachment.displayUrl,
            contentVersion = attachment.contentVersion,
        )
    }
}

/** One-shot handoff to the app-owned private download/FileProvider boundary. */
@Immutable
data class AttachmentOpenRequest(
    val attachmentId: String,
    val name: String,
    val mimeType: String,
    val expectedByteSize: Long,
    val signedUrl: String,
)

@Immutable
data class GifUiModel(
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
) {
    fun toChatGif(): ChatGif = ChatGif(
        provider = provider,
        providerId = providerId,
        title = title,
        description = description,
        sourceUrl = sourceUrl,
        posterUrl = posterUrl,
        previewUrl = previewUrl,
        mediaUrl = mediaUrl,
        width = width,
        height = height,
    )

    companion object {
        fun from(gif: ChatGif): GifUiModel = GifUiModel(
            provider = gif.provider,
            providerId = gif.providerId,
            title = gif.title,
            description = gif.description,
            sourceUrl = gif.sourceUrl,
            posterUrl = gif.posterUrl,
            previewUrl = gif.previewUrl,
            mediaUrl = gif.mediaUrl,
            width = gif.width,
            height = gif.height,
        )
    }
}

@Immutable
data class StickerUiModel(
    val id: String,
    val phrase: String,
    val description: String,
    val assetPath: String?,
) {
    val available: Boolean get() = assetPath != null
}

@Immutable
sealed interface ComposerMediaUiModel {
    @Immutable
    data class Gif(val value: GifUiModel) : ComposerMediaUiModel

    @Immutable
    data class Sticker(val value: StickerUiModel) : ComposerMediaUiModel
}

@Immutable
data class LocalAttachmentUiModel(
    val id: String,
    val position: Int,
    val isPhoto: Boolean,
    val inPreview: Boolean,
    val name: String,
    val mimeType: String,
    val byteSize: Long,
    val width: Int?,
    val height: Int?,
    val localPath: String,
    val thumbnailPath: String?,
    val serverAttachmentId: String? = null,
    val transferState: AttachmentTransferUiState = AttachmentTransferUiState.Waiting,
    val progressFraction: Float = 0f,
    val retryable: Boolean = false,
    val failureReason: AttachmentFailureUiReason? = null,
) {
    val ready: Boolean get() = transferState == AttachmentTransferUiState.Ready
    val isVoice: Boolean get() = mimeType == "audio/mp4"

    companion object {
        fun from(draft: LocalAttachmentDraft) = LocalAttachmentUiModel(
            id = draft.id,
            position = draft.position,
            isPhoto = draft.kind == LocalAttachmentKind.Image,
            inPreview = draft.scope == LocalAttachmentScope.Preview,
            name = draft.displayName,
            mimeType = draft.storedMimeType,
            byteSize = draft.byteSize,
            width = draft.width,
            height = draft.height,
            localPath = draft.localPath,
            thumbnailPath = draft.thumbnailPath,
            serverAttachmentId = draft.serverAttachmentId,
            transferState = draft.transferState.toUiState(),
            progressFraction = if (draft.byteSize <= 0) 0f else {
                (draft.progressBytes.toDouble() / draft.byteSize.toDouble()).toFloat().coerceIn(0f, 1f)
            },
            retryable = draft.transferState in setOf(
                LocalAttachmentTransferState.FailedRecoverable,
                LocalAttachmentTransferState.SignInRequired,
            ),
            failureReason = draft.failureCode
                ?.takeIf {
                    draft.transferState in setOf(
                        LocalAttachmentTransferState.FailedRecoverable,
                        LocalAttachmentTransferState.FailedPermanent,
                        LocalAttachmentTransferState.SignInRequired,
                    )
                }
                ?.let(::attachmentFailureReason),
        )
    }
}

enum class AttachmentTransferUiState { Preparing, Uploading, Checking, Waiting, Failed, Ready }

enum class AttachmentFailureUiReason {
    SafetyCheckFailed,
    LocalCopyUnavailable,
    SignInRequired,
    RetryLimitReached,
    NeedsAttention,
}

private fun LocalAttachmentTransferState.toUiState(): AttachmentTransferUiState = when (this) {
    LocalAttachmentTransferState.Initializing -> AttachmentTransferUiState.Preparing
    LocalAttachmentTransferState.Uploading -> AttachmentTransferUiState.Uploading
    LocalAttachmentTransferState.Checking -> AttachmentTransferUiState.Checking
    LocalAttachmentTransferState.Ready -> AttachmentTransferUiState.Ready
    LocalAttachmentTransferState.FailedRecoverable,
    LocalAttachmentTransferState.FailedPermanent,
    LocalAttachmentTransferState.SignInRequired,
    LocalAttachmentTransferState.Cancelled,
    LocalAttachmentTransferState.Cancelling,
    -> AttachmentTransferUiState.Failed
    LocalAttachmentTransferState.Selected,
    LocalAttachmentTransferState.WaitingForNetwork,
    -> AttachmentTransferUiState.Waiting
}

private fun attachmentFailureReason(code: String): AttachmentFailureUiReason = when (code) {
    "malware_detected", "invalid_file", "integrity_mismatch", "macro_not_allowed" ->
        AttachmentFailureUiReason.SafetyCheckFailed
    "local_copy_unavailable" -> AttachmentFailureUiReason.LocalCopyUnavailable
    "sign_in_required" -> AttachmentFailureUiReason.SignInRequired
    "retry_limit" -> AttachmentFailureUiReason.RetryLimitReached
    else -> AttachmentFailureUiReason.NeedsAttention
}

@Immutable
data class AttachmentImportUiState(
    val active: Boolean = false,
    val importing: Boolean = false,
    val notice: String? = null,
)

@Immutable
data class BlockedPersonUiModel(
    val userId: String,
    val displayName: String,
    val username: String?,
)

@Immutable
sealed interface BlockedPeopleUiState {
    data object Idle : BlockedPeopleUiState
    data object Loading : BlockedPeopleUiState
    data class Loaded(
        val people: List<BlockedPersonUiModel>,
        val busyIds: Set<String> = emptySet(),
        val notice: String? = null,
    ) : BlockedPeopleUiState
    data class Failed(val message: String) : BlockedPeopleUiState
}

enum class MessageDeliveryUiState { Sending, Sent, Delivered, Read, Failed }
enum class ChatConnectionUiState { Connected, Connecting, Reconnecting, Offline }
enum class OlderMessagesUiState { Idle, Loading, Failed }

sealed interface ChatRouteUiState {
    data object Loading : ChatRouteUiState
    data class SignedOut(
        val email: String = "",
        val password: String = "",
        val submitting: Boolean = false,
        val notice: String? = null,
    ) : ChatRouteUiState
    data class Conversation(
        val model: ChatUiModel,
        val draft: String,
        val pendingMedia: ComposerMediaUiModel? = null,
        val pendingGifQuery: String = "",
        val attachmentDrafts: List<LocalAttachmentUiModel> = emptyList(),
        val notice: String? = null,
    ) : ChatRouteUiState
    data class ConversationList(
        val currentUserDisplayName: String = "",
        val conversations: List<ConversationPreviewUiModel>,
        val selectedConversationId: String?,
        val notice: String? = null,
    ) : ChatRouteUiState
}
