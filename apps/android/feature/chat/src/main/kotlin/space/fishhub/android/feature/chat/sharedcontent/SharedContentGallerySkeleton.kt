package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishSkeleton
import space.fishhub.android.feature.chat.R

@Composable
fun SharedContentGallerySkeleton(
    category: SharedContentGalleryCategory?,
    modifier: Modifier = Modifier,
) {
    val loadingLabel = stringResource(R.string.shared_content_loading)
    val skeletonModifier = Modifier.clearAndSetSemantics { }
    Column(
        modifier = modifier
            .fillMaxSize()
            .semantics {
                contentDescription = loadingLabel
                liveRegion = LiveRegionMode.Polite
            }
            .padding(FishTheme.spacing.page),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
    ) {
        if (category == SharedContentGalleryCategory.Media) {
            val fontScale = LocalDensity.current.fontScale
            val minimumCell = if (fontScale >= AccessibilityFontScale) {
                FishTheme.sizes.sharedContentAccessibleMediaCell
            } else {
                FishTheme.sizes.sharedContentMediaCell
            }
            BoxWithConstraints(modifier = skeletonModifier.fillMaxWidth()) {
                val gap = FishTheme.spacing.twoXs
                val columns = remember(maxWidth, minimumCell, gap) {
                    ((maxWidth + gap) / (minimumCell + gap))
                        .toInt()
                        .coerceIn(1, MaximumMediaColumns)
                }
                val cellWidth = (maxWidth - (gap * (columns - 1))) / columns
                Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                    repeat(MediaSkeletonRows) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(gap),
                        ) {
                            repeat(columns) {
                                Box(
                                    modifier = Modifier
                                        .width(cellWidth)
                                        .height(cellWidth)
                                        .background(
                                            FishTheme.colors.surfaceAlt,
                                            RoundedCornerShape(FishTheme.radii.chatInner),
                                        ),
                                )
                            }
                        }
                    }
                }
            }
        } else {
            repeat(ListSkeletonRows) {
                Row(
                    modifier = skeletonModifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    FishSkeleton(
                        modifier = Modifier.size(FishTheme.sizes.touchTarget),
                        width = FishTheme.sizes.touchTarget,
                    )
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
                    ) {
                        FishSkeleton()
                        FishSkeleton(Modifier.fillMaxWidth(CompactSkeletonFraction))
                    }
                }
            }
        }
    }
}

private const val MediaSkeletonRows = 3

private const val ListSkeletonRows = 6

private const val CompactSkeletonFraction = 0.64f
