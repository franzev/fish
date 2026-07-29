package space.fishhub.android.feature.friends.views

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import coil3.compose.rememberAsyncImagePainter
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishAvatar

/**
 * One person, said the same way everywhere friends shows them: the picture if
 * there is one, their initials if there is not, their name, their handle.
 */
@Composable
internal fun FriendIdentity(
    displayName: String,
    username: String,
    modifier: Modifier = Modifier,
    avatarUrl: String? = null,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
    ) {
        FishAvatar(
            name = displayName,
            image = avatarUrl?.let { rememberAsyncImagePainter(it) },
            isDecorative = true,
        )
        Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.threeXs)) {
            Text(
                text = displayName,
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.body,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = handle(username),
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * A handle stays Latin whatever the interface language is, so it is isolated
 * left-to-right and keeps its leading "@" in a right-to-left layout.
 */
private fun handle(username: String) = "$LeftToRightIsolate@$username$PopDirectionalIsolate"

private const val LeftToRightIsolate = "\u2066"
private const val PopDirectionalIsolate = "\u2069"
