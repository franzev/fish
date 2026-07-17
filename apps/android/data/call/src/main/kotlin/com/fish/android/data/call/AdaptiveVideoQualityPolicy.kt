package com.fish.android.data.call

internal class AdaptiveVideoQualityPolicy(
    private val supportsHighQuality: Boolean,
) {
    private var preference = VideoQualityPreference.Auto
    private var current = CallVideoQualityTier.Standard
    private var poorSince: Long? = null
    private var healthySince: Long? = null
    private var lastDowngradeAt: Long? = null

    fun setPreference(value: VideoQualityPreference, nowMs: Long): CallVideoQualityTier {
        preference = value
        if (value == VideoQualityPreference.DataSaver) {
            current = CallVideoQualityTier.DataSaver
            poorSince = null
            healthySince = null
            lastDowngradeAt = nowMs
        } else {
            current = CallVideoQualityTier.Standard
            healthySince = nowMs
        }
        return current
    }

    fun update(
        connectionQuality: Int,
        thermallyConstrained: Boolean,
        nowMs: Long,
    ): CallVideoQualityTier {
        if (preference == VideoQualityPreference.DataSaver) {
            current = CallVideoQualityTier.DataSaver
            return current
        }
        if (thermallyConstrained || connectionQuality <= 0) {
            current = CallVideoQualityTier.Low
            lastDowngradeAt = nowMs
            poorSince = nowMs
            healthySince = null
            return current
        }
        if (connectionQuality == 1) {
            healthySince = null
            val since = poorSince ?: nowMs.also { poorSince = it }
            if (nowMs - since >= PoorQualityHoldMs) {
                current = CallVideoQualityTier.Low
                lastDowngradeAt = nowMs
            }
            return current
        }

        poorSince = null
        val since = healthySince ?: nowMs.also { healthySince = it }
        val recoveryReady = lastDowngradeAt?.let { nowMs - it >= RecoveryHoldMs } ?: true
        if (current == CallVideoQualityTier.Low && recoveryReady) {
            current = CallVideoQualityTier.Standard
            healthySince = nowMs
            return current
        }
        if (nowMs - since >= HealthyQualityHoldMs && recoveryReady) {
            current = if (supportsHighQuality) {
                CallVideoQualityTier.High
            } else {
                CallVideoQualityTier.Standard
            }
        }
        return current
    }

    private companion object {
        const val PoorQualityHoldMs = 5_000L
        const val HealthyQualityHoldMs = 10_000L
        const val RecoveryHoldMs = 30_000L
    }
}
