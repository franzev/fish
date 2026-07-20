package space.fishhub.android

internal fun notificationDeliveryEnabled(
    notificationsEnabledBySystem: Boolean,
    runtimePermissionGranted: Boolean,
    requiresRuntimePermission: Boolean,
): Boolean = notificationsEnabledBySystem &&
    (!requiresRuntimePermission || runtimePermissionGranted)
