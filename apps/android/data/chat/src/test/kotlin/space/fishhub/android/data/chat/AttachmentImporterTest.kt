package space.fishhub.android.data.chat

import org.junit.Assert.assertEquals
import org.junit.Test

class AttachmentImporterTest {
    @Test
    fun `document names drop paths controls bidi and cap length`() {
        val unsafe = "../folder/\u202ereport\u0000.pdf"
        assertEquals("report.pdf", sanitizeDocumentName(unsafe))
        assertEquals("File", sanitizeDocumentName("../\u0000"))
        val capped = sanitizeDocumentName("a".repeat(140))
        assertEquals(100, capped.codePointCount(0, capped.length))
    }

    @Test
    fun `document names are unicode normalized`() {
        assertEquals("Café.txt", sanitizeDocumentName("Cafe\u0301.txt"))
    }
}
