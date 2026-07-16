package com.fish.android.data.chat

import com.fish.android.data.chat.model.ChatGif
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import java.net.URI
import java.util.Locale
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject

internal class GifProviderUnavailableException : IllegalStateException("GIF provider is not configured")

internal class KlipyGifRepository(
    apiKey: String,
    clientKey: String,
    private val customerIdStore: GifCustomerIdStore,
    private val httpClient: HttpClient = defaultKlipyHttpClient(),
    private val locale: () -> String = {
        Locale.getDefault().toLanguageTag().replace('-', '_').ifBlank { "en_US" }
    },
) : GifRepository {
    private val apiKey = apiKey.trim()
    private val clientKey = clientKey.trim().ifBlank { "fish_chat_android" }
    private val json = Json { ignoreUnknownKeys = true }

    override val available: Boolean = this.apiKey.isNotEmpty()

    override suspend fun trending(cursor: String?, limit: Int): GifPage =
        request(endpoint = "featured", cursor = cursor, limit = limit)

    override suspend fun search(query: String, cursor: String?, limit: Int): GifPage {
        val normalized = query.trim().take(MaxQueryLength)
        if (normalized.isEmpty()) return GifPage(emptyList(), null)
        return request(endpoint = "search", query = normalized, cursor = cursor, limit = limit)
    }

    override suspend fun registerShare(gif: ChatGif, query: String?) {
        if (!available || gif.provider != "klipy") return
        try {
            httpClient.get("$BaseUrl/registershare") {
                parameter("key", apiKey)
                parameter("client_key", clientKey)
                parameter("id", gif.providerId)
                parameter("customer_id", customerIdStore.getOrCreate())
                parameter("locale", locale())
                query?.trim()?.take(MaxQueryLength)?.takeIf { it.isNotEmpty() }?.let {
                    parameter("q", it)
                }
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            // Share registration improves provider relevance but never changes
            // whether a confirmed chat message is considered sent.
        }
    }

    private suspend fun request(
        endpoint: String,
        query: String? = null,
        cursor: String? = null,
        limit: Int,
    ): GifPage {
        if (!available) throw GifProviderUnavailableException()
        val response = httpClient.get("$BaseUrl/$endpoint") {
            parameter("key", apiKey)
            parameter("client_key", clientKey)
            parameter("customer_id", customerIdStore.getOrCreate())
            parameter("locale", locale())
            parameter("contentfilter", "high")
            parameter("media_filter", "preview,tinygif,tinymp4,mp4")
            parameter("limit", limit.coerceIn(1, MaxPageSize))
            query?.let { parameter("q", it) }
            cursor?.take(CursorMaxLength)?.takeIf { it.isNotBlank() }?.let { parameter("pos", it) }
        }
        if (!response.status.isSuccess()) {
            throw IllegalStateException("GIF provider returned ${response.status.value}")
        }
        val root = json.parseToJsonElement(response.bodyAsText()).jsonObject
        val items = (root["results"] as? JsonArray).orEmpty().mapNotNull { result ->
            (result as? JsonObject)?.let(::mapKlipyResult)
        }
        val next = (root["next"] as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotBlank() }
        return GifPage(items = items, nextCursor = next)
    }

    private companion object {
        const val BaseUrl = "https://api.klipy.com/v2"
        const val MaxPageSize = 24
        const val MaxQueryLength = 50
        const val CursorMaxLength = 500
    }
}

private fun defaultKlipyHttpClient(): HttpClient = HttpClient(OkHttp) {
    install(HttpTimeout) {
        requestTimeoutMillis = 10_000
        connectTimeoutMillis = 10_000
        socketTimeoutMillis = 10_000
    }
}

internal fun mapKlipyResult(result: JsonObject): GifSearchItem? {
    val providerId = result.cleanText("id", maxLength = 200) ?: return null
    val formats = (result["media_formats"] as? JsonObject) ?: return null
    val posterUrl = formats.formatUrl("preview") ?: return null
    val animatedPreviewUrl = formats.formatUrl("tinygif") ?: return null
    val previewUrl = formats.formatUrl("tinymp4") ?: return null
    val mediaUrl = formats.formatUrl("mp4") ?: return null
    if (!listOf(posterUrl, animatedPreviewUrl, previewUrl, mediaUrl).all(::isKlipyMediaUrl)) {
        return null
    }
    val dimensions = listOf("mp4", "tinymp4", "preview").firstNotNullOfOrNull { key ->
        formats.dimensions(key)
    } ?: return null
    val returnedSource = listOf("itemurl", "url").firstNotNullOfOrNull { key ->
        result.httpsUrl(key)
    }
    val sourceUrl = returnedSource?.takeIf(::isKlipySourceUrl)
        ?: "https://klipy.com/gifs/${java.net.URLEncoder.encode(providerId, "UTF-8")}"
    val title = result.cleanText("title", maxLength = 300) ?: "Animated GIF"
    val description = result.cleanText("content_description", maxLength = 500) ?: title
    return GifSearchItem(
        chatGif = ChatGif(
            provider = "klipy",
            providerId = providerId,
            title = title,
            description = description,
            sourceUrl = sourceUrl,
            posterUrl = posterUrl,
            previewUrl = previewUrl,
            mediaUrl = mediaUrl,
            width = dimensions.first,
            height = dimensions.second,
        ),
        animatedPreviewUrl = animatedPreviewUrl,
    )
}

private fun JsonObject.cleanText(key: String, maxLength: Int): String? =
    (this[key] as? JsonPrimitive)?.contentOrNull?.trim()?.take(maxLength)?.takeIf { it.isNotEmpty() }

private fun JsonObject.httpsUrl(key: String): String? =
    (this[key] as? JsonPrimitive)?.contentOrNull?.takeIf { httpsHost(it) != null }

private fun JsonObject.formatUrl(key: String): String? =
    ((this[key] as? JsonObject)?.get("url") as? JsonPrimitive)?.contentOrNull
        ?.takeIf { httpsHost(it) != null }

private fun JsonObject.dimensions(key: String): Pair<Int, Int>? {
    val dims = (this[key] as? JsonObject)?.get("dims") as? JsonArray ?: return null
    if (dims.size != 2) return null
    val width = (dims[0] as? JsonPrimitive)?.intOrNull ?: return null
    val height = (dims[1] as? JsonPrimitive)?.intOrNull ?: return null
    return width.coerceAtMost(4096).takeIf { it > 0 }?.let { safeWidth ->
        height.coerceAtMost(4096).takeIf { it > 0 }?.let { safeHeight -> safeWidth to safeHeight }
    }
}

private fun isKlipySourceUrl(value: String): Boolean = httpsHost(value)?.let { host ->
    host == "klipy.com" || host.endsWith(".klipy.com")
} == true

private fun isKlipyMediaUrl(value: String): Boolean =
    httpsHost(value)?.matches(Regex("^static\\d*\\.klipy\\.com$")) == true

private fun httpsHost(value: String): String? = runCatching {
    URI(value).takeIf { it.scheme == "https" && !it.host.isNullOrBlank() }?.host?.lowercase()
}.getOrNull()
