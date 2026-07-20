package space.fishhub.android.settings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPreferenceStoreTest {
    @Test
    fun missingAndInvalidValuesResolveToSystem() {
        assertEquals(AppThemePreference.System, parseThemePreference(null))
        assertEquals(AppThemePreference.System, parseThemePreference("unexpected"))
        assertEquals(AppMotionPreference.System, parseMotionPreference(null))
        assertEquals(AppMotionPreference.System, parseMotionPreference("Reduce"))
    }

    @Test
    fun validValuesRoundTripThroughAllowlist() {
        assertEquals(AppThemePreference.Light, parseThemePreference("Light"))
        assertEquals(AppThemePreference.Dark, parseThemePreference("Dark"))
        assertEquals(AppMotionPreference.ReduceMotion, parseMotionPreference("ReduceMotion"))
    }

    @Test
    fun themeResolutionUsesSystemOnlyForSystemPreference() {
        assertTrue(AppThemePreference.System.isDark(systemIsDark = true))
        assertFalse(AppThemePreference.System.isDark(systemIsDark = false))
        assertFalse(AppThemePreference.Light.isDark(systemIsDark = true))
        assertTrue(AppThemePreference.Dark.isDark(systemIsDark = false))
    }

    @Test
    fun systemAnimationRestrictionAlwaysWins() {
        assertTrue(effectiveReducedMotion(true, AppMotionPreference.System))
        assertTrue(effectiveReducedMotion(true, AppMotionPreference.ReduceMotion))
        assertFalse(effectiveReducedMotion(false, AppMotionPreference.System))
        assertTrue(effectiveReducedMotion(false, AppMotionPreference.ReduceMotion))
    }
}
