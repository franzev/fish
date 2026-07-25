package space.fishhub.android.feature.chat.model

/**
 * Where a message sits inside a run of messages from the same sender. Mirrors
 * `MessageGroupPosition` in FishKit so the two transcripts read alike.
 */
enum class MessageGroupPosition {
    Solo,
    First,
    Middle,
    Last,
}

/**
 * A message as the transcript renders it: the message itself plus the run
 * context the bubble needs. Mirrors `MessageRowUiModel` in FishKit.
 *
 * FishKit's row also carries `showsMeta`, which gates a sender/time header.
 * This bubble renders the time inside its media and attachment children rather
 * than as a header, so the field would never be read here and is left out.
 */
data class MessageRowUiModel(
    val message: MessageUiModel,
    val groupPosition: MessageGroupPosition,
    val showsDeliveryStatus: Boolean,
) {
    val id: String get() = message.id
}

/** Derives the run context already computed onto each [MessageUiModel]. */
fun MessageUiModel.toRow(): MessageRowUiModel = MessageRowUiModel(
    message = this,
    groupPosition = when {
        !groupedWithPrevious && !groupedWithNext -> MessageGroupPosition.Solo
        !groupedWithPrevious -> MessageGroupPosition.First
        groupedWithNext -> MessageGroupPosition.Middle
        else -> MessageGroupPosition.Last
    },
    showsDeliveryStatus = delivery != null,
)
