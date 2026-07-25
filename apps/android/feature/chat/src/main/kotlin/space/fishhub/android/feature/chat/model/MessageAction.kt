package space.fishhub.android.feature.chat.model

/**
 * Something the viewer did to a message bubble. Mirrors `MessageAction` in
 * FishKit: one action channel out of the bubble instead of a callback per
 * interaction.
 *
 * The case sets are not identical across platforms, and deliberately so. FishKit's
 * bubble owns view-scoped state and services, so it settles attachment opening
 * and the reply/edit/delete menu itself and only escalates what the store must
 * decide. This bubble holds no state, so every interaction escalates. That
 * difference is the state-handling break recorded in the parity registry; the
 * bubble's parameter list is the part that matches.
 */
sealed interface MessageAction {
    val messageId: String

    data class ToggleReaction(override val messageId: String, val emoji: String) : MessageAction

    data class AddReaction(override val messageId: String) : MessageAction

    data class OpenActions(override val messageId: String) : MessageAction

    data class OpenReplyPreview(override val messageId: String) : MessageAction

    data class ToggleGif(override val messageId: String) : MessageAction

    data class ReportGif(override val messageId: String) : MessageAction

    data class ToggleVoice(override val messageId: String, val attachmentId: String) : MessageAction

    data class OpenPhotoAttachment(
        override val messageId: String,
        val attachmentId: String,
    ) : MessageAction

    data class OpenFileAttachment(
        override val messageId: String,
        val attachmentId: String,
    ) : MessageAction

    data class ShareFileAttachment(
        override val messageId: String,
        val attachmentId: String,
    ) : MessageAction

    data class AttachmentLoadFailed(
        override val messageId: String,
        val attachmentId: String,
    ) : MessageAction
}
