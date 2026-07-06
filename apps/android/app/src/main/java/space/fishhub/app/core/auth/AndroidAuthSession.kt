package space.fishhub.app.core.auth

import android.content.Context
import androidx.core.content.edit

private const val AuthPrefs = "fish_auth"
private const val AccessTokenKey = "access_token"
private const val RefreshTokenKey = "refresh_token"

internal class AndroidAuthSession(context: Context) {
    private val prefs = context.getSharedPreferences(AuthPrefs, Context.MODE_PRIVATE)

    fun save(result: OAuthCallbackResult.Success) {
        prefs.edit {
            putString(AccessTokenKey, result.accessToken)
                .putString(RefreshTokenKey, result.refreshToken)
        }
    }

    fun hasSession(): Boolean {
        return !prefs.getString(AccessTokenKey, null).isNullOrBlank()
    }

    fun clear() {
        prefs.edit { clear() }
    }
}
