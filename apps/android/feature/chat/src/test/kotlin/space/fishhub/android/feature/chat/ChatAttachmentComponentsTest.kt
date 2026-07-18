package space.fishhub.android.feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.model.LocalAttachmentDraft
import space.fishhub.android.data.chat.model.LocalAttachmentKind
import space.fishhub.android.data.chat.model.LocalAttachmentScope
import space.fishhub.android.data.chat.model.LocalAttachmentTransferState

class ChatAttachmentComponentsTest {
    @Test
    fun `photo file photo remains three ordered rendering runs`() {
        val runs = attachmentRuns(
            listOf(
                attachment("last-photo", 2, AttachmentUiKind.Photo),
                attachment("first-photo", 0, AttachmentUiKind.Photo),
                attachment("middle-file", 1, AttachmentUiKind.File),
            ),
        )

        assertEquals(3, runs.size)
        assertEquals("first-photo", (runs[0] as AttachmentRun.Photos).items.single().id)
        assertEquals("middle-file", (runs[1] as AttachmentRun.Item).item.id)
        assertEquals("last-photo", (runs[2] as AttachmentRun.Photos).items.single().id)
    }

    @Test
    fun `five consecutive photos remain one ordered group`() {
        val runs = attachmentRuns(
            (4 downTo 0).map { attachment("photo-$it", it, AttachmentUiKind.Photo) },
        )

        assertEquals(1, runs.size)
        assertEquals(
            listOf("photo-0", "photo-1", "photo-2", "photo-3", "photo-4"),
            (runs.single() as AttachmentRun.Photos).items.map { it.id },
        )
    }

    @Test
    fun `unavailable photo is rendered as an explicit item`() {
        val unavailable = attachment("unavailable", 0, AttachmentUiKind.Unavailable, available = false)

        val run = attachmentRuns(listOf(unavailable)).single()

        assertTrue(run is AttachmentRun.Item)
        assertEquals("unavailable", (run as AttachmentRun.Item).item.id)
    }

    @Test
    fun `attachment failure codes map to resource ready presentation reasons`() {
        val safetyFailure = LocalAttachmentUiModel.from(
            draft.copy(
                transferState = LocalAttachmentTransferState.FailedPermanent,
                failureCode = "malware_detected",
            ),
        )
        val unknownFailure = LocalAttachmentUiModel.from(
            draft.copy(
                transferState = LocalAttachmentTransferState.FailedRecoverable,
                failureCode = "future_failure",
            ),
        )

        assertEquals(AttachmentFailureUiReason.SafetyCheckFailed, safetyFailure.failureReason)
        assertEquals(AttachmentFailureUiReason.NeedsAttention, unknownFailure.failureReason)
        assertTrue(unknownFailure.retryable)
    }

    private fun attachment(
        id: String,
        position: Int,
        kind: AttachmentUiKind,
        available: Boolean = true,
    ) = AttachmentUiModel(
        id = id,
        position = position,
        kind = kind,
        available = available,
        name = if (kind == AttachmentUiKind.File) "notes.pdf" else "Photo",
        mimeType = if (kind == AttachmentUiKind.File) "application/pdf" else "image/webp",
        byteSize = 1024,
        width = 1200,
        height = 800,
        thumbnailUrl = null,
        displayUrl = null,
        contentVersion = "v1",
    )

    private val draft = LocalAttachmentDraft(
        id = "draft",
        conversationId = "conversation",
        userId = "user",
        position = 0,
        kind = LocalAttachmentKind.File,
        scope = LocalAttachmentScope.Composer,
        displayName = "notes.pdf",
        sourceMimeType = "application/pdf",
        storedMimeType = "application/pdf",
        byteSize = 1024,
        width = null,
        height = null,
        localPath = "/private/notes.pdf",
        thumbnailPath = null,
        sha256 = "sha256",
        createdAt = "2026-07-18T00:00:00Z",
        updatedAt = "2026-07-18T00:00:00Z",
        expiresAt = "2026-07-19T00:00:00Z",
    )
}
