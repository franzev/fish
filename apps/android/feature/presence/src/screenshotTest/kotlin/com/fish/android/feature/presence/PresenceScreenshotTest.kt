package com.fish.android.feature.presence

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.data.presence.PresenceDisplayStatus
import com.fish.android.data.presence.PresencePreference
import com.fish.android.data.presence.PresenceConnectionState

@PreviewTest
@Preview(name = "presence light", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun PresenceLightScreenshot() = PresenceStatusFrame(false)

@PreviewTest
@Preview(
    name = "presence dark",
    widthDp = 412,
    heightDp = 915,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun PresenceDarkScreenshot() = PresenceStatusFrame(true)

@PreviewTest
@Preview(name = "presence compact", widthDp = 320, heightDp = 640, showBackground = true)
@Composable
fun PresenceCompactScreenshot() = PresenceStatusFrame(false)

@PreviewTest
@Preview(name = "presence large font", widthDp = 412, heightDp = 915, fontScale = 2f)
@Composable
fun PresenceLargeFontScreenshot() = PresenceStatusFrame(false)

@PreviewTest
@Preview(name = "presence rtl", widthDp = 412, heightDp = 915, locale = "ar")
@Composable
fun PresenceRtlScreenshot() = PresenceStatusFrame(false)

@PreviewTest
@Preview(name = "account sheet", widthDp = 412, heightDp = 640)
@Composable
fun PresenceAccountScreenshot() = SheetFrame("account")

@PreviewTest
@Preview(name = "status sheet", widthDp = 412, heightDp = 640)
@Composable
fun PresenceStatusSheetScreenshot() = SheetFrame("status")

@PreviewTest
@Preview(name = "duration sheet", widthDp = 412, heightDp = 640)
@Composable
fun PresenceDurationSheetScreenshot() = SheetFrame("duration")

@Composable
private fun PresenceStatusFrame(darkTheme: Boolean) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            PresenceDisplayStatus.entries.forEach { status ->
                val label = when (status) {
                    PresenceDisplayStatus.Busy -> "Do not disturb"
                    else -> status.name
                }
                PresenceSummary(
                    PresencePresentation(
                        status = status,
                        label = label,
                        detail = if (status == PresenceDisplayStatus.Offline) {
                            "Last seen 2 hours ago"
                        } else null,
                    ),
                )
            }
            PresenceAccountTrigger(
                displayName = "Franz",
                presence = PresencePresentation(PresenceDisplayStatus.Online, "Online"),
                onClick = {},
            )
        }
    }
}

@Composable
private fun SheetFrame(page: String) {
    FishTheme(reducedMotion = true) {
        PresenceAccountSheetPreviewContent(
            page = page,
            state = PresenceUiState(
                own = PresencePresentation(PresenceDisplayStatus.Away, "Away"),
                ownPreference = PresencePreference.Away,
                connection = if (page == "account") {
                    PresenceConnectionState.Disconnected
                } else {
                    PresenceConnectionState.Connected
                },
            ),
        )
    }
}
