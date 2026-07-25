package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import coil3.compose.rememberAsyncImagePainter
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.model.ParticipantUiModel
import space.fishhub.android.feature.presence.PresenceAvatar
import space.fishhub.android.feature.presence.PresencePresentation

@Composable
fun PersonalChatTopBar(
    participant: ParticipantUiModel,
    presence: PresencePresentation,
    showBack: Boolean,
    onBack: () -> Unit,
    onStartAudioCall: (ParticipantUiModel) -> Unit = {},
    onStartVideoCall: (ParticipantUiModel) -> Unit = {},
    onOpenMessageSearch: () -> Unit = {},
    onOpenSharedContent: () -> Unit = {},
    onOpenParticipantDetails: () -> Unit = {},
    sharedContentModifier: Modifier = Modifier,
    participantDetailsModifier: Modifier = Modifier,
    accountContent: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val avatarPainter = participant.avatarUrl?.let { rememberAsyncImagePainter(it) }
    val participantDetailsDescription = stringResource(R.string.participant_details)
    FishTopBar(
        title = participant.displayName,
        subtitle = presence.label,
        modifier = modifier,
        showBack = showBack,
        onBack = onBack,
        leadingAvatar = {
            Box(
                modifier = Modifier
                    .size(FishTheme.sizes.touchTarget)
                    .then(participantDetailsModifier)
                    .semantics {
                        contentDescription = participantDetailsDescription
                        role = Role.Button
                    }
                    .clickable(
                        role = Role.Button,
                        onClick = onOpenParticipantDetails,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                PresenceAvatar(
                    name = participant.displayName,
                    presence = presence,
                    image = avatarPainter,
                )
            }
        },
        trailingContent = {
            FishIconButton(
                icon = FishIcons.Phone,
                contentDescription = stringResource(
                    R.string.voice_call_participant,
                    participant.displayName,
                ),
                onClick = { onStartAudioCall(participant) },
            )
            FishIconButton(
                icon = FishIcons.Video,
                contentDescription = stringResource(
                    R.string.video_call_participant,
                    participant.displayName,
                ),
                onClick = { onStartVideoCall(participant) },
            )
            FishIconButton(
                icon = FishIcons.Search,
                contentDescription = stringResource(R.string.search_messages),
                onClick = onOpenMessageSearch,
            )
            FishIconButton(
                icon = FishIcons.Gallery,
                contentDescription = stringResource(R.string.shared_content),
                onClick = onOpenSharedContent,
                modifier = sharedContentModifier,
            )
            accountContent?.invoke()
        },
    )
}
