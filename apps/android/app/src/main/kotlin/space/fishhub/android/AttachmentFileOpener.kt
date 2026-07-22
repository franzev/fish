package space.fishhub.android

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.zip.ZipFile
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import space.fishhub.android.data.chat.OpenedAttachmentCacheDirectory
import space.fishhub.android.feature.chat.AttachmentOpenAction
import space.fishhub.android.feature.chat.AttachmentOpenRequest

internal class AttachmentFileOpener(
    private val activity: Activity,
    supabaseUrl: String,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val now: () -> Instant = Instant::now,
) {
    private val configuredHost = runCatching { URI(supabaseUrl).host?.lowercase() }.getOrNull()
    private val directory = File(activity.cacheDir, OpenedAttachmentCacheDirectory)

    suspend fun open(request: AttachmentOpenRequest): OpenAttachmentResult = withContext(ioDispatcher) {
        cleanupExpired()
        val expected = SupportedTypes[request.mimeType]
            ?: return@withContext OpenAttachmentResult.Failed("That file type cannot be opened safely.")
        if (request.expectedByteSize !in 1..MaximumDownloadBytes) {
            return@withContext OpenAttachmentResult.Failed("That file is too large to open safely.")
        }
        val source = trustedAttachmentDownloadUrl(request.signedUrl, configuredHost)
            ?: return@withContext OpenAttachmentResult.Failed("That file link is not trusted.")
        directory.mkdirs()
        val temporary = File(directory, ".${UUID.randomUUID()}.download")
        val destination = File(directory, "${UUID.randomUUID()}.${expected.extension}")
        try {
            downloadBounded(source, request, expected.mimeType, temporary)
            validateOpenedAttachment(temporary, expected)
            if (!temporary.renameTo(destination)) {
                temporary.copyTo(destination, overwrite = false)
                temporary.delete()
            }
            destination.setReadable(false, false)
            destination.setReadable(true, true)
            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                destination,
            )
            val handoff = when (request.action) {
                AttachmentOpenAction.Open -> Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, expected.mimeType)
                }
                AttachmentOpenAction.Share -> Intent(Intent.ACTION_SEND).apply {
                    type = expected.mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                }
            }.apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                clipData = android.content.ClipData.newUri(activity.contentResolver, "Attachment", uri)
            }
            if (activity.packageManager.queryIntentActivities(handoff, 0).isEmpty()) {
                destination.delete()
                return@withContext OpenAttachmentResult.Failed(
                    when (request.action) {
                        AttachmentOpenAction.Open -> "No app on this device can open that file type yet."
                        AttachmentOpenAction.Share -> "No app on this device can share that file type yet."
                    },
                )
            }
            withContext(Dispatchers.Main) {
                try {
                    val chooserTitle = when (request.action) {
                        AttachmentOpenAction.Open -> "Open attachment"
                        AttachmentOpenAction.Share -> "Share attachment"
                    }
                    activity.startActivity(Intent.createChooser(handoff, chooserTitle))
                    OpenAttachmentResult.Opened
                } catch (_: ActivityNotFoundException) {
                    destination.delete()
                    OpenAttachmentResult.Failed(
                        when (request.action) {
                            AttachmentOpenAction.Open -> "No app on this device can open that file type yet."
                            AttachmentOpenAction.Share -> "No app on this device can share that file type yet."
                        },
                    )
                } catch (_: SecurityException) {
                    destination.delete()
                    OpenAttachmentResult.Failed("That file could not be opened safely.")
                }
            }
        } catch (_: AttachmentOpenValidationException) {
            temporary.delete()
            destination.delete()
            OpenAttachmentResult.Failed("That file could not be verified. Try downloading it again.")
        } catch (_: Throwable) {
            temporary.delete()
            destination.delete()
            OpenAttachmentResult.Failed("That file did not open yet. Check your connection and try again.")
        }
    }

    fun cleanupAll() {
        directory.listFiles()?.forEach(File::delete)
        directory.delete()
    }

    private fun cleanupExpired() {
        val cutoff = now().minus(CacheTtl).toEpochMilli()
        directory.listFiles()?.forEach { if (it.lastModified() <= cutoff) it.delete() }
    }

    private fun downloadBounded(
        source: URL,
        request: AttachmentOpenRequest,
        expectedMime: String,
        destination: File,
    ) {
        val connection = source.openConnection() as? HttpURLConnection
            ?: throw AttachmentOpenValidationException()
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = ConnectTimeoutMs
            connection.readTimeout = ReadTimeoutMs
            connection.requestMethod = "GET"
            connection.connect()
            if (connection.responseCode !in 200..299) throw AttachmentOpenValidationException()
            val declaredLength = connection.contentLengthLong
            if (declaredLength > MaximumDownloadBytes ||
                (declaredLength >= 0 && declaredLength != request.expectedByteSize)
            ) throw AttachmentOpenValidationException()
            val responseMime = connection.contentType?.substringBefore(';')?.trim()?.lowercase()
            if (responseMime != null && responseMime != expectedMime &&
                responseMime != "application/octet-stream"
            ) throw AttachmentOpenValidationException()
            BufferedInputStream(connection.inputStream).use { input ->
                FileOutputStream(destination).use { output ->
                    val buffer = ByteArray(BufferBytes)
                    var total = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > MaximumDownloadBytes || total > request.expectedByteSize) {
                            throw AttachmentOpenValidationException()
                        }
                        output.write(buffer, 0, read)
                    }
                    output.fd.sync()
                    if (total != request.expectedByteSize) throw AttachmentOpenValidationException()
                }
            }
        } finally {
            connection.disconnect()
        }
    }

}

internal fun trustedAttachmentDownloadUrl(value: String, configuredHost: String?): URL? = runCatching {
    val uri = URI(value)
    val host = uri.host?.lowercase()
    val configured = configuredHost?.lowercase()
    val projectRef = configured?.takeIf { it.endsWith(".supabase.co") }
        ?.removeSuffix(".supabase.co")
    val allowed = configured != null && (
        host == configured ||
            (projectRef != null && host == "$projectRef.storage.supabase.co")
        )
    uri.takeIf {
        it.scheme == "https" && it.userInfo == null && it.fragment == null && allowed
    }?.toURL()
}.getOrNull()

internal fun isAllowedOpenedAttachmentSize(size: Long): Boolean = size in 1..MaximumDownloadBytes

internal fun validateOpenedAttachment(file: File, mimeType: String): Boolean {
    val type = SupportedTypes[mimeType] ?: return false
    return runCatching { validateOpenedAttachment(file, type) }.isSuccess
}

private fun validateOpenedAttachment(file: File, type: SafeFileType) {
    when (type.signature) {
        FileSignature.Pdf -> if (!file.startsWith("%PDF-".toByteArray())) {
            throw AttachmentOpenValidationException()
        }
        FileSignature.Text -> validateOpenedUtf8(file)
        FileSignature.Mp4 -> validateOpenedMp4(file)
        is FileSignature.Office -> validateOpenedOffice(file, type.signature.root)
    }
}

private fun validateOpenedUtf8(file: File) {
    if (
        file.startsWith("%PDF-".toByteArray()) ||
        file.startsWith(byteArrayOf(0x50, 0x4b, 0x03, 0x04)) ||
        file.startsWith(byteArrayOf(0xff.toByte(), 0xd8.toByte(), 0xff.toByte())) ||
        file.startsWith(byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47))
    ) throw AttachmentOpenValidationException()
    val bytes = file.readBytes()
    if (bytes.any { it == 0.toByte() }) throw AttachmentOpenValidationException()
    runCatching {
        StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes))
    }.getOrElse { throw AttachmentOpenValidationException() }
}

private fun validateOpenedMp4(file: File) {
    val bytes = file.readBytes()
    var offset = 0
    var hasFileType = false
    var hasMovie = false
    var hasMediaData = false
    var boxCount = 0
    while (offset < bytes.size) {
        if (bytes.size - offset < 8 || boxCount++ >= 256) throw AttachmentOpenValidationException()
        val declaredSize = readBigEndianUInt32(bytes, offset)
        val type = String(bytes, offset + 4, 4, Charsets.US_ASCII)
        var headerSize = 8
        var boxSize = declaredSize
        if (declaredSize == 1L) {
            if (bytes.size - offset < 16 || readBigEndianUInt32(bytes, offset + 8) != 0L) {
                throw AttachmentOpenValidationException()
            }
            boxSize = readBigEndianUInt32(bytes, offset + 12)
            headerSize = 16
        } else if (declaredSize == 0L) {
            boxSize = (bytes.size - offset).toLong()
        }
        if (boxSize < headerSize || boxSize > bytes.size - offset) {
            throw AttachmentOpenValidationException()
        }
        when (type) {
            "ftyp" -> {
                if (boxSize < headerSize + 8) throw AttachmentOpenValidationException()
                hasFileType = true
            }
            "moov" -> hasMovie = boxSize > headerSize
            "mdat" -> hasMediaData = boxSize > headerSize
        }
        offset += boxSize.toInt()
    }
    if (!hasFileType || !hasMovie || !hasMediaData) throw AttachmentOpenValidationException()
}

private fun readBigEndianUInt32(bytes: ByteArray, offset: Int): Long =
    ((bytes[offset].toLong() and 0xff) shl 24) or
        ((bytes[offset + 1].toLong() and 0xff) shl 16) or
        ((bytes[offset + 2].toLong() and 0xff) shl 8) or
        (bytes[offset + 3].toLong() and 0xff)

private fun validateOpenedOffice(file: File, expectedRoot: String) {
    try {
        ZipFile(file).use { zip ->
            var entries = 0
            var expanded = 0L
            var hasContentTypes = false
            var hasExpectedRoot = false
            val iterator = zip.entries()
            while (iterator.hasMoreElements()) {
                val entry = iterator.nextElement()
                entries += 1
                if (entries > MaximumZipEntries || entry.size < 0) throw AttachmentOpenValidationException()
                val name = entry.name.replace('\\', '/')
                if (name.startsWith('/') || name.split('/').any { it == ".." }) {
                    throw AttachmentOpenValidationException()
                }
                if (name.endsWith("vbaProject.bin", ignoreCase = true)) {
                    throw AttachmentOpenValidationException()
                }
                if (!entry.isDirectory) {
                    expanded += entry.size
                    if (expanded > MaximumExpandedBytes) throw AttachmentOpenValidationException()
                }
                hasContentTypes = hasContentTypes || name == "[Content_Types].xml"
                hasExpectedRoot = hasExpectedRoot || name.startsWith("$expectedRoot/")
            }
            if (!hasContentTypes || !hasExpectedRoot) throw AttachmentOpenValidationException()
        }
    } catch (error: AttachmentOpenValidationException) {
        throw error
    } catch (_: Throwable) {
        throw AttachmentOpenValidationException()
    }
}

internal sealed interface OpenAttachmentResult {
    data object Opened : OpenAttachmentResult
    data class Failed(val message: String) : OpenAttachmentResult
}

private class AttachmentOpenValidationException : IllegalStateException()

private fun File.startsWith(signature: ByteArray): Boolean {
    val bytes = ByteArray(signature.size)
    val count = FileInputStream(this).use { it.read(bytes) }
    return count == signature.size && bytes.contentEquals(signature)
}

private data class SafeFileType(
    val mimeType: String,
    val extension: String,
    val signature: FileSignature,
)

private sealed interface FileSignature {
    data object Pdf : FileSignature
    data object Text : FileSignature
    data object Mp4 : FileSignature
    data class Office(val root: String) : FileSignature
}

private const val MaximumDownloadBytes = 25L * 1024L * 1024L
private const val MaximumExpandedBytes = 50L * 1024L * 1024L
private const val MaximumZipEntries = 1_000
private const val BufferBytes = 32 * 1024
private const val ConnectTimeoutMs = 15_000
private const val ReadTimeoutMs = 30_000
private val CacheTtl = Duration.ofDays(1)

private val SupportedTypes = listOf(
    SafeFileType("audio/mp4", "m4a", FileSignature.Mp4),
    SafeFileType("video/mp4", "mp4", FileSignature.Mp4),
    SafeFileType("application/pdf", "pdf", FileSignature.Pdf),
    SafeFileType("text/plain", "txt", FileSignature.Text),
    SafeFileType("text/csv", "csv", FileSignature.Text),
    SafeFileType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
        FileSignature.Office("word"),
    ),
    SafeFileType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
        FileSignature.Office("xl"),
    ),
    SafeFileType(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
        FileSignature.Office("ppt"),
    ),
).associateBy(SafeFileType::mimeType)
