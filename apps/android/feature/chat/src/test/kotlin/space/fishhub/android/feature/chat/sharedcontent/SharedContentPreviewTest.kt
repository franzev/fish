package space.fishhub.android.feature.chat.sharedcontent

import java.util.Locale
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedContentPreviewTest {
    @Test
    fun exportRequiresServerCapabilityAndNeverAllowsGifOrSticker() {
        val gif = item(kind = "gif", canExport = true)
        val sticker = item(kind = "sticker", canExport = true)
        val document = item(kind = "document", canExport = true)

        assertFalse(gif.toPreviewItem(locale = Locale.US).canTransfer)
        assertFalse(sticker.toPreviewItem(locale = Locale.US).canTransfer)
        assertTrue(document.toPreviewItem(locale = Locale.US).canTransfer)
    }

    @Test
    fun deleteIsSenderOnlyServerAuthorityAndRequiresSourceMessage() {
        assertTrue(item(canDelete = true).toPreviewItem().canShowDelete)
        assertFalse(item(canDelete = false).toPreviewItem().canShowDelete)
        assertFalse(item(canDelete = true, sourceMessageId = null).toPreviewItem().canShowDelete)
    }

    @Test
    fun previewKeepsSenderAndLocalizedDateContext() {
        val preview = item(
            senderId = "coach-1",
            sourceCreatedAt = "2026-07-24T10:30:00Z",
        ).toPreviewItem(senderName = "Coach", locale = Locale.US)

        assertTrue(preview.senderName == "Coach")
        assertTrue(preview.sourceDateLabel.contains("2026"))
    }

    @Test
    fun linksRequireHttpHostAndAttachmentOpenRemainsSeparateFromExport() {
        val safeLink = item(
            kind = "link",
            canExport = true,
            linkUrl = "https://example.test/lesson",
        ).toPreviewItem()
        val unsafeLink = item(
            kind = "link",
            canExport = true,
            linkUrl = "javascript:alert(1)",
        ).toPreviewItem()
        val document = item(kind = "document", canExport = false).toPreviewItem()
        val photo = item(kind = "photo", canExport = true).toPreviewItem()

        assertTrue(safeLink.canTransfer)
        assertTrue(safeLink.canOpen)
        assertFalse(unsafeLink.canTransfer)
        assertFalse(unsafeLink.canOpen)
        assertTrue(document.canOpen)
        assertFalse(photo.canOpen)
        assertFalse(item(kind = "document", byteSize = null).toPreviewItem().canOpen)
    }

    @Test
    fun thumbnailPreviewSupportsStickerAssetsWithoutEnablingExport() {
        assertTrue(isSharedContentThumbnailPreviewKind("photo"))
        assertTrue(isSharedContentThumbnailPreviewKind("video"))
        assertTrue(isSharedContentThumbnailPreviewKind("gif"))
        assertTrue(isSharedContentThumbnailPreviewKind("sticker"))
        assertFalse(isSharedContentThumbnailPreviewKind("document"))
        assertFalse(item(kind = "sticker", canExport = true).toPreviewItem().canTransfer)
    }

    private fun item(
        kind: String = "document",
        canDelete: Boolean = false,
        canExport: Boolean = false,
        sourceMessageId: String? = "message-1",
        senderId: String = "sender-1",
        sourceCreatedAt: String = "2026-07-24T10:30:00Z",
        linkUrl: String? = if (kind == "link") "https://example.test/lesson" else null,
        byteSize: Long? = 4,
    ) = SharedContentAcceptedItem(
        itemId = "item-$kind",
        conversationId = "conversation-1",
        category = when (kind) {
            "document" -> "files"
            "voice" -> "voice"
            "link" -> "links"
            else -> "media"
        },
        kind = kind,
        originalName = "file.pdf",
        mimeType = "application/pdf",
        byteSize = byteSize,
        senderId = senderId,
        sourceCreatedAt = sourceCreatedAt,
        canDelete = canDelete,
        canExport = canExport,
        sourceMessageId = sourceMessageId,
        linkUrl = linkUrl,
        attachmentId = if (kind == "link") null else "attachment-1",
        contentVersion = sourceCreatedAt,
    )
}
