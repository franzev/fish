package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.R

@Composable
fun SharedContentCategoryBar(
    categories: List<SharedContentGalleryCategory>,
    selectedCategory: SharedContentGalleryCategory,
    onSelect: (SharedContentGalleryCategory) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (categories.size < 2) return

    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .selectableGroup()
            .padding(horizontal = FishTheme.spacing.page),
    ) {
        categories.forEach { category ->
            val selected = category == selectedCategory
            val label = categoryLabel(category)
            Column(
                modifier = Modifier
                    .heightIn(min = FishTheme.sizes.touchTarget)
                    .selectable(
                        selected = selected,
                        role = Role.Tab,
                        onClick = { onSelect(category) },
                    )
                    .semantics {
                        this.selected = selected
                        contentDescription = label
                    }
                    .padding(horizontal = FishTheme.spacing.md),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
            ) {
                Text(
                    text = label,
                    color = if (selected) FishTheme.colors.foreground else FishTheme.colors.body,
                    style = FishTheme.typography.ui,
                )
                Box(
                    modifier = Modifier
                        .padding(top = FishTheme.spacing.twoXs)
                        .height(FishTheme.spacing.threeXs)
                        .width(FishTheme.spacing.xl)
                        .background(
                            if (selected) FishTheme.colors.foreground else {
                                androidx.compose.ui.graphics.Color.Transparent
                            },
                            RoundedCornerShape(FishTheme.radii.pill),
                        ),
                )
            }
        }
    }
}

@Composable
private fun categoryLabel(category: SharedContentGalleryCategory): String =
    stringResource(
        when (category) {
            SharedContentGalleryCategory.Media -> R.string.shared_content_media
            SharedContentGalleryCategory.Files -> R.string.shared_content_files
            SharedContentGalleryCategory.Links -> R.string.shared_content_links
            SharedContentGalleryCategory.Voice -> R.string.shared_content_voice
        },
    )
