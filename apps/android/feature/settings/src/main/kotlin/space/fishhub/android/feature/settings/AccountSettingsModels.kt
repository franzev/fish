package space.fishhub.android.feature.settings

import androidx.compose.runtime.Immutable

@Immutable
enum class AccountSettingsPresenceStatus { Online, Idle, Away, Busy, Invisible, Offline }

@Immutable
enum class AccountSettingsPresenceVisibility { Automatic, Away, Busy, Invisible }

@Immutable
enum class AccountSettingsPresenceDuration {
    FifteenMinutes,
    OneHour,
    EightHours,
    OneDay,
    ThreeDays,
    Forever,
}

@Immutable
data class AccountSettingsPresence(
    val status: AccountSettingsPresenceStatus = AccountSettingsPresenceStatus.Offline,
    val label: String = "Offline",
    val visibility: AccountSettingsPresenceVisibility = AccountSettingsPresenceVisibility.Automatic,
    val updating: Boolean = false,
    val reconnecting: Boolean = false,
    val notice: String? = null,
)

@Immutable
enum class AccountSettingsNotificationStatus { On, Off }

@Immutable
enum class AccountSettingsTheme { System, Light, Dark }

@Immutable
enum class AccountSettingsMotion { System, ReduceMotion }

@Immutable
data class AccountSettingsBlockedPerson(
    val userId: String,
    val displayName: String,
    val username: String?,
)

@Immutable
sealed interface AccountSettingsBlockedPeopleState {
    data object Hidden : AccountSettingsBlockedPeopleState
    data object Loading : AccountSettingsBlockedPeopleState
    data class Loaded(
        val people: List<AccountSettingsBlockedPerson>,
        val busyIds: Set<String> = emptySet(),
        val notice: String? = null,
    ) : AccountSettingsBlockedPeopleState
    data class Failed(val message: String) : AccountSettingsBlockedPeopleState
}
