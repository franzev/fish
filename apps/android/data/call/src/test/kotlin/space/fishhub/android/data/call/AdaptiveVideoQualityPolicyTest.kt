package space.fishhub.android.data.call

import org.junit.Assert.assertEquals
import org.junit.Test

class AdaptiveVideoQualityPolicyTest {
    @Test
    fun `promotes capable devices only after stable healthy conditions`() {
        val policy = AdaptiveVideoQualityPolicy(supportsHighQuality = true)
        assertEquals(CallVideoQualityTier.Standard, policy.update(3, false, 0))
        assertEquals(CallVideoQualityTier.Standard, policy.update(3, false, 9_999))
        assertEquals(CallVideoQualityTier.High, policy.update(3, false, 10_000))
    }

    @Test
    fun `downgrades sustained poor quality and recovers with hysteresis`() {
        val policy = AdaptiveVideoQualityPolicy(supportsHighQuality = true)
        assertEquals(CallVideoQualityTier.Standard, policy.update(1, false, 0))
        assertEquals(CallVideoQualityTier.Low, policy.update(1, false, 5_000))
        assertEquals(CallVideoQualityTier.Low, policy.update(3, false, 20_000))
        assertEquals(CallVideoQualityTier.Standard, policy.update(3, false, 35_000))
    }

    @Test
    fun `data saver remains capped regardless of network quality`() {
        val policy = AdaptiveVideoQualityPolicy(supportsHighQuality = true)
        assertEquals(
            CallVideoQualityTier.DataSaver,
            policy.setPreference(VideoQualityPreference.DataSaver, 0),
        )
        assertEquals(CallVideoQualityTier.DataSaver, policy.update(3, false, 60_000))
    }
}
