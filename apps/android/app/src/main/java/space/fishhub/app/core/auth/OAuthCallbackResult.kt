package space.fishhub.app.core.auth

internal sealed interface OAuthCallbackResult {
    data class Success(
        val accessToken: String,
        val refreshToken: String?,
    ) : OAuthCallbackResult

    data class Failure(val message: String) : OAuthCallbackResult
}
