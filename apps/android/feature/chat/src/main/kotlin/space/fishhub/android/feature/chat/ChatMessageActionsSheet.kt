package space.fishhub.android.feature.chat

import android.view.ContextThemeWrapper
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.viewinterop.AndroidView
import androidx.emoji2.emojipicker.EmojiPickerView
import androidx.emoji2.emojipicker.RecentEmojiProvider
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet
import space.fishhub.android.core.designsystem.component.FishTextField

private const val MessageBodyLimit = 4_000

private enum class MessageActionsView { Actions, Reactions, Edit, Delete }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatMessageActionsSheet(
    message: MessageUiModel,
    onDismiss: () -> Unit,
    onReply: () -> Unit,
    onEdit: (String) -> Unit,
    onDelete: () -> Unit,
    onReact: (String) -> Unit,
) {
    var view by remember(message.id) { mutableStateOf(MessageActionsView.Actions) }
    var editBody by remember(message.id) { mutableStateOf(message.body) }
    FishModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = FishTheme.sizes.chatContentMax)
                .imePadding()
                .background(FishTheme.colors.surface)
                .padding(FishTheme.spacing.page)
                .testTag("message-actions-sheet"),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(
                        when (view) {
                            MessageActionsView.Actions -> R.string.message_actions
                            MessageActionsView.Reactions -> R.string.add_reaction
                            MessageActionsView.Edit -> R.string.edit_message
                            MessageActionsView.Delete -> R.string.delete_message
                        },
                    ),
                    modifier = Modifier.weight(1f),
                    color = FishTheme.colors.foreground,
                    style = FishTheme.typography.heading,
                )
                FishIconButton(
                    icon = FishIcons.Close,
                    contentDescription = stringResource(R.string.close_message_actions),
                    onClick = onDismiss,
                )
            }
            when (view) {
                MessageActionsView.Actions -> {
                    FishButton(
                        label = stringResource(R.string.add_reaction),
                        onClick = { view = MessageActionsView.Reactions },
                        modifier = Modifier.fillMaxWidth(),
                        variant = FishButtonVariant.Secondary,
                    )
                    FishButton(
                        label = stringResource(R.string.reply),
                        onClick = onReply,
                        modifier = Modifier.fillMaxWidth(),
                        variant = FishButtonVariant.Secondary,
                    )
                    if (message.canEdit) {
                        FishButton(
                            label = stringResource(R.string.edit_message),
                            onClick = { view = MessageActionsView.Edit },
                            modifier = Modifier.fillMaxWidth(),
                            variant = FishButtonVariant.Secondary,
                        )
                    }
                    if (message.canDelete) {
                        FishButton(
                            label = stringResource(R.string.delete_message),
                            onClick = { view = MessageActionsView.Delete },
                            modifier = Modifier.fillMaxWidth(),
                            variant = FishButtonVariant.Ghost,
                        )
                    }
                }
                MessageActionsView.Reactions -> {
                    AndroidView(
                        factory = { context ->
                            EmojiPickerView(
                                ContextThemeWrapper(context, R.style.FishEmojiPickerTheme),
                            ).apply {
                                setRecentEmojiProvider(EmptyRecentEmojiProvider)
                                setOnEmojiPickedListener { item -> onReact(item.emoji) }
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = false),
                    )
                    FishButton(
                        label = stringResource(R.string.back),
                        onClick = { view = MessageActionsView.Actions },
                        modifier = Modifier.fillMaxWidth(),
                        variant = FishButtonVariant.Ghost,
                    )
                }
                MessageActionsView.Edit -> {
                    val codePoints = editBody.codePoints().count().toInt()
                    FishTextField(
                        value = editBody,
                        onValueChange = { value ->
                            if (value.codePoints().count() <= MessageBodyLimit) editBody = value
                        },
                        label = stringResource(R.string.message_label),
                        supportingText = stringResource(
                            R.string.message_counter,
                            codePoints,
                            MessageBodyLimit,
                        ),
                        singleLine = false,
                        keyboardOptions = KeyboardOptions(
                            capitalization = KeyboardCapitalization.Sentences,
                            imeAction = ImeAction.Default,
                        ),
                    )
                    FishButton(
                        label = stringResource(R.string.save_edit),
                        onClick = { onEdit(editBody) },
                        enabled = editBody.trim().isNotEmpty() && editBody.trim() != message.body,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    FishButton(
                        label = stringResource(R.string.back),
                        onClick = { view = MessageActionsView.Actions },
                        modifier = Modifier.fillMaxWidth(),
                        variant = FishButtonVariant.Ghost,
                    )
                }
                MessageActionsView.Delete -> {
                    Text(
                        text = stringResource(R.string.delete_message_confirmation),
                        color = FishTheme.colors.body,
                        style = FishTheme.typography.body,
                    )
                    FishButton(
                        label = stringResource(R.string.delete_message),
                        onClick = onDelete,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    FishButton(
                        label = stringResource(R.string.keep_message),
                        onClick = { view = MessageActionsView.Actions },
                        modifier = Modifier.fillMaxWidth(),
                        variant = FishButtonVariant.Ghost,
                    )
                }
            }
        }
    }
}

private object EmptyRecentEmojiProvider : RecentEmojiProvider {
    override suspend fun getRecentEmojiList(): List<String> = emptyList()
    override fun recordSelection(emoji: String) = Unit
}
