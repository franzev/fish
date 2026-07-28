package space.fishhub.android

/**
 * Exponential moving average so the mic level meter doesn't flicker between
 * polls of [VoiceMessageRecorder.currentLevel]. Weighted 60% toward the
 * previous smoothed value and 40% toward the new sample.
 */
internal fun smoothLevel(previous: Float, sample: Float): Float = 0.6f * previous + 0.4f * sample
