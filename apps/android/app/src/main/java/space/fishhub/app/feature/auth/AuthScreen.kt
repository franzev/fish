package space.fishhub.app.feature.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import space.fishhub.app.designsystem.component.Button
import space.fishhub.app.designsystem.component.ButtonText
import space.fishhub.app.designsystem.component.ButtonVariant
import space.fishhub.app.designsystem.component.TextField
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalSizeTokens
import space.fishhub.app.designsystem.theme.LocalSpacingTokens
import space.fishhub.app.designsystem.theme.LocalTypeTokens

@Composable
internal fun AuthScreen(page: PageSpec) {
    val colors = LocalColorTokens.current
    val space = LocalSpacingTokens.current
    val size = LocalSizeTokens.current

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = colors.bg,
        contentColor = colors.body,
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding(),
        ) {
            val minContentHeight = (maxHeight - space.xxl - space.xxl).coerceAtLeast(size.control)

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = space.lg, vertical = space.xxl),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = minContentHeight),
                    contentAlignment = Alignment.Center,
                ) {
                    Page(page)
                }
            }
        }
    }
}

@Composable
private fun Page(page: PageSpec) {
    val space = LocalSpacingTokens.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(max = LocalSizeTokens.current.content),
        verticalArrangement = Arrangement.spacedBy(space.lg),
    ) {
        if (page.notice != null) Notice(page.notice)
        Header(page.title, page.body)
        if (page.fields.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(space.xs)) {
                page.fields.forEach { field ->
                    TextField(
                        label = field.label,
                        value = field.value,
                        onValueChange = field.onChange,
                        hint = field.hint,
                        notice = field.notice,
                        error = field.error,
                        keyboardOptions = KeyboardOptions(keyboardType = field.keyboardType),
                        visualTransformation = field.visualTransformation,
                    )
                }
            }
        }
        Button(onClick = page.onPrimary, fullWidth = true) { ButtonText(page.primary) }
        if (page.secondary != null && page.onSecondary != null) {
            Button(
                onClick = page.onSecondary,
                variant = ButtonVariant.Secondary,
                fullWidth = true,
            ) {
                ButtonText(page.secondary)
            }
        }
        if (page.links.isNotEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(space.sm),
            ) {
                page.links.forEach { link -> TextLink(link) }
            }
        }
    }
}

@Composable
private fun Header(title: String, body: String?) {
    val colors = LocalColorTokens.current
    val type = LocalTypeTokens.current

    Column(verticalArrangement = Arrangement.spacedBy(LocalSpacingTokens.current.sm)) {
        Text(title, color = colors.foreground, style = type.display)
        if (body != null) Text(body, color = colors.body, style = type.body)
    }
}

@Composable
private fun Notice(text: String) {
    val colors = LocalColorTokens.current
    val radius = LocalRadiusTokens.current
    val space = LocalSpacingTokens.current

    Surface(
        color = colors.surface,
        contentColor = colors.body,
        shape = RoundedCornerShape(radius.control),
    ) {
        Text(
            text = text,
            color = colors.notice,
            style = LocalTypeTokens.current.caption,
            modifier = Modifier
                .fillMaxWidth()
                .padding(space.md),
        )
    }
}

@Composable
private fun TextLink(link: LinkSpec) {
    val colors = LocalColorTokens.current
    val space = LocalSpacingTokens.current
    val interactionSource = remember { MutableInteractionSource() }
    val copy = buildAnnotatedString {
        append(link.prefix)
        withStyle(SpanStyle(color = colors.foreground, fontWeight = FontWeight.Medium)) {
            append(link.text)
        }
    }

    Text(
        text = copy,
        color = colors.muted,
        style = LocalTypeTokens.current.caption,
        modifier = Modifier
            .heightIn(min = LocalSizeTokens.current.control)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClick = link.onClick,
            )
            .padding(horizontal = space.md, vertical = space.md),
    )
}
