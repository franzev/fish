package space.fishhub.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ExternalWebLinkPolicyTest {
    @Test
    fun `builds allowed paths without carrying base query or user data`() {
        val uri = ExternalWebLinkPolicy.build(
            baseUrl = "https://fishhub.space/",
            path = "/forgot-password",
            isRelease = true,
        )

        assertEquals("https://fishhub.space/forgot-password", uri)
    }

    @Test
    fun `rejects unsafe release origins`() {
        assertNull(ExternalWebLinkPolicy.build("http://fishhub.space", "/privacy", true))
        assertNull(ExternalWebLinkPolicy.build("javascript:alert(1)", "/privacy", false))
        assertNull(ExternalWebLinkPolicy.build("https://user:pass@fishhub.space", "/privacy", true))
        assertNull(ExternalWebLinkPolicy.build("https://fishhub.space?next=evil", "/privacy", true))
        assertNull(ExternalWebLinkPolicy.build("https://fishhub.space", "/other", true))
    }

    @Test
    fun `allows configured local http origin only outside release`() {
        assertEquals(
            "http://10.0.2.2:3000/forgot-password",
            ExternalWebLinkPolicy.build(
                "http://10.0.2.2:3000",
                "/forgot-password",
                isRelease = false,
            ),
        )
    }
}
