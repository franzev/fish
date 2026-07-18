package space.fishhub.android.data.chat

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.head
import io.ktor.client.request.headers
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import java.io.File
import java.io.RandomAccessFile
import java.net.URI
import java.util.Base64
import kotlinx.coroutines.ensureActive
import kotlin.coroutines.coroutineContext
import space.fishhub.android.data.chat.remote.AttachmentUploadAuthorization
import space.fishhub.android.data.chat.remote.parseRetryAfterSeconds

internal interface AttachmentUploadTransport {
    suspend fun upload(
        file: File,
        authorization: AttachmentUploadAuthorization,
        resumeUrl: String?,
        onSession: suspend (url: String, offset: Long) -> Unit,
        onProgress: suspend (sentBytes: Long) -> Unit,
    )
}

/** A deliberately small TUS 1.0 client for Edge-issued signed Supabase uploads. */
internal class KtorSignedTusUploadTransport(
    private val client: HttpClient = HttpClient(OkHttp) {
        expectSuccess = false
        followRedirects = false
    },
) : AttachmentUploadTransport {
    override suspend fun upload(
        file: File,
        authorization: AttachmentUploadAuthorization,
        resumeUrl: String?,
        onSession: suspend (url: String, offset: Long) -> Unit,
        onProgress: suspend (sentBytes: Long) -> Unit,
    ) {
        require(file.isFile && file.length() > 0) { "The private attachment copy is unavailable." }
        val endpoint = trustedEndpoint(authorization.tusEndpoint)
        val existing = resumeUrl?.let { trustedSessionUrl(endpoint, it) }
        try {
            uploadTus(file, authorization, endpoint, existing, onSession, onProgress)
        } catch (unsupported: TusUnsupportedException) {
            if (file.length() >= SignedPutMaximumBytes) throw unsupported
            uploadSignedPut(file, authorization, onProgress)
        }
    }

    private suspend fun uploadTus(
        file: File,
        authorization: AttachmentUploadAuthorization,
        endpoint: URI,
        existing: URI?,
        onSession: suspend (url: String, offset: Long) -> Unit,
        onProgress: suspend (sentBytes: Long) -> Unit,
    ) {
        val existingOffset = existing?.let { readOffset(it, authorization.uploadToken, file.length()) }
        val session: URI = if (existingOffset == null) {
            createSession(endpoint, file, authorization)
        } else {
            requireNotNull(existing)
        }
        var offset = existingOffset ?: 0L
        onSession(session.toString(), offset)
        onProgress(offset)

        var conflictCount = 0
        RandomAccessFile(file, "r").use { input ->
            while (offset < file.length()) {
                coroutineContext.ensureActive()
                val chunkSize = minOf(TusChunkBytes, file.length() - offset).toInt()
                val chunk = ByteArray(chunkSize)
                input.seek(offset)
                input.readFully(chunk)
                val response = client.patch(session.toString()) {
                    signedTusHeaders(authorization.uploadToken)
                    headers {
                        append(HttpHeaders.ContentType, TusPatchContentType)
                        append(TusUploadOffset, offset.toString())
                    }
                    setBody(chunk)
                }
                when {
                    response.status.value == 409 && conflictCount < MaxOffsetReconciliations -> {
                        conflictCount += 1
                        offset = readOffset(session, authorization.uploadToken, file.length())
                            ?: throw AttachmentTransferException("upload_expired", transient = true, resetSession = true)
                        onSession(session.toString(), offset)
                        onProgress(offset)
                    }
                    response.status.value in setOf(404, 410) ->
                        throw AttachmentTransferException("upload_expired", transient = true, resetSession = true)
                    !response.status.isSuccess() -> throw response.asTransferException("upload_unavailable")
                    else -> {
                        val next = response.headers[TusUploadOffset]?.toLongOrNull()
                            ?: throw AttachmentTransferException("upload_conflict", transient = true)
                        if (next != offset + chunkSize || next > file.length()) {
                            throw AttachmentTransferException("upload_conflict", transient = true)
                        }
                        offset = next
                        conflictCount = 0
                        onSession(session.toString(), offset)
                        onProgress(offset)
                    }
                }
            }
        }
    }

    private suspend fun createSession(
        endpoint: URI,
        file: File,
        authorization: AttachmentUploadAuthorization,
    ): URI {
        val metadata = linkedMapOf(
            "bucketName" to authorization.bucket,
            "objectName" to authorization.objectPath,
            "contentType" to authorization.uploadMimeType,
            "cacheControl" to "3600",
        ).entries.joinToString(",") { (key, value) ->
            "$key ${Base64.getEncoder().encodeToString(value.toByteArray(Charsets.UTF_8))}"
        }
        val response = client.post(endpoint.toString()) {
            signedTusHeaders(authorization.uploadToken)
            headers {
                append(TusUploadLength, file.length().toString())
                append(TusUploadMetadata, metadata)
            }
        }
        if (response.status.value in setOf(404, 405, 501)) throw TusUnsupportedException()
        if (!response.status.isSuccess()) throw response.asTransferException("upload_unavailable")
        val location = response.headers[HttpHeaders.Location]
            ?: throw AttachmentTransferException("upload_conflict", transient = true)
        return trustedSessionUrl(endpoint, endpoint.resolve(location).toString())
    }

    private suspend fun readOffset(session: URI, signature: String, length: Long): Long? {
        val response = client.head(session.toString()) { signedTusHeaders(signature) }
        if (response.status.value in setOf(404, 410)) return null
        if (!response.status.isSuccess()) throw response.asTransferException("upload_unavailable")
        val serverLength = response.headers[TusUploadLength]?.toLongOrNull()
        if (serverLength != null && serverLength != length) {
            throw AttachmentTransferException("upload_conflict", transient = false, resetSession = true)
        }
        return response.headers[TusUploadOffset]?.toLongOrNull()
            ?.takeIf { it in 0..length }
            ?: throw AttachmentTransferException("upload_conflict", transient = true)
    }

    private suspend fun uploadSignedPut(
        file: File,
        authorization: AttachmentUploadAuthorization,
        onProgress: suspend (sentBytes: Long) -> Unit,
    ) {
        val url = URI(authorization.signedUploadUrl)
        require(url.scheme == "https" || isLocalHttp(url)) { "Signed upload endpoint is not trusted." }
        val response = client.put(url.toString()) {
            headers { append("x-upsert", "false") }
            contentType(ContentType.parse(authorization.uploadMimeType))
            setBody(file.readBytes())
        }
        if (!response.status.isSuccess()) throw response.asTransferException("upload_unavailable")
        onProgress(file.length())
    }

    private fun io.ktor.client.request.HttpRequestBuilder.signedTusHeaders(signature: String) {
        headers {
            append(TusResumable, TusVersion)
            append(TusSignature, signature)
        }
    }

    private fun trustedEndpoint(value: String): URI = URI(value).also { endpoint ->
        require(
            endpoint.userInfo == null && endpoint.host != null &&
                (endpoint.scheme == "https" || isLocalHttp(endpoint)),
        ) { "TUS endpoint is not trusted." }
    }

    private fun trustedSessionUrl(endpoint: URI, value: String): URI = URI(value).also { session ->
        require(
            session.userInfo == null && session.scheme == endpoint.scheme &&
                session.host.equals(endpoint.host, ignoreCase = true) &&
                effectivePort(session) == effectivePort(endpoint),
        ) { "TUS session endpoint changed origin." }
    }

    private fun isLocalHttp(uri: URI): Boolean = uri.scheme == "http" &&
        (uri.host == "127.0.0.1" || uri.host == "localhost" || uri.host == "10.0.2.2")

    private fun effectivePort(uri: URI): Int = when {
        uri.port >= 0 -> uri.port
        uri.scheme == "https" -> 443
        else -> 80
    }
}

internal open class AttachmentTransferException(
    val code: String,
    val transient: Boolean,
    val resetSession: Boolean = false,
    val retryAfterSeconds: Long? = null,
) : IllegalStateException(code)

private class TusUnsupportedException : AttachmentTransferException(
    code = "tus_unsupported",
    transient = false,
)

private fun HttpResponse.asTransferException(defaultCode: String): AttachmentTransferException {
    val transient = status.value in setOf(408, 425, 429) || status.value >= 500
    val refreshableSignature = status.value in setOf(401, 403)
    return AttachmentTransferException(
        code = if (refreshableSignature) "upload_expired" else defaultCode,
        transient = transient || refreshableSignature,
        resetSession = refreshableSignature,
        retryAfterSeconds = parseRetryAfterSeconds(headers[HttpHeaders.RetryAfter]),
    )
}

private const val TusResumable = "Tus-Resumable"
private const val TusVersion = "1.0.0"
private const val TusSignature = "x-signature"
private const val TusUploadLength = "Upload-Length"
private const val TusUploadOffset = "Upload-Offset"
private const val TusUploadMetadata = "Upload-Metadata"
private const val TusPatchContentType = "application/offset+octet-stream"
private const val TusChunkBytes = 6L * 1024L * 1024L
private const val SignedPutMaximumBytes = 6L * 1024L * 1024L
private const val MaxOffsetReconciliations = 2
