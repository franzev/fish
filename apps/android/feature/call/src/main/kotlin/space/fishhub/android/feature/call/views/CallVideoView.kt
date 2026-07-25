package space.fishhub.android.feature.call.views

import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import space.fishhub.android.data.call.CallMediaEngine
import space.fishhub.android.data.call.CallVideoSource

@Composable
internal fun CallVideoView(
    mediaEngine: CallMediaEngine,
    source: CallVideoSource,
    modifier: Modifier,
) {
    AndroidView(
        factory = { mediaEngine.createVideoView(it, source) },
        modifier = modifier,
        onRelease = { view: View -> mediaEngine.releaseVideoView(view) },
    )
}
