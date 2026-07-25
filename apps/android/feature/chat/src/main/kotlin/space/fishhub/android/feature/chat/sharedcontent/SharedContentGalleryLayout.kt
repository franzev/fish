package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.runtime.getValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.focus.FocusRequester

internal const val MaximumMediaColumns = 6

internal const val AccessibilityFontScale = 1.3f

internal suspend fun FocusRequester.requestFocusWhenReady() {
    repeat(3) {
        withFrameNanos { }
        if (requestFocus()) return
    }
}

internal data class VisibleGalleryItems(
    val visible: List<String>,
    val lookahead: List<String>,
    val anchorId: String?,
    val anchorOffset: Int,
)
