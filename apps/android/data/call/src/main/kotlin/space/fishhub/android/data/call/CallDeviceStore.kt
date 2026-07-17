package space.fishhub.android.data.call

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

private val Context.callDataStore by preferencesDataStore(name = "fish-call-device")

class CallDeviceStore internal constructor(context: Context) : CallDevicePreferences {
    private val store = context.applicationContext.callDataStore

    override val videoQualityPreference: Flow<VideoQualityPreference> = store.data.map { values ->
        if (values[QualityKey] == "data-saver") {
            VideoQualityPreference.DataSaver
        } else {
            VideoQualityPreference.Auto
        }
    }

    override val pushRegistrationId: Flow<String?> = store.data.map { it[PushRegistrationIdKey] }

    override suspend fun installationId(): String {
        var result: String? = null
        store.edit { values ->
            result = values[InstallationIdKey] ?: UUID.randomUUID().toString().also {
                values[InstallationIdKey] = it
            }
        }
        return checkNotNull(result)
    }

    override suspend fun setVideoQualityPreference(preference: VideoQualityPreference) {
        store.edit { values ->
            values[QualityKey] = if (preference == VideoQualityPreference.DataSaver) {
                "data-saver"
            } else {
                "auto"
            }
        }
    }

    override suspend fun setPushRegistrationId(registrationId: String?) {
        store.edit { values ->
            if (registrationId == null) values.remove(PushRegistrationIdKey)
            else values[PushRegistrationIdKey] = registrationId
        }
    }

    private companion object {
        val InstallationIdKey = stringPreferencesKey("installation-id")
        val QualityKey = stringPreferencesKey("video-quality")
        val PushRegistrationIdKey = stringPreferencesKey("push-registration-id")
    }
}
