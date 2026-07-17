package com.fish.android.feature.call

import com.fish.android.data.call.Call
import kotlinx.coroutines.flow.StateFlow

data class CallAudioEndpoint(
    val id: String,
    val label: String,
    val selected: Boolean,
)

interface CallSystemActions {
    fun answer(callId: String)
    fun reject(callId: String)
    fun end(callId: String)
    fun setMuted(muted: Boolean)
}

interface CallSystemGateway {
    val audioEndpoints: StateFlow<List<CallAudioEndpoint>>
    fun bind(actions: CallSystemActions)
    suspend fun presentIncoming(call: Call, counterpartName: String)
    suspend fun presentOutgoing(call: Call, counterpartName: String)
    suspend fun answer(callId: String, isVideo: Boolean)
    suspend fun markActive(callId: String)
    suspend fun dismiss(callId: String)
    suspend fun setMuted(muted: Boolean)
    suspend fun selectAudioEndpoint(id: String)
}
