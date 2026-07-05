package space.fishhub.app.core.auth

import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

internal fun buildSupabaseGoogleOAuthUrl(config: AndroidAuthConfig): String? {
    val supabaseUrl = config.supabaseUrl.trim().trimEnd('/')
    val publishableKey = config.publishableKey.trim()
    val redirectUrl = config.redirectUrl.trim()

    if (supabaseUrl.isBlank() || publishableKey.isBlank() || redirectUrl.isBlank()) {
        return null
    }

    val redirect = URLEncoder.encode(redirectUrl, StandardCharsets.UTF_8.name())
    return "$supabaseUrl/auth/v1/authorize?provider=google&redirect_to=$redirect"
}

internal fun parseSupabaseOAuthCallback(uri: String?): OAuthCallbackResult? {
    if (uri.isNullOrBlank()) return null

    val params = parseParams(uri.substringAfter('#', ""))
        .ifEmpty { parseParams(uri.substringAfter('?', "")) }

    val error = params["error_description"] ?: params["error"]
    if (!error.isNullOrBlank()) {
        return OAuthCallbackResult.Failure(error)
    }

    val accessToken = params["access_token"] ?: return null
    return OAuthCallbackResult.Success(
        accessToken = accessToken,
        refreshToken = params["refresh_token"],
    )
}

private fun parseParams(raw: String): Map<String, String> {
    if (raw.isBlank()) return emptyMap()

    return raw
        .split("&")
        .mapNotNull { pair ->
            val key = pair.substringBefore("=", "")
            if (key.isBlank()) return@mapNotNull null
            val value = pair.substringAfter("=", "")
            decode(key) to decode(value)
        }
        .toMap()
}

private fun decode(value: String): String {
    return runCatching {
        URLDecoder.decode(value, StandardCharsets.UTF_8.name())
    }.getOrDefault(value)
}
