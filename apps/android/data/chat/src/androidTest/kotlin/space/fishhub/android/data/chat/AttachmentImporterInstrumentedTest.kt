package space.fishhub.android.data.chat

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.exifinterface.media.ExifInterface
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.security.MessageDigest
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AttachmentImporterInstrumentedTest {
    private lateinit var context: Context
    private lateinit var inputDirectory: File
    private lateinit var importer: AttachmentImporter

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        inputDirectory = File(context.cacheDir, "attachment-import-tests").apply { mkdirs() }
        importer = AttachmentImporter(context)
    }

    @After
    fun tearDown() {
        TestAttachmentProvider.clear()
        inputDirectory.deleteRecursively()
    }

    @Test
    fun largeOrientedJpegIsNormalizedHashedAndStrippedOfMetadata() = runTest {
        val input = jpeg("oriented.jpg", width = 2_400, height = 1_200)
        ExifInterface(input).apply {
            setAttribute(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_ROTATE_90.toString())
            setAttribute(ExifInterface.TAG_MODEL, "Private camera")
            setAttribute(ExifInterface.TAG_GPS_LATITUDE, "1/1,2/1,3/1")
            setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, "N")
            saveAttributes()
        }
        val uri = TestAttachmentProvider.register(input, "holiday.jpg", "image/jpeg")

        val result = importer.import(
            AttachmentImportSource(uri, AttachmentImportKind.Image),
            "conversation-1",
            "client-1",
            0,
        )

        assertEquals("Photo", result.displayName)
        assertEquals("image/webp", result.storedMimeType)
        assertTrue(result.byteSize in 1..5L * 1024L * 1024L)
        assertTrue(maxOf(result.width!!, result.height!!) <= 1_920)
        assertTrue(result.height!! > result.width!!)
        assertTrue(result.localPath.startsWith(context.noBackupFilesDir.absolutePath))
        assertEquals(hash(File(result.localPath)), result.sha256)
        val thumb = BitmapFactory.decodeFile(result.thumbnailPath)
        assertTrue(maxOf(thumb.width, thumb.height) <= 64)
        thumb.recycle()
        ExifInterface(result.localPath).also { exif ->
            assertNull(exif.getAttribute(ExifInterface.TAG_MODEL))
            assertNull(exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE))
        }
        importer.delete(result)
    }

    @Test
    fun wrongMagicAndOversizeSourcesAreRejectedBeforePrivateCommit() = runTest {
        val fakeJpeg = File(inputDirectory, "fake.jpg").apply { writeText("not a photo") }
        val fakeUri = TestAttachmentProvider.register(fakeJpeg, "fake.jpg", "image/jpeg")
        val fakeError = runCatching {
            importer.import(
                AttachmentImportSource(fakeUri, AttachmentImportKind.Image),
                "conversation-1",
                "client-1",
                0,
            )
        }.exceptionOrNull()
        assertTrue(fakeError is AttachmentImportException)

        val oversize = File(inputDirectory, "oversize.jpg")
        RandomAccessFile(oversize, "rw").use { it.setLength(25L * 1024L * 1024L + 1) }
        val oversizeUri = TestAttachmentProvider.register(oversize, "oversize.jpg", "image/jpeg")
        val sizeError = runCatching {
            importer.import(
                AttachmentImportSource(oversizeUri, AttachmentImportKind.Image),
                "conversation-1",
                "client-1",
                0,
            )
        }.exceptionOrNull()
        assertTrue(sizeError?.message?.contains("larger than 25 MB") == true)
    }

    @Test
    fun pdfUsesSanitizedNameAndPreservesExactUploadHash() = runTest {
        val input = File(inputDirectory, "report.pdf").apply {
            writeBytes("%PDF-1.7\nminimal fixture".toByteArray())
        }
        val uri = TestAttachmentProvider.register(input, "../\u202ereport.pdf", "application/pdf")

        val result = importer.import(
            AttachmentImportSource(uri, AttachmentImportKind.File),
            "conversation-1",
            "client-1",
            0,
        )

        assertEquals("report.pdf", result.displayName)
        assertEquals("application/pdf", result.storedMimeType)
        assertEquals(hash(File(result.localPath)), result.sha256)
        assertEquals("%PDF-", FileInputStream(result.localPath).use { inputStream ->
            String(ByteArray(5).also { inputStream.read(it) })
        })
        importer.delete(result)
    }

    @Test
    fun m4aIsAcceptedAsAnAudioFileAndMalformedContainerIsRejected() = runTest {
        val input = File(inputDirectory, "voice.m4a").apply { writeBytes(m4a()) }
        val uri = TestAttachmentProvider.register(input, "Voice message.m4a", "audio/mp4")

        val result = importer.import(
            AttachmentImportSource(uri, AttachmentImportKind.File),
            "conversation-1",
            "client-1",
            0,
        )

        assertEquals("audio/mp4", result.storedMimeType)
        assertEquals("Voice message.m4a", result.displayName)
        importer.delete(result)

        val invalid = File(inputDirectory, "invalid.m4a").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        val invalidUri = TestAttachmentProvider.register(invalid, "invalid.m4a", "audio/mp4")
        val error = runCatching {
            importer.import(
                AttachmentImportSource(invalidUri, AttachmentImportKind.File),
                "conversation-1",
                "client-1",
                0,
            )
        }.exceptionOrNull()
        assertTrue(error is AttachmentImportException)
    }

    private fun jpeg(name: String, width: Int, height: Int): File {
        val file = File(inputDirectory, name)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.rgb(40, 100, 160))
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 92, it) }
        bitmap.recycle()
        return file
    }

    private fun hash(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(8_192)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun m4a(): ByteArray = byteArrayOf(
        0, 0, 0, 20, 'f'.code.toByte(), 't'.code.toByte(), 'y'.code.toByte(), 'p'.code.toByte(),
        'M'.code.toByte(), '4'.code.toByte(), 'A'.code.toByte(), ' '.code.toByte(),
        0, 0, 0, 0, 'M'.code.toByte(), '4'.code.toByte(), 'A'.code.toByte(), ' '.code.toByte(),
        0, 0, 0, 11, 'm'.code.toByte(), 'd'.code.toByte(), 'a'.code.toByte(), 't'.code.toByte(), 1, 2, 3,
        0, 0, 0, 12, 'm'.code.toByte(), 'o'.code.toByte(), 'o'.code.toByte(), 'v'.code.toByte(), 0, 0, 0, 1,
    )
}
