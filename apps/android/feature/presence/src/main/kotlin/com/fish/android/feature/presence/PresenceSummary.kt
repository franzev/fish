package com.fish.android.feature.presence

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import com.fish.android.core.designsystem.FishTheme

@Composable
fun PresenceSummary(
    presence: PresencePresentation,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.clearAndSetSemantics {
            contentDescription = listOfNotNull(presence.label, presence.detail).joinToString(", ")
        },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PresenceIndicator(
            status = presence.status,
            label = presence.label,
            decorative = true,
            modifier = Modifier.size(FishTheme.sizes.presenceIndicatorSmall),
        )
        Spacer(Modifier.width(FishTheme.spacing.sm))
        Column {
            Text(
                text = presence.label,
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.ui,
            )
            presence.detail?.let { detail ->
                Text(
                    text = detail,
                    color = FishTheme.colors.muted,
                    style = FishTheme.typography.caption,
                )
            }
        }
    }
}
