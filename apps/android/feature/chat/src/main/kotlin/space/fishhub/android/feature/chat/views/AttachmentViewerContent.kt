package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
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
    images: List<AttachmentUiModel>,
    initialIndex: Int,
    onDismiss: () -> Unit,
    onLoadError: (String) -> Unit,
) {
    if (images.isEmpty()) return
    val pagerState = rememberPagerState(
        initialPage = initialIndex.coerceIn(0, images.lastIndex),
        pageCount = { images.size },
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
            key = { images[it].id },
        ) { page ->
            AttachmentViewerPage(attachment = images[page], onLoadError = onLoadError)
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
        // Position is spoken, not implied by dots, so it survives a screen reader.
        if (images.size > 1) {
            Text(
                text = stringResource(
                    R.string.photo_viewer_position,
                    pagerState.currentPage + 1,
                    images.size,
                ),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(FishTheme.spacing.md),
                color = FishTheme.colors.body,
                style = FishTheme.typography.caption,
            )
        }
    }
}

@Composable
private fun AttachmentViewerPage(
    attachment: AttachmentUiModel,
    onLoadError: (String) -> Unit,
) {
    var scale by remember(attachment.id) { mutableFloatStateOf(1f) }
    val viewerDescription = stringResource(R.string.photo_viewer_accessibility, attachment.name)
    val unavailableDescription = stringResource(
        R.string.photo_viewer_unavailable_accessibility,
        attachment.name,
    )
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
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
    }
}

private const val MaxViewerScale = 4f
