package space.fishhub.app.feature.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthValidationTest {
    @Test
    fun accountCreationRequiresMatchingPasswords() {
        assertTrue(canCreateAccountWithPassword("password123", "password123"))
        assertFalse(canCreateAccountWithPassword("password123", "password456"))
        assertFalse(canCreateAccountWithPassword("", ""))
    }

    @Test
    fun confirmPasswordErrorIsOnlyShownAfterAConfirmValueExists() {
        assertNull(confirmPasswordError("password123", ""))
        assertNull(confirmPasswordError("password123", "password123"))
        assertEquals(
            PasswordMismatchCopy,
            confirmPasswordError("password123", "password456"),
        )
    }

    @Test
    fun googleAuthLabelsStayCalmAndExplicit() {
        assertEquals("Continue with Google", GoogleSignInLabel)
        assertEquals("Sign up with Google", GoogleSignUpLabel)
    }
}
