package space.fishhub.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import space.fishhub.app.core.auth.AndroidAuthConfig
import space.fishhub.app.core.auth.AndroidAuthSession
import space.fishhub.app.core.auth.OAuthCallbackResult
import space.fishhub.app.core.auth.buildSupabaseGoogleOAuthUrl
import space.fishhub.app.core.auth.parseSupabaseOAuthCallback
import space.fishhub.app.designsystem.theme.Theme
import space.fishhub.app.feature.auth.PreviewApp

class MainActivity : ComponentActivity() {
    private lateinit var authSession: AndroidAuthSession
    private var googleAuthResult by mutableStateOf<OAuthCallbackResult?>(null)
    private var hasStoredAuthSession by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        authSession = AndroidAuthSession(this)
        hasStoredAuthSession = authSession.hasSession()
        handleAuthCallback(intent)
        enableEdgeToEdge()
        setContent {
            Theme {
                PreviewApp(
                    onGoogleSignIn = ::startGoogleSignIn,
                    onSignOut = ::signOut,
                    googleAuthResult = googleAuthResult,
                    hasStoredAuthSession = hasStoredAuthSession,
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthCallback(intent)
    }

    private fun startGoogleSignIn() {
        val url = buildSupabaseGoogleOAuthUrl(
            AndroidAuthConfig(
                supabaseUrl = BuildConfig.SUPABASE_URL,
                publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY,
                redirectUrl = BuildConfig.SUPABASE_OAUTH_REDIRECT_URL,
            )
        )

        if (url == null) {
            googleAuthResult = OAuthCallbackResult.Failure(
                "Google sign-in is not configured yet."
            )
            return
        }

        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    private fun handleAuthCallback(intent: Intent?) {
        val result = parseSupabaseOAuthCallback(intent?.dataString) ?: return
        googleAuthResult = result
        if (result is OAuthCallbackResult.Success) {
            authSession.save(result)
            hasStoredAuthSession = true
        }
    }

    private fun signOut() {
        authSession.clear()
        hasStoredAuthSession = false
        googleAuthResult = null
    }
}
