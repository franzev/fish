package space.fishhub.android

import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AttachmentFilePolicyTest {
    @Test
    fun downloadUrlAllowsOnlyConfiguredSupabaseHttpsHosts() {
        assertNotNull(
            trustedAttachmentDownloadUrl(
                "https://project.supabase.co/storage/v1/object/sign/chat-images/file?token=secret",
                "project.supabase.co",
            ),
        )
        assertNotNull(
            trustedAttachmentDownloadUrl(
                "https://project.storage.supabase.co/storage/v1/object/file?token=secret",
                "project.supabase.co",
            ),
        )
        assertTrue(
            trustedAttachmentDownloadUrl(
                "https://evil.example/file?token=secret",
                "project.supabase.co",
            ) == null,
        )
        assertTrue(
            trustedAttachmentDownloadUrl(
                "http://project.supabase.co/file?token=secret",
                "project.supabase.co",
            ) == null,
        )
        assertTrue(
            trustedAttachmentDownloadUrl(
                "https://user@project.supabase.co/file?token=secret",
                "project.supabase.co",
            ) == null,
        )
    }

    @Test
    fun sizePolicyRejectsEmptyAndOversizeDownloads() {
        assertFalse(isAllowedOpenedAttachmentSize(0))
        assertTrue(isAllowedOpenedAttachmentSize(10L * 1024L * 1024L))
        assertFalse(isAllowedOpenedAttachmentSize(10L * 1024L * 1024L + 1))
    }

    @Test
    fun exactMimeAndMagicValidationRejectsMismatchesAndBinaryText() {
        val pdf = temporaryFile("%PDF-1.7\nbody".toByteArray())
        val binaryText = temporaryFile(byteArrayOf('o'.code.toByte(), 0, 'k'.code.toByte()))

        assertTrue(validateOpenedAttachment(pdf, "application/pdf"))
        assertFalse(validateOpenedAttachment(pdf, "text/plain"))
        assertFalse(validateOpenedAttachment(binaryText, "text/plain"))
        assertFalse(validateOpenedAttachment(pdf, "application/x-executable"))
        pdf.delete()
        binaryText.delete()
    }

    @Test
    fun officeValidationRequiresExpectedRootAndRejectsMacros() {
        val clean = officeFile("word/document.xml")
        val wrongRoot = officeFile("xl/workbook.xml")
        val macro = officeFile("word/vbaProject.bin")
        val mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        assertTrue(validateOpenedAttachment(clean, mime))
        assertFalse(validateOpenedAttachment(wrongRoot, mime))
        assertFalse(validateOpenedAttachment(macro, mime))
        clean.delete()
        wrongRoot.delete()
        macro.delete()
    }

    private fun temporaryFile(bytes: ByteArray): File = File.createTempFile("open-policy", ".bin").apply {
        writeBytes(bytes)
    }

    private fun officeFile(contentEntry: String): File = File.createTempFile("open-policy", ".zip").apply {
        ZipOutputStream(outputStream()).use { zip ->
            zip.putNextEntry(ZipEntry("[Content_Types].xml"))
            zip.write("<Types/>".toByteArray())
            zip.closeEntry()
            zip.putNextEntry(ZipEntry(contentEntry))
            zip.write("content".toByteArray())
            zip.closeEntry()
        }
    }
}
