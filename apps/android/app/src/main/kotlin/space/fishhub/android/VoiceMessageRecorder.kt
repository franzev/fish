package space.fishhub.android

import android.content.Context
import android.media.MediaRecorder
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID

/** Small app-owned boundary for Android microphone access and temporary files. */
internal class VoiceMessageRecorder(
    context: Context,
) {
    private val appContext = context.applicationContext
    private val directory = File(appContext.cacheDir, "chat-voice-recordings")
    private var recorder: MediaRecorder? = null
    private var output: File? = null
    private var completedOutput: File? = null

    fun start(): Boolean {
        cancel()
        directory.mkdirs()
        val file = File(directory, "${UUID.randomUUID()}.m4a")
        val next = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            MediaRecorder(appContext)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        return runCatching {
            next.setAudioSource(MediaRecorder.AudioSource.MIC)
            next.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            next.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            next.setAudioChannels(1)
            next.setAudioSamplingRate(44_100)
            next.setAudioEncodingBitRate(64_000)
            next.setMaxFileSize(MaxVoiceBytes)
            next.setOutputFile(file.absolutePath)
            next.prepare()
            next.start()
            recorder = next
            output = file
        }.onFailure {
            next.release()
            file.delete()
        }.isSuccess
    }

    fun stop(): Uri? {
        val active = recorder ?: return null
        val file = output
        recorder = null
        output = null
        return try {
            active.stop()
            if (file == null || !file.exists() || file.length() == 0L) {
                file?.delete()
                null
            } else {
                completedOutput = file
                FileProvider.getUriForFile(
                    appContext,
                    "${appContext.packageName}.fileprovider",
                    file,
                )
            }
        } catch (_: Exception) {
            file?.delete()
            null
        } finally {
            active.release()
        }
    }

    fun cancel() {
        val active = recorder ?: run {
            output?.delete()
            output = null
            return
        }
        recorder = null
        val file = output
        output = null
        runCatching { active.reset() }
        active.release()
        file?.delete()
    }

    fun cleanupCompleted() {
        completedOutput?.delete()
        completedOutput = null
    }

    private companion object {
        const val MaxVoiceBytes = 9_500_000L
    }
}
