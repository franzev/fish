package space.fishhub.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationPermissionStateTest {
    @Test
    fun preAndroid13UsesSystemDeliveryState() {
        assertTrue(notificationDeliveryEnabled(true, false, false))
        assertFalse(notificationDeliveryEnabled(false, true, false))
    }

    @Test
    fun Android13RequiresBothRuntimePermissionAndSystemDelivery() {
        assertTrue(notificationDeliveryEnabled(true, true, true))
        assertFalse(notificationDeliveryEnabled(true, false, true))
        assertFalse(notificationDeliveryEnabled(false, true, true))
    }
}
