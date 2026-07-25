package space.fishhub.android.feature.chat

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishDivider

@Composable
fun UnreadMessageDivider(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.md)
            .semantics { heading() },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) { FishDivider() }
        Text(
            text = stringResource(R.string.new_messages),
            modifier = Modifier.padding(horizontal = FishTheme.spacing.sm),
            color = FishTheme.colors.notice,
            style = FishTheme.typography.label,
        )
        Box(Modifier.weight(1f)) { FishDivider() }
    }
}
