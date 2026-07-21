package space.fishhub.android.messaging

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Parcelable

/** Content received when another Android app shares into FISH. */
internal data class ChatShareContent(
    val text: String? = null,
    val mimeType: String? = null,
    val uris: List<Uri> = emptyList(),
) {
    val isEmpty: Boolean
        get() = text.isNullOrBlank() && uris.isEmpty()
}

internal object ChatShareIntents {
    fun content(intent: Intent?): ChatShareContent? {
        intent ?: return null
        if (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_SEND_MULTIPLE) {
            return null
        }
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)
            ?.toString()
            ?.takeIf(String::isNotBlank)
        val uris = buildList {
            if (intent.action == Intent.ACTION_SEND) {
                intent.getParcelableExtraCompat<Uri>(Intent.EXTRA_STREAM)?.let(::add)
            } else {
                intent.getParcelableArrayListExtraCompat<Uri>(Intent.EXTRA_STREAM)
                    .orEmpty()
                    .forEach(::add)
            }
            if (isEmpty()) {
                intent.clipData?.uris().orEmpty().forEach(::add)
            }
        }.distinct()

        return parse(
            action = intent.action,
            mimeType = intent.type,
            text = text,
            uris = uris,
        )
    }

    internal fun parse(
        action: String?,
        mimeType: String?,
        text: String?,
        uris: List<Uri> = emptyList(),
    ): ChatShareContent? {
        if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return null
        return ChatShareContent(
            text = text?.takeIf(String::isNotBlank),
            mimeType = mimeType?.takeIf(String::isNotBlank),
            uris = uris.distinct(),
        ).takeUnless(ChatShareContent::isEmpty)
    }
}

private fun ClipData.uris(): List<Uri> = buildList {
    for (index in 0 until itemCount) {
        getItemAt(index).uri?.let(::add)
    }
}

@Suppress("DEPRECATION")
private inline fun <reified T : Parcelable> Intent.getParcelableExtraCompat(key: String): T? =
    if (android.os.Build.VERSION.SDK_INT >= 33) {
        getParcelableExtra(key, T::class.java)
    } else {
        getParcelableExtra(key)
    }

@Suppress("DEPRECATION")
private inline fun <reified T : Parcelable> Intent.getParcelableArrayListExtraCompat(key: String): ArrayList<T>? =
    if (android.os.Build.VERSION.SDK_INT >= 33) {
        getParcelableArrayListExtra(key, T::class.java)
    } else {
        getParcelableArrayListExtra(key)
    }
