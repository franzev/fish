package space.fishhub.android.data.chat.model

/** A private, normalized attachment that has not been sent yet. */
data class LocalAttachmentDraft(
    val id: String,
    val conversationId: String,
    val userId: String,
    val position: Int,
    val kind: LocalAttachmentKind,
    val scope: LocalAttachmentScope,
    val displayName: String,
    val sourceMimeType: String,
    val storedMimeType: String,
    val byteSize: Long,
    val sourceByteSize: Long = byteSize,
    val width: Int?,
    val height: Int?,
    val localPath: String,
    val thumbnailPath: String?,
    val sha256: String,
    val createdAt: String,
    val updatedAt: String,
    val expiresAt: String,
    val clientUploadId: String = id,
    val serverAttachmentId: String? = null,
    val transferState: LocalAttachmentTransferState = LocalAttachmentTransferState.Selected,
    val progressBytes: Long = 0,
    val attemptCount: Int = 0,
    val failureCode: String? = null,
    val retryAfter: String? = null,
)

enum class LocalAttachmentKind { Image, File }

enum class LocalAttachmentScope { Preview, Composer }

enum class LocalAttachmentTransferState {
    Selected,
    WaitingForNetwork,
    Initializing,
    Uploading,
    Checking,
    Ready,
    FailedRecoverable,
    FailedPermanent,
    SignInRequired,
    Cancelling,
    Cancelled,
}
