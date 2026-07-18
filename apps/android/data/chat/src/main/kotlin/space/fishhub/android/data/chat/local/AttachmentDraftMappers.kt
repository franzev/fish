package space.fishhub.android.data.chat.local

import space.fishhub.android.data.chat.model.LocalAttachmentDraft
import space.fishhub.android.data.chat.model.LocalAttachmentKind
import space.fishhub.android.data.chat.model.LocalAttachmentScope
import space.fishhub.android.data.chat.model.LocalAttachmentTransferState

internal fun AttachmentDraftEntity.toDomain() = LocalAttachmentDraft(
    id = id,
    conversationId = conversationId,
    userId = userId,
    position = position,
    kind = if (kind == "image") LocalAttachmentKind.Image else LocalAttachmentKind.File,
    scope = if (scope == "preview") LocalAttachmentScope.Preview else LocalAttachmentScope.Composer,
    displayName = displayName,
    sourceMimeType = sourceMimeType,
    storedMimeType = storedMimeType,
    byteSize = byteSize,
    sourceByteSize = sourceByteSize.takeIf { it > 0 } ?: byteSize,
    width = width,
    height = height,
    localPath = localPath,
    thumbnailPath = thumbnailPath,
    sha256 = sha256,
    createdAt = createdAt,
    updatedAt = updatedAt,
    expiresAt = expiresAt,
    clientUploadId = clientUploadId.ifBlank { id },
    serverAttachmentId = serverAttachmentId,
    transferState = transferState.toTransferState(),
    progressBytes = progressBytes.coerceIn(0, byteSize),
    attemptCount = attemptCount.coerceAtLeast(0),
    failureCode = failureCode,
    retryAfter = retryAfter,
)

internal fun LocalAttachmentTransferState.toStorageValue(): String = when (this) {
    LocalAttachmentTransferState.Selected -> "selected"
    LocalAttachmentTransferState.WaitingForNetwork -> "waiting_for_network"
    LocalAttachmentTransferState.Initializing -> "initializing"
    LocalAttachmentTransferState.Uploading -> "uploading"
    LocalAttachmentTransferState.Checking -> "checking"
    LocalAttachmentTransferState.Ready -> "ready"
    LocalAttachmentTransferState.FailedRecoverable -> "failed_recoverable"
    LocalAttachmentTransferState.FailedPermanent -> "failed_permanent"
    LocalAttachmentTransferState.SignInRequired -> "sign_in_required"
    LocalAttachmentTransferState.Cancelling -> "cancelling"
    LocalAttachmentTransferState.Cancelled -> "cancelled"
}

private fun String.toTransferState(): LocalAttachmentTransferState = when (this) {
    "waiting_for_network" -> LocalAttachmentTransferState.WaitingForNetwork
    "initializing" -> LocalAttachmentTransferState.Initializing
    "uploading" -> LocalAttachmentTransferState.Uploading
    "checking" -> LocalAttachmentTransferState.Checking
    "ready" -> LocalAttachmentTransferState.Ready
    "failed_recoverable" -> LocalAttachmentTransferState.FailedRecoverable
    "failed_permanent" -> LocalAttachmentTransferState.FailedPermanent
    "sign_in_required" -> LocalAttachmentTransferState.SignInRequired
    "cancelling" -> LocalAttachmentTransferState.Cancelling
    "cancelled" -> LocalAttachmentTransferState.Cancelled
    else -> LocalAttachmentTransferState.Selected
}
