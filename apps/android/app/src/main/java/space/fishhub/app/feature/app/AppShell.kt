package space.fishhub.app.feature.app

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.StrokeCap
import androidx.compose.ui.unit.dp
import space.fishhub.app.designsystem.component.Button
import space.fishhub.app.designsystem.component.ButtonText
import space.fishhub.app.designsystem.component.ButtonVariant
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalSizeTokens
import space.fishhub.app.designsystem.theme.LocalSpacingTokens
import space.fishhub.app.designsystem.theme.LocalStrokeTokens
import space.fishhub.app.designsystem.theme.LocalTypeTokens

private enum class AppDestination(val label: String) {
    Home("Home"),
    Messages("Messages"),
    Profile("Profile"),
}

@Composable
internal fun AppShell(
    displayName: String = "Alex Rivera",
    coachName: String = "Maya Chen",
    onSignOut: () -> Unit = {},
) {
    var selected by rememberSaveable { mutableStateOf(AppDestination.Home) }
    val colors = LocalColorTokens.current

    Scaffold(
        containerColor = colors.bg,
        contentColor = colors.body,
        bottomBar = {
            AppNavigationBar(
                selected = selected,
                onSelect = { selected = it },
            )
        },
    ) { innerPadding ->
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            color = colors.bg,
            contentColor = colors.body,
        ) {
            when (selected) {
                AppDestination.Home -> HomeScreen(displayName, coachName)
                AppDestination.Messages -> MessagesScreen(coachName)
                AppDestination.Profile -> ProfileScreen(displayName, coachName, onSignOut)
            }
        }
    }
}

@Composable
private fun AppNavigationBar(
    selected: AppDestination,
    onSelect: (AppDestination) -> Unit,
) {
    val colors = LocalColorTokens.current
    val type = LocalTypeTokens.current

    NavigationBar(containerColor = colors.surface, contentColor = colors.body) {
        listOf(
            AppDestination.Home,
            AppDestination.Messages,
            AppDestination.Profile,
        ).forEach { destination ->
            val active = selected == destination
            NavigationBarItem(
                selected = active,
                onClick = { onSelect(destination) },
                icon = {
                    DestinationIcon(destination = destination, active = active)
                },
                label = {
                    Text(
                        text = destination.label,
                        style = if (active) type.label else type.caption,
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = colors.foreground,
                    selectedTextColor = colors.foreground,
                    indicatorColor = colors.surface2,
                    unselectedIconColor = colors.muted,
                    unselectedTextColor = colors.muted,
                ),
            )
        }
    }
}

@Composable
private fun HomeScreen(displayName: String, coachName: String) {
    ScreenColumn {
        Header(title = "Welcome back, ${displayName.firstName()}")
        AppCard {
            Column(verticalArrangement = Arrangement.spacedBy(LocalSpacingTokens.current.sm)) {
                Text(
                    text = "Nothing to practice yet today.",
                    color = LocalColorTokens.current.foreground,
                    style = LocalTypeTokens.current.bodyMedium,
                )
                Text(
                    text = "$coachName will add your next step when you're ready.",
                    color = LocalColorTokens.current.body,
                    style = LocalTypeTokens.current.body,
                )
            }
        }
    }
}

@Composable
private fun MessagesScreen(coachName: String) {
    ScreenColumn {
        Header(title = "Messages")
        AppCard {
            Row(
                horizontalArrangement = Arrangement.spacedBy(LocalSpacingTokens.current.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Avatar(name = coachName)
                Column(verticalArrangement = Arrangement.spacedBy(LocalSpacingTokens.current.xs)) {
                    Text(
                        text = coachName,
                        color = LocalColorTokens.current.foreground,
                        style = LocalTypeTokens.current.bodyMedium,
                    )
                    Text(
                        text = "Your coach will say hello soon. Nothing to do yet.",
                        color = LocalColorTokens.current.muted,
                        style = LocalTypeTokens.current.caption,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileScreen(
    displayName: String,
    coachName: String,
    onSignOut: () -> Unit,
) {
    val space = LocalSpacingTokens.current

    ScreenColumn {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(space.sm),
        ) {
            Avatar(name = displayName, large = true)
            Text(
                text = displayName,
                color = LocalColorTokens.current.foreground,
                style = LocalTypeTokens.current.display,
            )
            Text(
                text = "Learning English",
                color = LocalColorTokens.current.muted,
                style = LocalTypeTokens.current.caption,
            )
        }

        AppCard {
            Row(
                horizontalArrangement = Arrangement.spacedBy(space.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Avatar(name = coachName)
                Column(verticalArrangement = Arrangement.spacedBy(space.xs)) {
                    Text(
                        text = coachName,
                        color = LocalColorTokens.current.foreground,
                        style = LocalTypeTokens.current.bodyMedium,
                    )
                    Text(
                        text = "Your English coach",
                        color = LocalColorTokens.current.muted,
                        style = LocalTypeTokens.current.caption,
                    )
                }
            }
        }

        AppCard {
            Column {
                SettingsRow("Appearance", "System")
                SettingsDivider()
                SettingsRow("Notifications", "Quiet")
                SettingsDivider()
                SettingsRow("Language", "English")
                SettingsDivider()
                Button(
                    onClick = onSignOut,
                    variant = ButtonVariant.Ghost,
                    fullWidth = true,
                ) {
                    ButtonText("Log out")
                }
            }
        }
    }
}

@Composable
private fun ScreenColumn(content: @Composable Column.() -> Unit) {
    val space = LocalSpacingTokens.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = space.lg, vertical = space.xxl),
        verticalArrangement = Arrangement.spacedBy(space.lg),
        content = content,
    )
}

@Composable
private fun Header(title: String) {
    Text(
        text = title,
        color = LocalColorTokens.current.foreground,
        style = LocalTypeTokens.current.display,
    )
}

@Composable
private fun AppCard(content: @Composable () -> Unit) {
    val colors = LocalColorTokens.current
    val radius = LocalRadiusTokens.current
    val space = LocalSpacingTokens.current
    val stroke = LocalStrokeTokens.current

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = colors.surface,
        contentColor = colors.body,
        shape = RoundedCornerShape(radius.card),
        border = BorderStroke(stroke.hairline, colors.border),
    ) {
        Box(modifier = Modifier.padding(space.lg)) {
            content()
        }
    }
}

@Composable
private fun SettingsRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = LocalSizeTokens.current.control),
        horizontalArrangement = Arrangement.spacedBy(LocalSpacingTokens.current.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            color = LocalColorTokens.current.foreground,
            style = LocalTypeTokens.current.body,
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = value,
            color = LocalColorTokens.current.muted,
            style = LocalTypeTokens.current.caption,
        )
    }
}

@Composable
private fun SettingsDivider() {
    HorizontalDivider(
        color = LocalColorTokens.current.border,
        thickness = LocalStrokeTokens.current.hairline,
    )
}

@Composable
private fun Avatar(name: String, large: Boolean = false) {
    val colors = LocalColorTokens.current
    val size = if (large) 64.dp else 48.dp

    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(colors.surface2)
            .border(BorderStroke(LocalStrokeTokens.current.hairline, colors.border), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = name.initials(),
            color = colors.body,
            style = if (large) LocalTypeTokens.current.bodyMedium else LocalTypeTokens.current.label,
        )
    }
}

@Composable
private fun DestinationIcon(destination: AppDestination, active: Boolean) {
    val colors = LocalColorTokens.current
    val strokeColor = if (active) colors.foreground else colors.muted
    val strokeWidth = LocalStrokeTokens.current.icon

    Canvas(modifier = Modifier.size(24.dp)) {
        val stroke = Stroke(width = strokeWidth.toPx(), cap = StrokeCap.Round)
        when (destination) {
            AppDestination.Home -> {
                val roof = Path().apply {
                    moveTo(size.width * 0.2f, size.height * 0.48f)
                    lineTo(size.width * 0.5f, size.height * 0.2f)
                    lineTo(size.width * 0.8f, size.height * 0.48f)
                }
                drawPath(roof, color = strokeColor, style = stroke)
                drawRoundRect(
                    color = strokeColor,
                    topLeft = Offset(size.width * 0.3f, size.height * 0.48f),
                    size = Size(size.width * 0.4f, size.height * 0.34f),
                    cornerRadius = CornerRadius(3.dp.toPx()),
                    style = stroke,
                )
            }

            AppDestination.Messages -> {
                drawRoundRect(
                    color = strokeColor,
                    topLeft = Offset(size.width * 0.18f, size.height * 0.22f),
                    size = Size(size.width * 0.64f, size.height * 0.46f),
                    cornerRadius = CornerRadius(5.dp.toPx()),
                    style = stroke,
                )
                drawLine(
                    color = strokeColor,
                    start = Offset(size.width * 0.34f, size.height * 0.42f),
                    end = Offset(size.width * 0.66f, size.height * 0.42f),
                    strokeWidth = stroke.width,
                    cap = StrokeCap.Round,
                )
                drawLine(
                    color = strokeColor,
                    start = Offset(size.width * 0.34f, size.height * 0.55f),
                    end = Offset(size.width * 0.54f, size.height * 0.55f),
                    strokeWidth = stroke.width,
                    cap = StrokeCap.Round,
                )
            }

            AppDestination.Profile -> {
                drawCircle(
                    color = strokeColor,
                    radius = size.minDimension * 0.14f,
                    center = Offset(size.width * 0.5f, size.height * 0.34f),
                    style = stroke,
                )
                drawArc(
                    color = strokeColor,
                    startAngle = 205f,
                    sweepAngle = 130f,
                    useCenter = false,
                    topLeft = Offset(size.width * 0.25f, size.height * 0.5f),
                    size = Size(size.width * 0.5f, size.height * 0.42f),
                    style = stroke,
                )
            }
        }
    }
}

private fun String.firstName(): String = trim().split(" ").firstOrNull().orEmpty()

private fun String.initials(): String {
    val parts = trim().split(" ").filter { it.isNotEmpty() }
    val first = parts.firstOrNull()?.firstOrNull()
    val second = parts.drop(1).lastOrNull()?.firstOrNull()
    return listOfNotNull(first, second).joinToString("").uppercase()
}
