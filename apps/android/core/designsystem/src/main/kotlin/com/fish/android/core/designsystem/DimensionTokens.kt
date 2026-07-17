package com.fish.android.core.designsystem

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.fish.android.core.designsystem.tokens.GeneratedDurations
import com.fish.android.core.designsystem.tokens.GeneratedLayout
import com.fish.android.core.designsystem.tokens.GeneratedRadii
import com.fish.android.core.designsystem.tokens.GeneratedSizes
import com.fish.android.core.designsystem.tokens.GeneratedSpacing

@Immutable
class SpacingTokens internal constructor(
    val threeXs: Dp = GeneratedSpacing.ThreeXs,
    val twoXs: Dp = GeneratedSpacing.TwoXs,
    val nudge: Dp = GeneratedSpacing.Nudge,
    val xs: Dp = GeneratedSpacing.Xs,
    val compact: Dp = GeneratedSpacing.Compact,
    val sm: Dp = GeneratedSpacing.Sm,
    val fieldY: Dp = GeneratedSpacing.FieldY,
    val md: Dp = GeneratedSpacing.Md,
    val page: Dp = GeneratedSpacing.Page,
    val lg: Dp = GeneratedSpacing.Lg,
    val xl: Dp = GeneratedSpacing.Xl,
    val twoXl: Dp = GeneratedSpacing.TwoXl,
    val threeXl: Dp = GeneratedSpacing.ThreeXl,
    val fourXl: Dp = GeneratedSpacing.FourXl,
)

@Immutable
class RadiusTokens internal constructor(
    val card: Dp = GeneratedRadii.Card,
    val chat: Dp = GeneratedRadii.Chat,
    val control: Dp = GeneratedRadii.Control,
    val chatInner: Dp = GeneratedRadii.ChatInner,
    val pill: Dp = GeneratedRadii.Pill,
)

@Immutable
class SizeTokens internal constructor(
    val touchTarget: Dp = GeneratedSizes.TouchTarget,
    val primaryControl: Dp = GeneratedSizes.PrimaryControl,
    val iconGlyph: Dp = GeneratedSizes.IconGlyph,
    val presenceIndicatorSmall: Dp = GeneratedSizes.PresenceIndicatorSmall,
    val chatHeader: Dp = GeneratedSizes.ChatHeader,
    val composerMin: Dp = GeneratedSizes.ComposerMin,
    val composerMax: Dp = GeneratedSizes.ComposerMax,
    val conversationRail: Dp = GeneratedSizes.ConversationRail,
    val chatContentMax: Dp = GeneratedSizes.ChatContentMax,
    val avatarSmall: Dp = GeneratedSizes.AvatarSmall,
    val avatarMedium: Dp = GeneratedSizes.AvatarMedium,
    val avatarLarge: Dp = GeneratedSizes.AvatarLarge,
    val badge: Dp = GeneratedSizes.Badge,
    val badgeSlot: Dp = GeneratedSizes.BadgeSlot,
    val paginationSlot: Dp = GeneratedSizes.PaginationSlot,
)

@Immutable
class LayoutTokens internal constructor(
    val messageMaxWidthFraction: Float = GeneratedLayout.MessageMaxWidthFraction,
    val twoPaneBreakpoint: Dp = GeneratedLayout.TwoPaneBreakpoint,
)

@Immutable
class ElevationTokens internal constructor(
    val base: Dp = 0.dp,
    val raised: Dp = 0.dp,
    val overlay: Dp = 0.dp,
)

@Immutable
class MotionTokens internal constructor(
    val fadeMs: Int,
    val messageMs: Int,
    val typingMs: Int,
    val progressMs: Int,
    val skeletonMs: Int,
) {
    internal companion object {
        fun create(reducedMotion: Boolean): MotionTokens {
            val reduced = GeneratedDurations.Reduced
            return MotionTokens(
                fadeMs = if (reducedMotion) reduced else GeneratedDurations.Fade,
                messageMs = if (reducedMotion) reduced else GeneratedDurations.Message,
                typingMs = if (reducedMotion) reduced else GeneratedDurations.Typing,
                progressMs = if (reducedMotion) reduced else GeneratedDurations.Progress,
                skeletonMs = if (reducedMotion) reduced else GeneratedDurations.Skeleton,
            )
        }
    }
}
