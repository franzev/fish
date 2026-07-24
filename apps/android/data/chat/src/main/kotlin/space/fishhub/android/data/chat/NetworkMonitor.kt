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
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** The network facts that shared-content fetching is allowed to observe. */
data class ChatNetworkPolicy(
    val usable: Boolean,
    val metered: Boolean,
    val dataSaverEnabled: Boolean,
    val lookaheadAllowed: Boolean = usable && !dataSaverEnabled,
) {
    init {
        require(!lookaheadAllowed || (usable && !dataSaverEnabled)) {
            "Lookahead requires usable, unconstrained network access."
        }
    }
}

internal interface NetworkMonitor {
    fun isOnline(): StateFlow<Boolean>
    fun networkPolicy(): StateFlow<ChatNetworkPolicy>
}

internal object AlwaysOnlineNetworkMonitor : NetworkMonitor {
    private val policy = MutableStateFlow(
        ChatNetworkPolicy(
            usable = true,
            metered = false,
            dataSaverEnabled = false,
        ),
    )
    private val online = MutableStateFlow(true)

    override fun isOnline(): StateFlow<Boolean> = online
    override fun networkPolicy(): StateFlow<ChatNetworkPolicy> = policy
}

internal class AndroidNetworkMonitor(
    context: Context,
    scope: CoroutineScope,
) : NetworkMonitor {
    private val connectivityManager = context.getSystemService(ConnectivityManager::class.java)
    private val policy = callbackFlow {
        fun publishCurrent() {
            trySend(connectivityManager.currentNetworkPolicy())
        }

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = publishCurrent()
            override fun onLost(network: Network) = publishCurrent()
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) =
                publishCurrent()
            override fun onBlockedStatusChanged(network: Network, blocked: Boolean) =
                publishCurrent()
        }
        publishCurrent()
        connectivityManager.registerDefaultNetworkCallback(callback)
        awaitClose { connectivityManager.unregisterNetworkCallback(callback) }
    }.stateIn(
        scope,
        kotlinx.coroutines.flow.SharingStarted.Eagerly,
        connectivityManager.currentNetworkPolicy(),
    )

    private val online = policy.map { it.usable }.stateIn(
        scope,
        kotlinx.coroutines.flow.SharingStarted.Eagerly,
        policy.value.usable,
    )

    override fun isOnline(): StateFlow<Boolean> = online
    override fun networkPolicy(): StateFlow<ChatNetworkPolicy> = policy
}

private fun ConnectivityManager.currentNetworkPolicy(): ChatNetworkPolicy {
    val capabilities = getNetworkCapabilities(activeNetwork)
    val dataSaverEnabled = getRestrictBackgroundStatus() ==
        ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED
    if (capabilities == null) {
        return ChatNetworkPolicy(
            usable = false,
            metered = false,
            dataSaverEnabled = dataSaverEnabled,
        )
    }
    val usable = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    return ChatNetworkPolicy(
        usable = usable,
        metered = !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED),
        dataSaverEnabled = dataSaverEnabled,
    )
}
