package space.fishhub.android.data.chat

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import androidx.exifinterface.media.ExifInterface
import androidx.core.graphics.scale
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.io.InputStreamReader
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.text.Normalizer
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Locale
import java.util.UUID
import java.util.zip.ZipFile
import kotlin.math.max
import kotlin.math.roundToInt
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import space.fishhub.android.data.chat.local.AttachmentDraftEntity

internal interface LocalAttachmentImporter {
    suspend fun import(
        source: AttachmentImportSource,
        conversationId: String,
        userId: String,
        position: Int,
    ): AttachmentDraftEntity

    fun delete(entity: AttachmentDraftEntity)
    fun deleteAll(entities: Collection<AttachmentDraftEntity>)
    fun cleanupOrphans(livePaths: Set<String>, olderThanEpochMillis: Long)
}

internal class AttachmentImporter(
    context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val now: () -> Instant = Instant::now,
) : LocalAttachmentImporter {
    private val resolver = context.applicationContext.contentResolver
    private val root = File(context.noBackupFilesDir, "chat-attachment-drafts")

    override suspend fun import(
        source: AttachmentImportSource,
        conversationId: String,
        userId: String,
        position: Int,
    ): AttachmentDraftEntity = withContext(ioDispatcher) {
        require(source.uri.scheme == ContentResolver.SCHEME_CONTENT) {
            "Only files selected through Android can be added."
        }
        val metadata = queryMetadata(source.uri)
        val id = UUID.randomUUID().toString()
        val directory = privateDirectory(userId, conversationId).apply { mkdirs() }
        val staged = File(directory, ".$id.source.tmp")
        try {
            val maxSourceBytes = when (source.kind) {
                AttachmentImportKind.Image -> MaxImageSourceBytes
                AttachmentImportKind.File -> if (isVideoSource(metadata)) {
                    MaxVideoSourceBytes
                } else {
                    MaxDocumentBytes
                }
            }
            val byteSize = copyBounded(source.uri, staged, maxSourceBytes)
            if (byteSize == 0L) throw AttachmentImportException("That file is empty.")
            if (metadata.declaredSize != null && metadata.declaredSize >= 0 &&
                metadata.declaredSize != byteSize
            ) {
                throw AttachmentImportException("That file changed while it was being read. Choose it again.")
            }
            when (source.kind) {
                AttachmentImportKind.Image -> prepareImage(
                    source = staged,
                    id = id,
                    directory = directory,
                    providerMime = metadata.mimeType,
                    displayName = metadata.displayName,
                    conversationId = conversationId,
                    userId = userId,
                    position = position,
                )
                AttachmentImportKind.File -> prepareDocument(
                    source = staged,
                    id = id,
                    directory = directory,
                    providerMime = metadata.mimeType,
                    displayName = metadata.displayName,
                    conversationId = conversationId,
                    userId = userId,
                    position = position,
                )
            }
        } finally {
            staged.delete()
        }
    }

    override fun delete(entity: AttachmentDraftEntity) {
        deleteOwnedPath(entity.localPath)
        entity.thumbnailPath?.let(::deleteOwnedPath)
        File(entity.localPath).parentFile?.delete()
    }

    override fun deleteAll(entities: Collection<AttachmentDraftEntity>) = entities.forEach(::delete)

    override fun cleanupOrphans(livePaths: Set<String>, olderThanEpochMillis: Long) {
        val live = livePaths.mapNotNullTo(mutableSetOf()) { path ->
            runCatching { File(path).canonicalPath }.getOrNull()
        }
        root.walkBottomUp().forEach { file ->
            if (file == root) return@forEach
            if (file.isDirectory) {
                file.delete()
            } else if (file.lastModified() <= olderThanEpochMillis &&
                runCatching { file.canonicalPath }.getOrNull() !in live
            ) {
                file.delete()
            }
        }
    }

    private fun prepareImage(
        source: File,
        id: String,
        directory: File,
        providerMime: String?,
        displayName: String?,
        conversationId: String,
        userId: String,
        position: Int,
    ): AttachmentDraftEntity {
        val detectedMime = detectImageMime(source)
            ?: throw AttachmentImportException("That photo format is not supported.")
        validateImageHints(providerMime, displayName, detectedMime)
        if (detectedMime == MimeAvif && !supportsAvif()) {
            throw AttachmentImportException("This device cannot prepare that AVIF photo.")
        }
        var bitmap = decodeImage(source)
        val outputTemp = File(directory, ".$id.upload.tmp")
        val final = File(directory, "$id.upload.webp")
        val thumbTemp = File(directory, ".$id.thumb.tmp")
        val thumbnail = File(directory, "$id.thumb.webp")
        try {
            bitmap = compressWithinLimit(bitmap, outputTemp)
            atomicMove(outputTemp, final)
            writeThumbnail(bitmap, thumbTemp)
            atomicMove(thumbTemp, thumbnail)
            val timestamp = now()
            return AttachmentDraftEntity(
                id = id,
                conversationId = conversationId,
                userId = userId,
                position = position,
                kind = "image",
                scope = "preview",
                displayName = "Photo",
                sourceMimeType = detectedMime,
                storedMimeType = MimeWebp,
                byteSize = final.length(),
                sourceByteSize = source.length(),
                width = bitmap.width,
                height = bitmap.height,
                localPath = final.absolutePath,
                thumbnailPath = thumbnail.absolutePath,
                sha256 = sha256(final),
                createdAt = timestamp.toString(),
                updatedAt = timestamp.toString(),
                expiresAt = timestamp.plus(DraftTtlDays, ChronoUnit.DAYS).toString(),
                clientUploadId = id,
            )
        } catch (error: Throwable) {
            outputTemp.delete()
            final.delete()
            thumbTemp.delete()
            thumbnail.delete()
            throw error
        } finally {
            bitmap.recycle()
        }
    }

    private fun prepareDocument(
        source: File,
        id: String,
        directory: File,
        providerMime: String?,
        displayName: String?,
        conversationId: String,
        userId: String,
        position: Int,
    ): AttachmentDraftEntity {
        val safeName = sanitizeDocumentName(displayName)
        val extension = safeName.substringAfterLast('.', "").lowercase(Locale.ROOT)
        val detectedMime = validateDocument(source, providerMime, extension)
        val final = File(directory, "$id.document.${extension.ifBlank { "bin" }}")
        atomicMove(source, final)
        val timestamp = now()
        return AttachmentDraftEntity(
            id = id,
            conversationId = conversationId,
            userId = userId,
            position = position,
            kind = "file",
            scope = "preview",
            displayName = safeName,
            sourceMimeType = detectedMime,
            storedMimeType = detectedMime,
            byteSize = final.length(),
            sourceByteSize = final.length(),
            width = null,
            height = null,
            localPath = final.absolutePath,
            thumbnailPath = null,
            sha256 = sha256(final),
            createdAt = timestamp.toString(),
            updatedAt = timestamp.toString(),
            expiresAt = timestamp.plus(DraftTtlDays, ChronoUnit.DAYS).toString(),
            clientUploadId = id,
        )
    }

    private fun copyBounded(uri: Uri, destination: File, limit: Long): Long {
        val input = resolver.openInputStream(uri)
            ?: throw AttachmentImportException("That file is no longer available. Choose it again.")
        input.use { source ->
            FileOutputStream(destination).use { output ->
                val buffer = ByteArray(BufferBytes)
                var total = 0L
                while (true) {
                    val read = source.read(buffer)
                    if (read < 0) break
                    total += read
                    if (total > limit) {
                        throw AttachmentImportException(
                            if (limit == MaxImageSourceBytes) {
                                "That photo is larger than 25 MB. Choose a smaller copy."
                            } else if (limit == MaxVideoSourceBytes) {
                                "That video is larger than 25 MB. Choose a shorter copy."
                            } else {
                                "That file is larger than 10 MB. Choose a smaller file."
                            },
                        )
                    }
                    output.write(buffer, 0, read)
                }
                output.fd.sync()
                return total
            }
        }
    }

    private fun decodeImage(source: File): Bitmap {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            var originalWidth = 0
            var originalHeight = 0
            try {
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(source)) { decoder, info, _ ->
                    originalWidth = info.size.width
                    originalHeight = info.size.height
                    validateDimensions(originalWidth, originalHeight)
                    val target = scaledSize(originalWidth, originalHeight, MaxImageDimension)
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE)
                    decoder.setTargetSize(target.first, target.second)
                    decoder.setOnPartialImageListener { false }
                }
            } catch (error: AttachmentImportException) {
                throw error
            } catch (_: Throwable) {
                throw AttachmentImportException("That photo could not be prepared. Choose a different copy.")
            }.also {
                if (originalWidth == 0 || originalHeight == 0) {
                    it.recycle()
                    throw AttachmentImportException("That photo could not be prepared. Choose a different copy.")
                }
            }
        } else {
            decodeLegacyImage(source)
        }
    }

    private fun decodeLegacyImage(source: File): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(source.absolutePath, bounds)
        validateDimensions(bounds.outWidth, bounds.outHeight)
        val sample = calculateSampleSize(bounds.outWidth, bounds.outHeight, MaxImageDimension)
        val decoded = BitmapFactory.decodeFile(
            source.absolutePath,
            BitmapFactory.Options().apply {
                inSampleSize = sample
                inPreferredConfig = Bitmap.Config.ARGB_8888
            },
        ) ?: throw AttachmentImportException("That photo could not be prepared. Choose a different copy.")
        val oriented = applyExifOrientation(decoded, source)
        return scaleBitmap(oriented, MaxImageDimension)
    }

    private fun validateDimensions(width: Int, height: Int) {
        if (width <= 0 || height <= 0) {
            throw AttachmentImportException("That photo could not be prepared. Choose a different copy.")
        }
        if (width.toLong() * height.toLong() > MaxDecodedPixels) {
            throw AttachmentImportException("That photo is too large to prepare safely.")
        }
    }

    private fun applyExifOrientation(bitmap: Bitmap, source: File): Bitmap {
        val orientation = runCatching {
            ExifInterface(source).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL,
            )
        }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> {
                matrix.setRotate(90f)
                matrix.postScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
            ExifInterface.ORIENTATION_TRANSVERSE -> {
                matrix.setRotate(-90f)
                matrix.postScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
            else -> return bitmap
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            .also { if (it !== bitmap) bitmap.recycle() }
    }

    private fun compressWithinLimit(initial: Bitmap, destination: File): Bitmap {
        var bitmap = scaleBitmap(initial, MaxImageDimension)
        var quality = InitialWebpQuality
        repeat(MaxCompressionAttempts) {
            FileOutputStream(destination, false).use { output ->
                if (!bitmap.compress(webpFormat(), quality, output)) {
                    throw AttachmentImportException("That photo could not be prepared. Choose a different copy.")
                }
                output.fd.sync()
            }
            if (destination.length() in 1..MaxNormalizedImageBytes) return bitmap
            if (quality > MinimumWebpQuality) {
                quality = max(MinimumWebpQuality, quality - QualityStep)
            } else {
                val resized = bitmap.scale(
                    max(MinimumImageDimension, (bitmap.width * ResizeFactor).roundToInt()),
                    max(MinimumImageDimension, (bitmap.height * ResizeFactor).roundToInt()),
                )
                if (resized.width == bitmap.width && resized.height == bitmap.height) {
                    resized.recycle()
                    throw AttachmentImportException("That photo could not fit the upload limit.")
                }
                bitmap.recycle()
                bitmap = resized
                quality = InitialWebpQuality
            }
        }
        bitmap.recycle()
        throw AttachmentImportException("That photo could not fit the upload limit.")
    }

    private fun writeThumbnail(bitmap: Bitmap, destination: File) {
        val target = scaledSize(bitmap.width, bitmap.height, ThumbnailDimension)
        val thumbnail = bitmap.scale(target.first, target.second)
        try {
            FileOutputStream(destination).use { output ->
                if (!thumbnail.compress(webpFormat(), ThumbnailQuality, output)) {
                    throw IOException("Could not encode thumbnail")
                }
                output.fd.sync()
            }
        } finally {
            if (thumbnail !== bitmap) thumbnail.recycle()
        }
    }

    private fun scaleBitmap(bitmap: Bitmap, maxDimension: Int): Bitmap {
        val target = scaledSize(bitmap.width, bitmap.height, maxDimension)
        if (target.first == bitmap.width && target.second == bitmap.height) return bitmap
        return bitmap.scale(target.first, target.second)
            .also { bitmap.recycle() }
    }

    private fun queryMetadata(uri: Uri): SourceMetadata {
        val mime = resolver.getType(uri)?.lowercase(Locale.ROOT)
        var declaredSize: Long? = null
        val name = runCatching {
            resolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
                null,
                null,
                null,
            )?.use { cursor ->
                if (!cursor.moveToFirst()) return@use null
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) declaredSize = cursor.getLong(sizeIndex)
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) cursor.getString(nameIndex) else null
            }
        }.getOrNull()
        return SourceMetadata(name, mime, declaredSize)
    }

    private fun isVideoSource(metadata: SourceMetadata): Boolean =
        metadata.mimeType == MimeVideoMp4 ||
            metadata.displayName?.substringAfterLast('.', "")?.equals("mp4", ignoreCase = true) == true

    private fun validateImageHints(providerMime: String?, name: String?, detectedMime: String) {
        if (providerMime != null && providerMime !in GenericMimeTypes && providerMime != detectedMime &&
            !(detectedMime in HeifMimes && providerMime in HeifMimes)
        ) {
            throw AttachmentImportException("That photo's type does not match its contents.")
        }
        val extension = name?.substringAfterLast('.', "")?.lowercase(Locale.ROOT).orEmpty()
        if (extension.isNotEmpty() && extension !in ImageExtensions.getValue(detectedMime)) {
            throw AttachmentImportException("That photo's name does not match its contents.")
        }
    }

    private fun detectImageMime(file: File): String? {
        val header = ByteArray(32)
        val count = FileInputStream(file).use { it.read(header) }
        if (count >= 3 && header[0] == 0xff.toByte() && header[1] == 0xd8.toByte() && header[2] == 0xff.toByte()) {
            return MimeJpeg
        }
        if (count >= 8 && header.copyOfRange(0, 8).contentEquals(PngSignature)) return MimePng
        if (count >= 12 && header.ascii(0, 4) == "RIFF" && header.ascii(8, 12) == "WEBP") return MimeWebp
        if (count >= 12 && header.ascii(4, 8) == "ftyp") {
            val brands = header.ascii(8, count).chunked(4).toSet()
            if (brands.any { it in AvifBrands }) return MimeAvif
            if (brands.any { it in HeifBrands }) return MimeHeic
        }
        return null
    }

    private fun validateDocument(file: File, providerMime: String?, extension: String): String {
        val expected = DocumentTypes[extension]
            ?: throw AttachmentImportException("That file format is not supported.")
        if (providerMime != null && providerMime !in GenericMimeTypes && providerMime !in expected.aliases) {
            throw AttachmentImportException("That file's type does not match its name.")
        }
        when (expected.kind) {
            DocumentSignature.Pdf -> if (!startsWith(file, "%PDF-".toByteArray())) {
                throw AttachmentImportException("That PDF does not appear to be valid.")
            }
            DocumentSignature.Text -> validateText(file)
            DocumentSignature.Zip -> validateOfficeZip(file, expected.officeRoot!!)
            DocumentSignature.Audio, DocumentSignature.Video -> validateMp4(file, expected.kind)
        }
        return expected.mime
    }

    private fun validateMp4(file: File, kind: DocumentSignature) {
        val message = if (kind == DocumentSignature.Video) {
            "That video could not be read. Choose another copy."
        } else {
            "That recording could not be read. Try recording it again."
        }
        val bytes = file.readBytes()
        var offset = 0
        var hasFileType = false
        var hasMovie = false
        var hasMediaData = false
        var boxCount = 0
        while (offset < bytes.size) {
            if (bytes.size - offset < 8 || boxCount++ > 256) {
                throw AttachmentImportException(message)
            }
            val declaredSize = readBigEndianUInt32(bytes, offset)
            val type = bytes.copyOfRange(offset + 4, offset + 8).decodeToString()
            var headerSize = 8
            var boxSize = declaredSize
            if (declaredSize == 1L) {
                if (bytes.size - offset < 16 || readBigEndianUInt32(bytes, offset + 8) != 0L) {
                    throw AttachmentImportException(message)
                }
                boxSize = readBigEndianUInt32(bytes, offset + 12)
                headerSize = 16
            } else if (declaredSize == 0L) {
                boxSize = (bytes.size - offset).toLong()
            }
            if (boxSize < headerSize || boxSize > bytes.size - offset) {
                throw AttachmentImportException(message)
            }
            when (type) {
                "ftyp" -> {
                    if (boxSize < headerSize + 8) {
                        throw AttachmentImportException("That recording could not be read. Try recording it again.")
                    }
                    hasFileType = true
                }
                "moov" -> hasMovie = boxSize > headerSize
                "mdat" -> hasMediaData = boxSize > headerSize
            }
            offset += boxSize.toInt()
        }
        if (!hasFileType || !hasMovie || !hasMediaData) {
            throw AttachmentImportException(message)
        }
    }

    private fun readBigEndianUInt32(bytes: ByteArray, offset: Int): Long =
        ((bytes[offset].toLong() and 0xff) shl 24) or
            ((bytes[offset + 1].toLong() and 0xff) shl 16) or
            ((bytes[offset + 2].toLong() and 0xff) shl 8) or
            (bytes[offset + 3].toLong() and 0xff)

    private fun validateText(file: File) {
        try {
            val decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
            InputStreamReader(FileInputStream(file), decoder).use { reader ->
                val buffer = CharArray(8_192)
                while (true) {
                    val read = reader.read(buffer)
                    if (read < 0) break
                    if ((0 until read).any { buffer[it] == '\u0000' }) {
                        throw AttachmentImportException("That text file contains unsupported binary data.")
                    }
                }
            }
        } catch (_: CharacterCodingException) {
            throw AttachmentImportException("That text file must use UTF-8 encoding.")
        }
    }

    private fun validateOfficeZip(file: File, requiredRoot: String) {
        try {
            ZipFile(file).use { zip ->
                var count = 0
                var expandedBytes = 0L
                var hasContentTypes = false
                var hasRoot = false
                val entries = zip.entries()
                while (entries.hasMoreElements()) {
                    val entry = entries.nextElement()
                    count += 1
                    if (count > MaxZipEntries) throw AttachmentImportException("That document is too complex to check safely.")
                    val normalized = entry.name.replace('\\', '/')
                    if (normalized.startsWith('/') || normalized.split('/').any { it == ".." }) {
                        throw AttachmentImportException("That document contains unsafe paths.")
                    }
                    if (normalized.endsWith("vbaProject.bin", ignoreCase = true)) {
                        throw AttachmentImportException("Macro-enabled documents are not supported.")
                    }
                    if (!entry.isDirectory) {
                        if (entry.size < 0) throw AttachmentImportException("That document could not be checked safely.")
                        expandedBytes += entry.size
                        if (expandedBytes > MaxExpandedZipBytes) {
                            throw AttachmentImportException("That document is too complex to check safely.")
                        }
                    }
                    hasContentTypes = hasContentTypes || normalized == "[Content_Types].xml"
                    hasRoot = hasRoot || normalized.startsWith("$requiredRoot/")
                }
                if (!hasContentTypes || !hasRoot) {
                    throw AttachmentImportException("That document's contents do not match its name.")
                }
            }
        } catch (error: AttachmentImportException) {
            throw error
        } catch (_: Throwable) {
            throw AttachmentImportException("That document could not be opened safely.")
        }
    }

    private fun supportsAvif(): Boolean = Build.VERSION.SDK_INT >= 34 &&
        ImageDecoder.isMimeTypeSupported(MimeAvif)

    private fun privateDirectory(userId: String, conversationId: String): File = File(
        File(root, stableSegment(userId)),
        stableSegment(conversationId),
    )

    private fun deleteOwnedPath(path: String) {
        val file = File(path)
        val rootPath = runCatching { root.canonicalFile.toPath() }.getOrNull() ?: return
        val filePath = runCatching { file.canonicalFile.toPath() }.getOrNull() ?: return
        if (filePath.startsWith(rootPath)) file.delete()
    }

    private fun stableSegment(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(StandardCharsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
        .take(24)

    private fun atomicMove(source: File, destination: File) {
        try {
            Files.move(
                source.toPath(),
                destination.toPath(),
                StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING,
            )
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(source.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        BufferedInputStream(FileInputStream(file)).use { input ->
            val buffer = ByteArray(BufferBytes)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun webpFormat(): Bitmap.CompressFormat = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Bitmap.CompressFormat.WEBP_LOSSY
    } else {
        @Suppress("DEPRECATION")
        Bitmap.CompressFormat.WEBP
    }

    private data class SourceMetadata(
        val displayName: String?,
        val mimeType: String?,
        val declaredSize: Long?,
    )
}

internal class AttachmentImportException(message: String) : IOException(message)

internal fun sanitizeDocumentName(value: String?): String {
    val normalized = Normalizer.normalize(value.orEmpty(), Normalizer.Form.NFKC)
        .substringAfterLast('/')
        .substringAfterLast('\\')
        .filterNot { Character.isISOControl(it) || Character.getType(it) == Character.FORMAT.toInt() }
        .trim()
        .trim('.')
    if (normalized.isBlank()) return "File"
    val codePoints = normalized.codePoints().toArray()
    return if (codePoints.size <= MaxDisplayNameCodePoints) normalized else {
        String(codePoints, 0, MaxDisplayNameCodePoints).trimEnd().ifBlank { "File" }
    }
}

private fun scaledSize(width: Int, height: Int, maxDimension: Int): Pair<Int, Int> {
    val largest = max(width, height)
    if (largest <= maxDimension) return width to height
    val scale = maxDimension.toDouble() / largest.toDouble()
    return max(1, (width * scale).roundToInt()) to max(1, (height * scale).roundToInt())
}

private fun calculateSampleSize(width: Int, height: Int, maxDimension: Int): Int {
    var sample = 1
    while (width / (sample * 2) >= maxDimension || height / (sample * 2) >= maxDimension) sample *= 2
    return sample
}

private fun ByteArray.ascii(start: Int, end: Int): String =
    String(this, start, (end - start).coerceAtMost(size - start), StandardCharsets.US_ASCII)

private fun startsWith(file: File, signature: ByteArray): Boolean {
    val actual = ByteArray(signature.size)
    val read = FileInputStream(file).use { it.read(actual) }
    return read == signature.size && actual.contentEquals(signature)
}

private enum class DocumentSignature { Pdf, Text, Zip, Audio, Video }

private data class DocumentType(
    val mime: String,
    val aliases: Set<String>,
    val kind: DocumentSignature,
    val officeRoot: String? = null,
)

private const val MimeJpeg = "image/jpeg"
private const val MimePng = "image/png"
private const val MimeWebp = "image/webp"
private const val MimeHeic = "image/heic"
private const val MimeAvif = "image/avif"
private const val MimeAudioMp4 = "audio/mp4"
private const val MimeVideoMp4 = "video/mp4"
private const val MaxImageSourceBytes = 25L * 1024L * 1024L
private const val MaxVideoSourceBytes = 25L * 1024L * 1024L
private const val MaxDocumentBytes = 10L * 1024L * 1024L
private const val MaxNormalizedImageBytes = 5L * 1024L * 1024L
private const val MaxDecodedPixels = 25_000_000L
private const val MaxImageDimension = 1_920
private const val ThumbnailDimension = 64
private const val MinimumImageDimension = 64
private const val InitialWebpQuality = 88
private const val MinimumWebpQuality = 60
private const val ThumbnailQuality = 80
private const val QualityStep = 7
private const val ResizeFactor = 0.85f
private const val MaxCompressionAttempts = 24
private const val BufferBytes = 32 * 1024
private const val DraftTtlDays = 7L
private const val MaxDisplayNameCodePoints = 100
private const val MaxZipEntries = 1_000
private const val MaxExpandedZipBytes = 50L * 1024L * 1024L

private val PngSignature = byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
private val HeifMimes = setOf("image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence")
private val GenericMimeTypes = setOf("application/octet-stream", "binary/octet-stream")
private val HeifBrands = setOf("heic", "heix", "hevc", "hevx", "mif1", "msf1")
private val AvifBrands = setOf("avif", "avis")
private val ImageExtensions = mapOf(
    MimeJpeg to setOf("jpg", "jpeg"),
    MimePng to setOf("png"),
    MimeWebp to setOf("webp"),
    MimeHeic to setOf("heic", "heif"),
    MimeAvif to setOf("avif"),
)
private val DocumentTypes = mapOf(
    "m4a" to DocumentType(MimeAudioMp4, setOf(MimeAudioMp4), DocumentSignature.Audio),
    "mp4" to DocumentType(MimeVideoMp4, setOf(MimeVideoMp4), DocumentSignature.Video),
    "pdf" to DocumentType("application/pdf", setOf("application/pdf"), DocumentSignature.Pdf),
    "txt" to DocumentType("text/plain", setOf("text/plain"), DocumentSignature.Text),
    "csv" to DocumentType("text/csv", setOf("text/csv", "text/plain", "application/csv"), DocumentSignature.Text),
    "docx" to DocumentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        setOf("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        DocumentSignature.Zip,
        "word",
    ),
    "xlsx" to DocumentType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        setOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        DocumentSignature.Zip,
        "xl",
    ),
    "pptx" to DocumentType(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        setOf("application/vnd.openxmlformats-officedocument.presentationml.presentation"),
        DocumentSignature.Zip,
        "ppt",
    ),
)
