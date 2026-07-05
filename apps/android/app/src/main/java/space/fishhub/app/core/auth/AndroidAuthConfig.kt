package space.fishhub.app.core.auth

internal data class AndroidAuthConfig(
    val supabaseUrl: String,
    val publishableKey: String,
    val redirectUrl: String,
)
