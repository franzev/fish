package space.fishhub.android.data.chat.sharedcontent

import java.net.InetAddress
import java.net.UnknownHostException
import java.net.URL
import okhttp3.Dns
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class SharedContentMediaUrlPolicyTest {
    private val production = SharedContentMediaUrlPolicy(
        configuredSupabaseUrl = "https://project.supabase.co",
    )

    @Test
    fun productionAllowsOnlyConfiguredStorageAndApprovedGifCdns() {
        assertNotNull(
            production.validatedUrl(
                "https://project.supabase.co/storage/v1/object",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNotNull(
            production.validatedUrl(
                "https://project.storage.supabase.co/object",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNotNull(
            production.validatedUrl(
                "https://static.klipy.com/poster.webp",
                SharedContentMediaUrlKind.Gif,
            ),
        )
        assertNotNull(
            production.validatedUrl(
                "https://media4.giphy.com/poster.webp",
                SharedContentMediaUrlKind.Gif,
            ),
        )
        assertNull(
            production.validatedUrl(
                "https://unapproved.example/poster.webp",
                SharedContentMediaUrlKind.Gif,
            ),
        )
    }

    @Test
    fun productionRejectsPlaintextIpPrivateAndLocalDestinations() {
        assertNull(
            production.validatedUrl(
                "http://project.supabase.co/storage/v1/object",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNull(
            SharedContentMediaUrlPolicy("https://10.0.0.8").validatedUrl(
                "https://10.0.0.8/private",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNull(
            SharedContentMediaUrlPolicy("https://media.internal").validatedUrl(
                "https://media.internal/private",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNull(
            SharedContentMediaUrlPolicy("https://localhost").validatedUrl(
                "https://localhost/private",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNull(
            SharedContentMediaUrlPolicy("https://foo.localhost").validatedUrl(
                "https://foo.localhost/private",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNull(
            SharedContentMediaUrlPolicy("https://127.0.0.1.").validatedUrl(
                "https://127.0.0.1./private",
                SharedContentMediaUrlKind.Storage,
            ),
        )
    }

    @Test
    fun redirectsMustRemainOnTheAlreadyApprovedHost() {
        val source = URL("https://project.supabase.co/start")
        assertTrue(
            production.allowsRedirect(
                source,
                URL("https://project.supabase.co/next"),
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertFalse(
            production.allowsRedirect(
                source,
                URL("https://project.storage.supabase.co/next"),
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertFalse(
            production.allowsRedirect(
                source,
                URL("https://static.klipy.com/next"),
                SharedContentMediaUrlKind.Storage,
            ),
        )
    }

    @Test
    fun localHttpRequiresExplicitDevelopmentConfigurationAndExactHost() {
        val raw = "http://127.0.0.1:54321/storage/v1/object"
        val denied = SharedContentMediaUrlPolicy(
            configuredSupabaseUrl = "http://127.0.0.1:54321",
        )
        val allowed = SharedContentMediaUrlPolicy(
            configuredSupabaseUrl = "http://127.0.0.1:54321",
            allowsLocalDevelopment = true,
        )

        assertNull(denied.validatedUrl(raw, SharedContentMediaUrlKind.Storage))
        assertNotNull(allowed.validatedUrl(raw, SharedContentMediaUrlKind.Storage))
        assertNull(allowed.validatedUrl(raw, SharedContentMediaUrlKind.Gif))
        assertNull(
            allowed.validatedUrl(
                "http://localhost:54321/storage/v1/object",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNull(
            allowed.validatedUrl(
                "http://127.0.0.1:54322/storage/v1/object",
                SharedContentMediaUrlKind.Storage,
            ),
        )
        assertNull(
            allowed.validatedUrl(
                "https://127.0.0.1:54321/storage/v1/object",
                SharedContentMediaUrlKind.Storage,
            ),
        )
    }

    @Test
    fun dnsValidationRejectsPrivateIpv4Ipv6AndMixedAnswers() {
        val url = production.validatedUrl(
            "https://project.supabase.co/storage/v1/object",
            SharedContentMediaUrlKind.Storage,
        )
        assertNotNull(url)
        listOf(
            listOf("10.0.0.8"),
            listOf("fd00::8"),
            listOf("93.184.216.34", "192.168.1.8"),
            listOf("2606:4700:4700::1111", "fe80::1"),
        ).forEach { answers ->
            val dns = production.validatingDns(
                Dns { answers.map(InetAddress::getByName) },
            )
            assertThrows(UnknownHostException::class.java) {
                dns.lookup(url!!.host)
            }
        }
    }

    @Test
    fun everyRedirectLookupIsBoundToItsValidatedAnswerSet() {
        var lookup = 0
        val dns = production.validatingDns(
            Dns {
                lookup += 1
                listOf(
                    InetAddress.getByName(
                        if (lookup == 1) "93.184.216.34" else "127.0.0.1",
                    ),
                )
            },
        )

        assertEquals(
            "93.184.216.34",
            dns.lookup("project.supabase.co").single().hostAddress,
        )
        assertThrows(UnknownHostException::class.java) {
            dns.lookup("project.supabase.co")
        }
    }

    @Test
    fun publicStorageAndGifAnswersRemainEligible() {
        val publicDns = Dns {
            listOf(
                InetAddress.getByName("93.184.216.34"),
                InetAddress.getByName("2606:4700:4700::1111"),
            )
        }
        assertEquals(2, production.validatingDns(publicDns).lookup("project.supabase.co").size)
        assertNotNull(
            production.validatedUrl(
                "https://STATIC.KLIPY.COM./poster.webp",
                SharedContentMediaUrlKind.Gif,
            ),
        )
    }
}
