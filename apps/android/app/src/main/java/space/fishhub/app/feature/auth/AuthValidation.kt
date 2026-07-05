package space.fishhub.app.feature.auth

internal const val GoogleSignInLabel = "Continue with Google"
internal const val GoogleSignUpLabel = "Sign up with Google"
internal const val PasswordMismatchCopy = "Passwords don't match yet."

internal fun canCreateAccountWithPassword(
    password: String,
    confirmPassword: String,
): Boolean = password.isNotEmpty() && password == confirmPassword

internal fun confirmPasswordError(
    password: String,
    confirmPassword: String,
): String? {
    return if (confirmPassword.isNotEmpty() && confirmPassword != password) {
        PasswordMismatchCopy
    } else {
        null
    }
}
