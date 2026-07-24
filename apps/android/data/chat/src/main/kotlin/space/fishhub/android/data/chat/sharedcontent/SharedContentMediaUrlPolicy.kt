package space.fishhub.android.data.chat.sharedcontent

import java.net.IDN
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URI
import java.net.URL
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.Request

enum class SharedContentMediaUrlKind {
    Storage,
    Gif,
}

/**
 * Fail-closed production URL policy for native shared-content media.
 *
 * Hostnames are canonical DNS names and the transport binds every connection
 * to the exact all-public answer set returned by [Dns]. Redirects are handled
 * manually so every hop repeats both authority and address validation.
 */
class SharedContentMediaUrlPolicy(
    configuredSupabaseUrl: String?,
    private val allowsLocalDevelopment: Boolean = false,
) {
    private val configuredUri = configuredSupabaseUrl
        ?.let { runCatching { URI(it) }.getOrNull() }
    private val configuredHost = configuredUri?.host?.let(::canonicalHostOrNull)
    private val storageHosts = buildSet {
        configuredHost?.let(::add)
        configuredHost
            ?.takeIf { it.endsWith(".supabase.co") }
            ?.removeSuffix(".supabase.co")
            ?.takeIf(String::isNotBlank)
            ?.let { add("$it.storage.supabase.co") }
    }
    private val localDevelopmentHost = configuredHost
        ?.takeIf { allowsLocalDevelopment && isLocalDevelopmentHost(it) }
    private val localDevelopmentScheme = configuredUri?.scheme
        ?.lowercase(Locale.ROOT)
        ?.takeIf { localDevelopmentHost != null }
    private val localDevelopmentPort = configuredUri
        ?.let { normalizedPort(it.scheme, it.port) }
        ?.takeIf { localDevelopmentHost != null }

    fun validatedUrl(rawUrl: String?, kind: SharedContentMediaUrlKind): URL? {
        val uri = rawUrl?.let { runCatching { URI(it) }.getOrNull() } ?: return null
        val host = uri.host?.let(::canonicalHostOrNull) ?: return null
        if (!allows(uri, host, kind)) return null
        return runCatching {
            URI(
                uri.scheme?.lowercase(Locale.ROOT),
                null,
                host,
                uri.port,
                uri.rawPath,
                uri.rawQuery,
                null,
            ).toURL()
        }.getOrNull()
    }

    fun allowsRedirect(
        from: URL,
        to: URL,
        kind: SharedContentMediaUrlKind,
    ): Boolean {
        val sourceHost = canonicalHostOrNull(from.host) ?: return false
        val destination = validatedUrl(to.toExternalForm(), kind) ?: return false
        val destinationHost = canonicalHostOrNull(destination.host) ?: return false
        return sourceHost == destinationHost &&
            from.protocol.equals(destination.protocol, ignoreCase = true)
    }

    internal fun validatingDns(delegate: Dns = Dns.SYSTEM): Dns = Dns { hostname ->
        val host = canonicalHostOrNull(hostname)
            ?: throw java.net.UnknownHostException("Invalid media hostname")
        val addresses = delegate.lookup(host)
        if (addresses.isEmpty() || !addresses.all { allowsAddress(host, it) }) {
            throw java.net.UnknownHostException("Unsafe media address")
        }
        addresses
    }

    private fun allows(uri: URI, host: String, kind: SharedContentMediaUrlKind): Boolean {
        if (uri.userInfo != null || uri.fragment != null) return false
        val scheme = uri.scheme?.lowercase(Locale.ROOT)

        if (kind == SharedContentMediaUrlKind.Storage &&
            allowsLocalDevelopment &&
            host == localDevelopmentHost &&
            scheme == localDevelopmentScheme &&
            normalizedPort(scheme, uri.port) == localDevelopmentPort
        ) {
            return true
        }

        if (scheme != "https" ||
            (uri.port != -1 && uri.port != 443) ||
            isSpecialUseHost(host)
        ) return false

        return when (kind) {
            SharedContentMediaUrlKind.Storage -> host in storageHosts
            SharedContentMediaUrlKind.Gif ->
                NumberedKlipyHost.matches(host) || NumberedGiphyHost.matches(host)
        }
    }

    private fun allowsAddress(host: String, address: InetAddress): Boolean =
        if (allowsLocalDevelopment && host == localDevelopmentHost) {
            address.isLoopbackAddress
        } else {
            isPublicUnicast(address)
        }

    internal companion object {
        private val NumberedKlipyHost = Regex("^static\\d*\\.klipy\\.com$")
        private val NumberedGiphyHost = Regex("^media\\d*\\.giphy\\.com$")
        private val SpecialUseSuffixes = listOf(
            ".localhost",
            ".local",
            ".localdomain",
            ".internal",
            ".lan",
            ".home",
            ".home.arpa",
            ".invalid",
            ".test",
            ".example",
            ".onion",
        )

        fun canonicalHostOrNull(rawHost: String): String? = runCatching {
            val withoutTerminalDot = rawHost.removeSuffix(".")
            require(withoutTerminalDot.isNotBlank() && !withoutTerminalDot.endsWith("."))
            IDN.toASCII(withoutTerminalDot, IDN.USE_STD3_ASCII_RULES)
                .lowercase(Locale.ROOT)
                .takeIf { it.length <= 253 && it.split('.').all { label -> label.length in 1..63 } }
                ?: error("Invalid DNS name")
        }.getOrNull()

        fun isSpecialUseHost(host: String): Boolean =
            isIpAddress(host) ||
                isLocalDevelopmentHost(host) ||
                SpecialUseSuffixes.any(host::endsWith) ||
                "." !in host

        fun isLocalDevelopmentHost(host: String): Boolean =
            host == "localhost" ||
                host.endsWith(".localhost") ||
                host == "127.0.0.1" ||
                host == "::1" ||
                host == "[::1]"

        fun isIpAddress(host: String): Boolean {
            if (':' in host) return true
            val octets = host.split('.')
            return octets.size == 4 && octets.all {
                it.toIntOrNull()?.let { value -> value in 0..255 } == true
            }
        }

        fun isPublicUnicast(address: InetAddress): Boolean {
            if (address.isAnyLocalAddress ||
                address.isLoopbackAddress ||
                address.isLinkLocalAddress ||
                address.isSiteLocalAddress ||
                address.isMulticastAddress
            ) return false
            val bytes = address.address.map(Byte::toInt).map { it and 0xff }
            return when (address) {
                is Inet4Address -> {
                    val first = bytes[0]
                    val second = bytes[1]
                    !(
                        first == 0 ||
                            first == 10 ||
                            first == 127 ||
                            first >= 224 ||
                            (first == 100 && second in 64..127) ||
                            (first == 169 && second == 254) ||
                            (first == 172 && second in 16..31) ||
                            (first == 192 && second == 0) ||
                            (first == 192 && second == 168) ||
                            (first == 192 && second == 88 && bytes[2] == 99) ||
                            (first == 192 && second == 0 && bytes[2] == 2) ||
                            (first == 198 && second in 18..19) ||
                            (first == 198 && second == 51 && bytes[2] == 100) ||
                            (first == 203 && second == 0 && bytes[2] == 113)
                        )
                }
                is Inet6Address -> {
                    val first = bytes[0]
                    val second = bytes[1]
                    val ipv4Mapped = bytes.take(10).all { it == 0 } &&
                        bytes[10] == 0xff && bytes[11] == 0xff
                    if (ipv4Mapped) {
                        isPublicUnicast(InetAddress.getByAddress(address.address.copyOfRange(12, 16)))
                    } else {
                        !(
                            first == 0xff ||
                                first and 0xfe == 0xfc ||
                                (first == 0xfe && second and 0xc0 == 0x80) ||
                                (first == 0xfe && second and 0xc0 == 0xc0) ||
                                (first == 0x20 && second == 0x01 &&
                                    bytes[2] == 0x0d && bytes[3] == 0xb8)
                            )
                    }
                }
                else -> false
            }
        }

        fun normalizedPort(scheme: String?, port: Int): Int? =
            when {
                port != -1 -> port
                scheme.equals("http", ignoreCase = true) -> 80
                scheme.equals("https", ignoreCase = true) -> 443
                else -> null
            }
    }
}

/** Bounded, redirect-explicit transport whose DNS answers are connection-bound by OkHttp. */
class SharedContentMediaHttpTransport(
    private val policy: SharedContentMediaUrlPolicy,
    dns: Dns = Dns.SYSTEM,
    private val maximumRedirects: Int = 3,
    private val maximumBytes: Int = 8 * 1024 * 1024,
) {
    private val client = OkHttpClient.Builder()
        .dns(policy.validatingDns(dns))
        .followRedirects(false)
        .followSslRedirects(false)
        .retryOnConnectionFailure(false)
        .build()

    suspend fun read(rawUrl: String?, kind: SharedContentMediaUrlKind): ByteArray? =
        withContext(Dispatchers.IO) {
            var current = policy.validatedUrl(rawUrl, kind) ?: return@withContext null
            repeat(maximumRedirects + 1) { redirectCount ->
                val response = runCatching {
                    client.newCall(Request.Builder().url(current).get().build()).execute()
                }.getOrNull() ?: return@withContext null
                response.use {
                    if (it.code in 300..399) {
                        if (redirectCount == maximumRedirects) return@withContext null
                        val location = it.header("Location") ?: return@withContext null
                        val next = runCatching { URL(current, location) }.getOrNull()
                            ?: return@withContext null
                        if (!policy.allowsRedirect(current, next, kind)) return@withContext null
                        current = policy.validatedUrl(next.toExternalForm(), kind)
                            ?: return@withContext null
                    } else {
                        if (!it.isSuccessful) return@withContext null
                        val body = it.body
                        if (body.contentLength() > maximumBytes) return@withContext null
                        val bytes = body.byteStream().use { input ->
                            input.readBounded(maximumBytes)
                        } ?: return@withContext null
                        return@withContext bytes
                    }
                }
            }
            null
        }
}

private fun java.io.InputStream.readBounded(maximumBytes: Int): ByteArray? {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(16 * 1024)
    var total = 0
    while (true) {
        val count = read(buffer)
        if (count < 0) break
        total += count
        if (total > maximumBytes) return null
        output.write(buffer, 0, count)
    }
    return output.toByteArray()
}
