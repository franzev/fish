package space.fishhub.android

import java.net.URI

internal object ExternalWebLinkPolicy {
    fun build(baseUrl: String, path: String, isRelease: Boolean): String? {
        val base = runCatching { URI(baseUrl.trim()) }.getOrNull() ?: return null
        val scheme = base.scheme?.lowercase() ?: return null
        if (scheme !in setOf("http", "https")) return null
        if (isRelease && scheme != "https") return null
        if (base.userInfo != null || base.host.isNullOrBlank()) return null
        if (base.rawQuery != null || base.rawFragment != null) return null
        if (base.path.isNotEmpty() && base.path != "/") return null
        if (path !in AllowedPaths) return null

        return runCatching {
            URI(
                scheme,
                null,
                base.host,
                base.port,
                path,
                null,
                null,
            ).toASCIIString()
        }.getOrNull()
    }

    private val AllowedPaths = setOf("/forgot-password", "/privacy")
}
