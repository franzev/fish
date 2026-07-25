package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.model.AttachmentUiModel

@Composable
internal fun AttachmentViewerContent(
    attachment: AttachmentUiModel,
    onDismiss: () -> Unit,
    onLoadError: (String) -> Unit,
) {
    var scale by remember(attachment.id) { mutableFloatStateOf(1f) }
    val viewerDescription = stringResource(R.string.photo_viewer_accessibility, attachment.name)
    val unavailableDescription = stringResource(
        R.string.photo_viewer_unavailable_accessibility,
        attachment.name,
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
        contentAlignment = Alignment.Center,
    ) {
        if (attachment.displayUrl == null) {
            Text(
                text = stringResource(R.string.photo_unavailable),
                modifier = Modifier.semantics {
                    contentDescription = unavailableDescription
                },
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
        } else {
            AttachmentPhotoImage(
                url = attachment.displayUrl,
                cacheKey = "${attachment.id}:display:${attachment.contentVersion}",
                contentDescription = viewerDescription,
                contentScale = ContentScale.Fit,
                onError = { onLoadError(attachment.id) },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(FishTheme.spacing.page)
                    .pointerInput(attachment.id) {
                        detectTransformGestures { _, _, zoom, _ ->
                            scale = (scale * zoom).coerceIn(1f, MaxViewerScale)
                        }
                    }
                    .graphicsLayer(scaleX = scale, scaleY = scale),
            )
        }
        FishIconButton(
            icon = FishIcons.Close,
            contentDescription = stringResource(R.string.close_photo_viewer),
            onClick = onDismiss,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .statusBarsPadding()
                .padding(FishTheme.spacing.sm),
            size = FishTheme.sizes.touchTarget,
        )
    }
}

private const val MaxViewerScale = 4f
