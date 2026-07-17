package space.fishhub.android

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import space.fishhub.android.data.presence.PresenceRepository

class PresenceLifecycleObserver(
    private val repository: PresenceRepository,
) : DefaultLifecycleObserver {
    override fun onStart(owner: LifecycleOwner) {
        repository.setAppForegrounded(true)
    }

    override fun onStop(owner: LifecycleOwner) {
        repository.setAppForegrounded(false)
    }
}
