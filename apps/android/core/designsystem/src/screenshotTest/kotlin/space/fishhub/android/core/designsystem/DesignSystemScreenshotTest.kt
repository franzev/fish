package space.fishhub.android.core.designsystem

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import space.fishhub.android.core.designsystem.component.FishAvatar
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishIconButtonVariant
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishNoticeTone
import space.fishhub.android.core.designsystem.component.FishSkeleton
import space.fishhub.android.core.designsystem.component.FishTextField

// Component-level screenshot cases for the shared UI kit. Each preview `name`
// matches the `named:` string FishKit passes to assertThemedSnapshots so the
// two design systems can be compared case by case.

@Composable
private fun ComponentStrip(darkTheme: Boolean, content: @Composable () -> Unit) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
        ) {
            content()
        }
    }
}

@Composable
private fun ButtonStates() {
    FishButton(label = "Send", onClick = {})
    FishButton(label = "Secondary", onClick = {}, variant = FishButtonVariant.Secondary)
    FishButton(label = "Ghost", onClick = {}, variant = FishButtonVariant.Ghost)
    FishButton(label = "Disabled", onClick = {}, enabled = false)
    FishButton(label = "Loading", onClick = {}, loading = true)
}

@Composable
private fun IconButtonStates() {
    Row(horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm)) {
        FishIconButton(FishIcons.Attachment, "Add to message", {})
        FishIconButton(FishIcons.Attachment, "Filled", {}, variant = FishIconButtonVariant.Filled)
        FishIconButton(FishIcons.Attachment, "Critical", {}, variant = FishIconButtonVariant.Critical)
        FishIconButton(FishIcons.Attachment, "Selected", {}, selected = true)
        FishIconButton(FishIcons.Attachment, "Disabled", {}, enabled = false)
    }
}

@Composable
private fun AvatarStates() {
    Row(horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm)) {
        FishAvatar(name = "Coach Jordan")
        FishAvatar(name = "Mina Santos")
        FishAvatar(name = "")
        FishAvatar(name = "Decorative", isDecorative = true)
    }
}

@Composable
private fun NoticeStates() {
    FishNotice(title = "Your draft is safe.")
    FishNotice(title = "That did not send.", tone = FishNoticeTone.Error)
    FishNotice(title = "You are offline.", tone = FishNoticeTone.Warning)
    FishNotice(title = "Saved.", tone = FishNoticeTone.Success)
}

@Composable
private fun TextFieldStates() {
    FishTextField(value = "", onValueChange = {}, label = "Email", placeholder = "you@example.com")
    FishTextField(value = "practice", onValueChange = {}, label = "Filled")
    FishTextField(
        value = "",
        onValueChange = {},
        label = "With support",
        supportingText = "We only use this to sign you in.",
    )
    FishTextField(
        value = "nope",
        onValueChange = {},
        label = "With error",
        errorMessage = "That address needs an @.",
    )
    FishTextField(value = "locked", onValueChange = {}, label = "Disabled", enabled = false)
}

@Composable
private fun SkeletonStates() {
    FishSkeleton()
    FishSkeleton(width = FishTheme.sizes.avatarMedium)
}

@Composable
private fun EmptyStates() {
    FishEmptyState(title = "No messages yet", description = "Your coach will start the thread.")
    FishEmptyState(
        title = "Nothing shared yet",
        description = "Photos and files you exchange will collect here.",
        action = { FishButton(label = "Refresh", onClick = {}) },
    )
}

@PreviewTest
@Preview(name = "button-states-light", widthDp = 412, showBackground = true)
@Composable
fun ButtonStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { ButtonStates() }
}

@PreviewTest
@Preview(
    name = "button-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun ButtonStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { ButtonStates() }
}

@PreviewTest
@Preview(name = "icon-button-states-light", widthDp = 412, showBackground = true)
@Composable
fun IconButtonStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { IconButtonStates() }
}

@PreviewTest
@Preview(
    name = "icon-button-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun IconButtonStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { IconButtonStates() }
}

@PreviewTest
@Preview(name = "avatar-states-light", widthDp = 412, showBackground = true)
@Composable
fun AvatarStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { AvatarStates() }
}

@PreviewTest
@Preview(
    name = "avatar-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun AvatarStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { AvatarStates() }
}

@PreviewTest
@Preview(name = "notice-states-light", widthDp = 412, showBackground = true)
@Composable
fun NoticeStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { NoticeStates() }
}

@PreviewTest
@Preview(
    name = "notice-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun NoticeStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { NoticeStates() }
}

@PreviewTest
@Preview(name = "text-field-states-light", widthDp = 412, showBackground = true)
@Composable
fun TextFieldStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { TextFieldStates() }
}

@PreviewTest
@Preview(
    name = "text-field-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun TextFieldStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { TextFieldStates() }
}

@PreviewTest
@Preview(name = "skeleton-states-light", widthDp = 412, showBackground = true)
@Composable
fun SkeletonStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { SkeletonStates() }
}

@PreviewTest
@Preview(
    name = "skeleton-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun SkeletonStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { SkeletonStates() }
}

@PreviewTest
@Preview(name = "empty-states-light", widthDp = 412, showBackground = true)
@Composable
fun EmptyStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { EmptyStates() }
}

@PreviewTest
@Preview(
    name = "empty-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun EmptyStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { EmptyStates() }
}
