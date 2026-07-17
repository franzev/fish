package space.fishhub.android.data.chat

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.stateIn

internal fun interface NetworkMonitor {
    fun isOnline(): StateFlow<Boolean>
}

internal object AlwaysOnlineNetworkMonitor : NetworkMonitor {
    private val state = MutableStateFlow(true)
    override fun isOnline(): StateFlow<Boolean> = state
}

internal class AndroidNetworkMonitor(
    context: Context,
    scope: CoroutineScope,
) : NetworkMonitor {
    private val connectivityManager = context.getSystemService(ConnectivityManager::class.java)
    private val state = callbackFlow {
        fun publishCurrent() {
            trySend(connectivityManager.hasUsableNetwork())
        }

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = publishCurrent()
            override fun onLost(network: Network) = publishCurrent()
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) =
                publishCurrent()
        }
        publishCurrent()
        connectivityManager.registerDefaultNetworkCallback(callback)
        awaitClose { connectivityManager.unregisterNetworkCallback(callback) }
    }.stateIn(
        scope,
        kotlinx.coroutines.flow.SharingStarted.Eagerly,
        connectivityManager.hasUsableNetwork(),
    )

    override fun isOnline(): StateFlow<Boolean> = state
}

private fun ConnectivityManager.hasUsableNetwork(): Boolean {
    val capabilities = getNetworkCapabilities(activeNetwork) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}
