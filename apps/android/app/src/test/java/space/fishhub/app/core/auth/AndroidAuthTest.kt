package space.fishhub.app.core.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidAuthTest {
    @Test
    fun googleOAuthUrlUsesSupabaseAuthorizeEndpoint() {
        val url = buildSupabaseGoogleOAuthUrl(
            AndroidAuthConfig(
                supabaseUrl = "https://fish.supabase.co/",
                publishableKey = "publishable-key",
                redirectUrl = "fish://auth/callback",
            )
        )

        assertEquals(
            "https://fish.supabase.co/auth/v1/authorize?provider=google&redirect_to=fish%3A%2F%2Fauth%2Fcallback",
            url,
        )
    }

    @Test
    fun googleOAuthUrlRequiresSupabaseConfig() {
        assertNull(
            buildSupabaseGoogleOAuthUrl(
                AndroidAuthConfig(
                    supabaseUrl = "",
                    publishableKey = "publishable-key",
                    redirectUrl = "fish://auth/callback",
                )
            )
        )
    }

    @Test
    fun parsesSupabaseOAuthTokenCallback() {
        val result = parseSupabaseOAuthCallback(
            "fish://auth/callback#access_token=access&refresh_token=refresh"
        )

        assertEquals(
            OAuthCallbackResult.Success(
                accessToken = "access",
                refreshToken = "refresh",
            ),
            result,
        )
    }

    @Test
    fun parsesSupabaseOAuthErrorCallback() {
        val result = parseSupabaseOAuthCallback(
            "fish://auth/callback#error_description=Google%20sign-in%20failed"
        )

        assertEquals(
            OAuthCallbackResult.Failure("Google sign-in failed"),
            result,
        )
    }

    @Test
    fun ignoresUnrelatedDeepLinks() {
        assertNull(parseSupabaseOAuthCallback("fish://auth/callback"))
        assertTrue(parseSupabaseOAuthCallback(null) == null)
    }

    @Test
    fun handlesMalformedCallbackEncoding() {
        val result = parseSupabaseOAuthCallback("fish://auth/callback#error_description=bad%")

        assertEquals(
            OAuthCallbackResult.Failure("bad%"),
            result,
        )
    }
}
