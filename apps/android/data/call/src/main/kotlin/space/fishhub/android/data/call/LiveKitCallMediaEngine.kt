package space.fishhub.android.data.call

import android.content.Context
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.MediaCodecList
import android.os.Build
import android.os.PowerManager
import android.view.View
import io.livekit.android.LiveKit
import io.livekit.android.RoomOptions
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import io.livekit.android.renderer.SurfaceViewRenderer
import io.livekit.android.room.Room
import io.livekit.android.room.participant.ConnectionQuality
import io.livekit.android.room.participant.VideoTrackPublishDefaults
import io.livekit.android.room.track.CameraPosition
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.LocalVideoTrackOptions
import io.livekit.android.room.track.RemoteTrackPublication
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.VideoCaptureParameter
import io.livekit.android.room.track.VideoQuality
import io.livekit.android.room.track.VideoTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import livekit.org.webrtc.RendererCommon
import java.util.Collections

internal class LiveKitCallMediaEngine(
    context: Context,
    private val scope: CoroutineScope,
) : CallMediaEngine {
    private val appContext = context.applicationContext
    private val mutableState = MutableStateFlow(CallMediaState())
    override val state: StateFlow<CallMediaState> = mutableState.asStateFlow()
    private val surfaces = Collections.synchronizedMap(mutableMapOf<SurfaceViewRenderer, CallVideoSource>())
    private val policy = AdaptiveVideoQualityPolicy(supportsHighQuality = supports1080p(appContext))
    private var room: Room? = null
    private var eventJob: Job? = null
    private var qualityJob: Job? = null
    private var localVideo: VideoTrack? = null
    private var remoteVideo: VideoTrack? = null
    private var qualityScore = 2
    private var thermallyConstrained = false
    private var preference = VideoQualityPreference.Auto
    private var currentTier = CallVideoQualityTier.Standard
    private var thermalListener: PowerManager.OnThermalStatusChangedListener? = null

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val power = appContext.getSystemService(PowerManager::class.java)
            val listener = PowerManager.OnThermalStatusChangedListener { status ->
                thermallyConstrained = status >= PowerManager.THERMAL_STATUS_SEVERE
                updateQuality()
            }
            thermalListener = listener
            power.addThermalStatusListener(listener)
        }
    }

    override suspend fun connect(
        callId: String,
        connection: CallConnection,
        publishMicrophone: Boolean,
        publishCamera: Boolean,
    ) {
        disconnect()
        mutableState.value = CallMediaState(connection = CallMediaConnection.Connecting)
        val createdRoom = LiveKit.create(
            appContext,
            RoomOptions(
                adaptiveStream = true,
                dynacast = true,
                videoTrackCaptureDefaults = captureOptions(CallVideoQualityTier.Standard),
                videoTrackPublishDefaults = VideoTrackPublishDefaults(simulcast = true),
            ),
        )
        room = createdRoom
        initializeSurfaces(createdRoom)
        eventJob = scope.launch { collectEvents(createdRoom) }
        createdRoom.connect(connection.serverUrl, connection.participantToken)
        if (publishMicrophone) createdRoom.localParticipant.setMicrophoneEnabled(true)
        if (publishCamera) createdRoom.localParticipant.setCameraEnabled(true)
        localVideo = createdRoom.localParticipant
            .getTrackPublication(Track.Source.CAMERA)?.track as? VideoTrack
        attachTrack(localVideo, CallVideoSource.Local)
        mutableState.value = mutableState.value.copy(
            connection = CallMediaConnection.Connected,
            cameraEnabled = publishCamera,
        )
        qualityJob = scope.launch {
            while (isActive) {
                updateQuality()
                delay(5_000)
            }
        }
    }

    override suspend fun setMuted(muted: Boolean) {
        room?.localParticipant?.setMicrophoneEnabled(!muted)
        mutableState.value = mutableState.value.copy(muted = muted, localSpeaking = false)
    }

    override suspend fun setCameraEnabled(enabled: Boolean) {
        val activeRoom = room ?: return
        activeRoom.localParticipant.setCameraEnabled(enabled)
        val track = activeRoom.localParticipant
            .getTrackPublication(Track.Source.CAMERA)?.track as? VideoTrack
        replaceTrack(CallVideoSource.Local, if (enabled) track else null)
        mutableState.value = mutableState.value.copy(cameraEnabled = enabled)
        if (enabled) applyTier(currentTier)
    }

    override suspend fun switchCamera() {
        val track = localVideo as? LocalVideoTrack ?: return
        val target = if (track.options.position == CameraPosition.FRONT) {
            CameraPosition.BACK
        } else {
            CameraPosition.FRONT
        }
        track.switchCamera(position = target)
        surfaces.filterValues { it == CallVideoSource.Local }.keys.forEach {
            it.setMirror(target == CameraPosition.FRONT)
        }
    }

    override fun setVideoQualityPreference(preference: VideoQualityPreference) {
        this.preference = preference
        val tier = policy.setPreference(preference, System.currentTimeMillis())
        applyTier(tier)
    }

    override suspend fun disconnect() {
        qualityJob?.cancelAndJoin()
        qualityJob = null
        eventJob?.cancelAndJoin()
        eventJob = null
        replaceTrack(CallVideoSource.Local, null)
        replaceTrack(CallVideoSource.Remote, null)
        room?.disconnect()
        room?.release()
        room = null
        mutableState.value = CallMediaState()
    }

    override fun createVideoView(context: Context, source: CallVideoSource): View {
        val renderer = SurfaceViewRenderer(context).apply {
            setEnableHardwareScaler(true)
            setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
            setMirror(source == CallVideoSource.Local)
            if (source == CallVideoSource.Local) setZOrderMediaOverlay(true)
        }
        surfaces[renderer] = source
        room?.let {
            it.initVideoRenderer(renderer)
            trackFor(source)?.addRenderer(renderer)
        }
        return renderer
    }

    override fun releaseVideoView(view: View) {
        val renderer = view as? SurfaceViewRenderer ?: return
        val source = surfaces.remove(renderer) ?: return
        trackFor(source)?.removeRenderer(renderer)
        renderer.release()
    }

    private suspend fun collectEvents(activeRoom: Room) {
        activeRoom.events.collect { event ->
            if (room !== activeRoom) return@collect
            when (event) {
                is RoomEvent.Connected -> mutableState.value = mutableState.value.copy(
                    connection = CallMediaConnection.Connected,
                )
                is RoomEvent.Reconnecting -> mutableState.value = mutableState.value.copy(
                    connection = CallMediaConnection.Reconnecting,
                )
                is RoomEvent.Reconnected -> mutableState.value = mutableState.value.copy(
                    connection = CallMediaConnection.Connected,
                )
                is RoomEvent.Disconnected -> mutableState.value = mutableState.value.copy(
                    connection = CallMediaConnection.Disconnected,
                )
                is RoomEvent.TrackSubscribed -> if (
                    event.publication.source == Track.Source.CAMERA && event.track is VideoTrack
                ) {
                    replaceTrack(CallVideoSource.Remote, event.track as VideoTrack)
                    applyRemoteTier(currentTier)
                    mutableState.value = mutableState.value.copy(remoteCameraEnabled = true)
                }
                is RoomEvent.TrackUnsubscribed -> if (event.track === remoteVideo) {
                    replaceTrack(CallVideoSource.Remote, null)
                    mutableState.value = mutableState.value.copy(remoteCameraEnabled = false)
                }
                is RoomEvent.TrackMuted -> when (event.publication.source) {
                    Track.Source.CAMERA -> if (event.participant !== activeRoom.localParticipant) {
                        replaceTrack(CallVideoSource.Remote, null)
                        mutableState.value = mutableState.value.copy(remoteCameraEnabled = false)
                    }
                    Track.Source.MICROPHONE -> if (event.participant !== activeRoom.localParticipant) {
                        mutableState.value = mutableState.value.copy(
                            remoteMuted = true,
                            remoteSpeaking = false,
                        )
                    }
                    else -> Unit
                }
                is RoomEvent.TrackUnmuted -> when (event.publication.source) {
                    Track.Source.CAMERA -> if (event.participant !== activeRoom.localParticipant) {
                        val track = event.publication.track as? VideoTrack
                        replaceTrack(CallVideoSource.Remote, track)
                        mutableState.value = mutableState.value.copy(remoteCameraEnabled = track != null)
                    }
                    Track.Source.MICROPHONE -> if (event.participant !== activeRoom.localParticipant) {
                        mutableState.value = mutableState.value.copy(remoteMuted = false)
                    }
                    else -> Unit
                }
                is RoomEvent.ActiveSpeakersChanged -> mutableState.value = mutableState.value.copy(
                    localSpeaking = event.speakers.any { it === activeRoom.localParticipant },
                    remoteSpeaking = event.speakers.any { it !== activeRoom.localParticipant },
                )
                is RoomEvent.ConnectionQualityChanged -> if (
                    event.participant === activeRoom.localParticipant
                ) {
                    qualityScore = when (event.quality) {
                        ConnectionQuality.EXCELLENT -> 3
                        ConnectionQuality.GOOD -> 2
                        ConnectionQuality.POOR -> 1
                        ConnectionQuality.LOST -> 0
                        ConnectionQuality.UNKNOWN -> qualityScore
                    }
                    mutableState.value = mutableState.value.copy(connectionQuality = qualityScore)
                    updateQuality()
                }
                else -> Unit
            }
        }
    }

    private fun initializeSurfaces(activeRoom: Room) {
        surfaces.keys.forEach { activeRoom.initVideoRenderer(it) }
    }

    private fun replaceTrack(source: CallVideoSource, track: VideoTrack?) {
        val old = trackFor(source)
        if (old === track) return
        surfaces.filterValues { it == source }.keys.forEach { renderer ->
            old?.removeRenderer(renderer)
            track?.addRenderer(renderer)
        }
        if (source == CallVideoSource.Local) localVideo = track else remoteVideo = track
    }

    private fun attachTrack(track: VideoTrack?, source: CallVideoSource) {
        surfaces.filterValues { it == source }.keys.forEach { track?.addRenderer(it) }
    }

    private fun trackFor(source: CallVideoSource): VideoTrack? =
        if (source == CallVideoSource.Local) localVideo else remoteVideo

    private fun updateQuality() {
        val tier = policy.update(qualityScore, thermallyConstrained, System.currentTimeMillis())
        applyTier(tier)
    }

    private fun applyTier(tier: CallVideoQualityTier) {
        if (tier == currentTier && mutableState.value.videoQualityTier == tier) return
        currentTier = tier
        (localVideo as? LocalVideoTrack)?.restartTrack(captureOptions(tier))
        applyRemoteTier(tier)
        mutableState.value = mutableState.value.copy(videoQualityTier = tier)
    }

    private fun applyRemoteTier(tier: CallVideoQualityTier) {
        val publication = room?.remoteParticipants?.values
            ?.asSequence()
            ?.mapNotNull { it.getTrackPublication(Track.Source.CAMERA) as? RemoteTrackPublication }
            ?.firstOrNull() ?: return
        if (tier == CallVideoQualityTier.DataSaver || tier == CallVideoQualityTier.Low) {
            publication.setVideoDimensions(Track.Dimensions(640, 360))
            publication.setVideoFps(15)
        } else {
            publication.setVideoQuality(VideoQuality.HIGH)
            publication.setVideoFps(30)
        }
    }

    private fun captureOptions(tier: CallVideoQualityTier): LocalVideoTrackOptions {
        val (width, height, fps) = when (tier) {
            CallVideoQualityTier.High -> Triple(1920, 1080, 30)
            CallVideoQualityTier.Standard -> Triple(1280, 720, 30)
            CallVideoQualityTier.Low -> Triple(640, 360, 20)
            CallVideoQualityTier.DataSaver -> Triple(640, 360, 15)
        }
        return LocalVideoTrackOptions(
            position = CameraPosition.FRONT,
            captureParams = VideoCaptureParameter(width, height, fps),
        )
    }
}

private fun supports1080p(context: Context): Boolean {
    val cameraCapable = runCatching {
        val manager = context.getSystemService(CameraManager::class.java)
        manager.cameraIdList.any { id ->
            val characteristics = manager.getCameraCharacteristics(id)
            characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                ?.getOutputSizes(SurfaceTexture::class.java)
                ?.any { it.width >= 1920 && it.height >= 1080 } == true
        }
    }.getOrDefault(false)
    if (!cameraCapable || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return cameraCapable
    return MediaCodecList(MediaCodecList.ALL_CODECS).codecInfos.any { codec ->
        codec.isEncoder && codec.isHardwareAccelerated && codec.supportedTypes.any {
            it.equals("video/avc", ignoreCase = true) || it.equals("video/x-vnd.on2.vp8", ignoreCase = true)
        }
    }
}
