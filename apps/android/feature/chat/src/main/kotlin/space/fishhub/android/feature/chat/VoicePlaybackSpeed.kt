package space.fishhub.android.feature.chat

import android.content.Context

internal enum class VoicePlaybackSpeed(val multiplier: Float, val label: String) {
    Slow(0.75f, "0.75×"),
    Normal(1.0f, "1×"),
    Fast(1.5f, "1.5×"),
    VeryFast(2.0f, "2×");

    val accessibilityLabel: String
        get() = when (this) {
            Slow -> "0.75 times speed"
            Normal -> "Normal speed"
            Fast -> "1.5 times speed"
            VeryFast -> "2 times speed"
        }

    companion object {
        private const val PreferencesName = "fish-voice-preferences"
        private const val SpeedKey = "playback_speed"

        fun persisted(context: Context): VoicePlaybackSpeed {
            val stored = context.applicationContext
                .getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
                .getFloat(SpeedKey, Normal.multiplier)
            return entries.minByOrNull { kotlin.math.abs(it.multiplier - stored) } ?: Normal
        }

        fun persist(context: Context, speed: VoicePlaybackSpeed) {
            context.applicationContext
                .getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
                .edit()
                .putFloat(SpeedKey, speed.multiplier)
                .apply()
        }
    }
}
