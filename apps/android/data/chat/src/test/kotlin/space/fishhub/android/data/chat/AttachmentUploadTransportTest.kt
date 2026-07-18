package space.fishhub.android.data.chat

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import java.io.File
import java.util.Base64
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.remote.AttachmentUploadAuthorization

class AttachmentUploadTransportTest {
    @Test
    fun createsSignedTusSessionWithRequiredMetadataAndSixMiBChunks() = runTest {
        val requests = mutableListOf<HttpRequestData>()
        val file = temporaryFile(ByteArray(6 * 1024 * 1024 + 7) { 4 })
        val engine = MockEngine { request ->
            requests += request
            when (request.method) {
                HttpMethod.Post -> respond(
                    content = "",
                    status = HttpStatusCode.Created,
                    headers = headersOf(HttpHeaders.Location, "/storage/v1/upload/resumable/session-1"),
                )
                HttpMethod.Patch -> {
                    val offset = request.headers["Upload-Offset"]!!.toLong()
                    val next = if (offset == 0L) 6L * 1024L * 1024L else file.length()
                    respond(
                        content = "",
                        status = HttpStatusCode.NoContent,
                        headers = headersOf("Upload-Offset", next.toString()),
                    )
                }
                else -> error("Unexpected ${request.method}")
            }
        }
        val sessions = mutableListOf<Pair<String, Long>>()
        val progress = mutableListOf<Long>()

        transport(engine).upload(
            file,
            authorization(),
            resumeUrl = null,
            onSession = { url, offset -> sessions += url to offset },
            onProgress = { progress += it },
        )

        val create = requests.first()
        assertEquals("signed-token", create.headers["x-signature"])
        assertEquals(file.length().toString(), create.headers["Upload-Length"])
        val metadata = decodeMetadata(checkNotNull(create.headers["Upload-Metadata"]))
        assertEquals("chat-images", metadata["bucketName"])
        assertEquals("conversation/attachment/staging", metadata["objectName"])
        assertEquals("image/webp", metadata["contentType"])
        assertEquals(listOf(0L, 6L * 1024L * 1024L, file.length()), progress)
        assertTrue(sessions.all { it.first == "https://project.storage.supabase.co/storage/v1/upload/resumable/session-1" })
        assertEquals(2, requests.count { it.method == HttpMethod.Patch })
        assertTrue(requests.filter { it.method != HttpMethod.Put }.all {
            it.headers["x-signature"] == "signed-token"
        })
        file.delete()
    }

    @Test
    fun resumesFromServerHeadOffsetInsteadOfTrustingLocalOffset() = runTest {
        val offsets = mutableListOf<Long>()
        val file = temporaryFile("resume me".toByteArray())
        val engine = MockEngine { request ->
            when (request.method) {
                HttpMethod.Head -> respond(
                    "",
                    HttpStatusCode.NoContent,
                    headersOf(
                        "Upload-Offset" to listOf("3"),
                        "Upload-Length" to listOf(file.length().toString()),
                    ),
                )
                HttpMethod.Patch -> {
                    assertEquals("3", request.headers["Upload-Offset"])
                    respond("", HttpStatusCode.NoContent, headersOf("Upload-Offset", file.length().toString()))
                }
                else -> error("Unexpected request")
            }
        }

        transport(engine).upload(
            file,
            authorization(),
            resumeUrl = "https://project.storage.supabase.co/storage/v1/upload/resumable/session-existing",
            onSession = { _, offset -> offsets += offset },
            onProgress = {},
        )

        assertEquals(listOf(3L, file.length()), offsets)
        file.delete()
    }

    @Test
    fun rejectsAResponseThatAdvancesToAnImpossibleOffset() = runTest {
        val file = temporaryFile("offset".toByteArray())
        val engine = MockEngine { request ->
            when (request.method) {
                HttpMethod.Post -> respond(
                    "",
                    HttpStatusCode.Created,
                    headersOf(HttpHeaders.Location, "/storage/v1/upload/resumable/session"),
                )
                HttpMethod.Patch -> respond(
                    "",
                    HttpStatusCode.NoContent,
                    headersOf("Upload-Offset", (file.length() + 1).toString()),
                )
                else -> error("Unexpected request")
            }
        }

        val error = runCatching {
            transport(engine).upload(file, authorization(), null, { _, _ -> }, {})
        }.exceptionOrNull()

        assertTrue(error is AttachmentTransferException)
        assertEquals("upload_conflict", (error as AttachmentTransferException).code)
        file.delete()
    }

    @Test
    fun usesSignedPutOnlyForSmallFilesWhenTusIsUnsupported() = runTest {
        val methods = mutableListOf<HttpMethod>()
        val file = temporaryFile("small".toByteArray())
        val engine = MockEngine { request ->
            methods += request.method
            when (request.method) {
                HttpMethod.Post -> respond("", HttpStatusCode.NotImplemented)
                HttpMethod.Put -> respond("", HttpStatusCode.OK)
                else -> error("Unexpected request")
            }
        }
        val progress = mutableListOf<Long>()

        transport(engine).upload(file, authorization(), null, { _, _ -> }, { progress += it })

        assertEquals(listOf(HttpMethod.Post, HttpMethod.Put), methods)
        assertEquals(listOf(file.length()), progress)
        file.delete()
    }

    @Test
    fun staleHeadSessionCreatesANewSessionWithoutReusingItsOffset() = runTest {
        val methods = mutableListOf<HttpMethod>()
        val file = temporaryFile("fresh session".toByteArray())
        val engine = MockEngine { request ->
            methods += request.method
            when (request.method) {
                HttpMethod.Head -> respond("", HttpStatusCode.Gone)
                HttpMethod.Post -> respond(
                    "",
                    HttpStatusCode.Created,
                    headersOf(HttpHeaders.Location, "/storage/v1/upload/resumable/new-session"),
                )
                HttpMethod.Patch -> {
                    assertEquals("0", request.headers["Upload-Offset"])
                    respond("", HttpStatusCode.NoContent, headersOf("Upload-Offset", file.length().toString()))
                }
                else -> error("Unexpected request")
            }
        }

        transport(engine).upload(
            file,
            authorization(),
            "https://project.storage.supabase.co/storage/v1/upload/resumable/stale",
            { _, _ -> },
            {},
        )

        assertEquals(listOf(HttpMethod.Head, HttpMethod.Post, HttpMethod.Patch), methods)
        file.delete()
    }

    @Test
    fun cancellingUploadStopsTheInFlightPatch() = runTest {
        val file = temporaryFile("cancel".toByteArray())
        val engine = MockEngine { request ->
            when (request.method) {
                HttpMethod.Post -> respond(
                    "",
                    HttpStatusCode.Created,
                    headersOf(HttpHeaders.Location, "/storage/v1/upload/resumable/session"),
                )
                HttpMethod.Patch -> awaitCancellation()
                else -> error("Unexpected request")
            }
        }
        val job = launch {
            transport(engine).upload(file, authorization(), null, { _, _ -> }, {})
        }
        yield()

        job.cancel()
        job.join()

        assertTrue(job.isCancelled)
        file.delete()
    }

    private fun transport(engine: MockEngine) = KtorSignedTusUploadTransport(HttpClient(engine) {
        expectSuccess = false
        followRedirects = false
    })

    private fun authorization() = AttachmentUploadAuthorization(
        attachmentId = "attachment-id",
        bucket = "chat-images",
        objectPath = "conversation/attachment/staging",
        uploadToken = "signed-token",
        uploadMimeType = "image/webp",
        tusEndpoint = "https://project.storage.supabase.co/storage/v1/upload/resumable",
        signedUploadUrl = "https://project.supabase.co/storage/v1/object/upload/sign/chat-images/path?token=redacted",
        expiresAt = "2099-01-01T00:00:00Z",
    )

    private fun temporaryFile(bytes: ByteArray): File = File.createTempFile("attachment", ".bin").apply {
        writeBytes(bytes)
    }

    private fun decodeMetadata(value: String): Map<String, String> = value.split(',').associate { field ->
        val (key, encoded) = field.split(' ', limit = 2)
        key to String(Base64.getDecoder().decode(encoded), Charsets.UTF_8)
    }
}
