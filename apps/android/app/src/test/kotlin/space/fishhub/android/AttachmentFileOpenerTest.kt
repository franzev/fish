package space.fishhub.android

import java.nio.file.Files
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AttachmentFileOpenerTest {
    @Test
    fun imageSignaturesAreAcceptedOnlyForTheirDeclaredType() {
        val directory = Files.createTempDirectory("fish-attachment-signatures").toFile()
        try {
            val jpeg = directory.resolve("photo.jpg").apply {
                writeBytes(byteArrayOf(0xff.toByte(), 0xd8.toByte(), 0xff.toByte(), 0x00))
            }
            val png = directory.resolve("photo.png").apply {
                writeBytes(byteArrayOf(
                    0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
                ))
            }
            val webp = directory.resolve("photo.webp").apply {
                writeBytes("RIFF1234WEBP".toByteArray())
            }

            assertTrue(validateOpenedAttachment(jpeg, "image/jpeg"))
            assertTrue(validateOpenedAttachment(png, "image/png"))
            assertTrue(validateOpenedAttachment(webp, "image/webp"))
            assertFalse(validateOpenedAttachment(jpeg, "image/png"))
        } finally {
            directory.deleteRecursively()
        }
    }
}
