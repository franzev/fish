package com.fish.android.core.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import com.fish.android.core.designsystem.FishIcons
import com.fish.android.core.designsystem.FishTheme

@Composable
fun FishTopBar(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    showBack: Boolean = false,
    onBack: () -> Unit = {},
    avatarName: String? = null,
    leadingAvatar: @Composable (() -> Unit)? = null,
    trailingContent: @Composable (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(FishTheme.colors.surface),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(FishTheme.sizes.chatHeader)
                .padding(horizontal = FishTheme.spacing.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (showBack) {
                FishIconButton(
                    icon = FishIcons.ArrowBack,
                    contentDescription = "Back",
                    onClick = onBack,
                )
            } else {
                Spacer(Modifier.width(FishTheme.spacing.sm))
            }
            if (leadingAvatar != null || avatarName != null) {
                if (leadingAvatar != null) {
                    leadingAvatar()
                } else if (avatarName != null) {
                    FishAvatar(name = avatarName, size = FishTheme.sizes.avatarSmall)
                }
                Spacer(Modifier.width(FishTheme.spacing.sm))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = FishTheme.colors.foreground,
                    style = FishTheme.typography.label,
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = FishTheme.colors.muted,
                        style = FishTheme.typography.caption,
                    )
                }
            }
            trailingContent?.invoke()
        }
        HorizontalDivider(color = FishTheme.colors.divider)
    }
}
