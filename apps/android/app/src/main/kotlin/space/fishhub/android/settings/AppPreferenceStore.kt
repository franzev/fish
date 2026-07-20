package space.fishhub.android.settings

import android.content.Context
import androidx.datastore.core.CorruptionException
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.appPreferencesDataStore by preferencesDataStore(name = "fish-app-preferences")

enum class AppThemePreference { System, Light, Dark }

enum class AppMotionPreference { System, ReduceMotion }

data class AppPreferences(
    val theme: AppThemePreference = AppThemePreference.System,
    val motion: AppMotionPreference = AppMotionPreference.System,
)

class AppPreferenceStore(context: Context) {
    private val dataStore = context.applicationContext.appPreferencesDataStore

    val preferences: Flow<AppPreferences> = dataStore.data
        .catch { error ->
            if (error is IOException || error is CorruptionException) {
                emit(emptyPreferences())
            } else {
                throw error
            }
        }
        .map { values ->
            AppPreferences(
                theme = parseThemePreference(values[ThemeKey]),
                motion = parseMotionPreference(values[MotionKey]),
            )
        }

    suspend fun setTheme(theme: AppThemePreference): Boolean = edit { values ->
        values[ThemeKey] = theme.name
    }

    suspend fun setMotion(motion: AppMotionPreference): Boolean = edit { values ->
        values[MotionKey] = motion.name
    }

    private suspend fun edit(
        update: (androidx.datastore.preferences.core.MutablePreferences) -> Unit,
    ): Boolean = try {
        dataStore.edit(update)
        true
    } catch (_: IOException) {
        false
    }

    private companion object {
        val ThemeKey = stringPreferencesKey("theme")
        val MotionKey = stringPreferencesKey("motion")
    }
}

internal fun parseThemePreference(value: String?): AppThemePreference = when (value) {
    AppThemePreference.Light.name -> AppThemePreference.Light
    AppThemePreference.Dark.name -> AppThemePreference.Dark
    else -> AppThemePreference.System
}

internal fun parseMotionPreference(value: String?): AppMotionPreference = when (value) {
    AppMotionPreference.ReduceMotion.name -> AppMotionPreference.ReduceMotion
    else -> AppMotionPreference.System
}

internal fun AppThemePreference.isDark(systemIsDark: Boolean): Boolean = when (this) {
    AppThemePreference.System -> systemIsDark
    AppThemePreference.Light -> false
    AppThemePreference.Dark -> true
}

internal fun effectiveReducedMotion(
    systemDisabledAnimations: Boolean,
    explicitMotion: AppMotionPreference,
): Boolean = systemDisabledAnimations || explicitMotion == AppMotionPreference.ReduceMotion
