package com.fish.android.core.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

object FishIcons {
    val ArrowBack: ImageVector by lazy {
        fishIcon("ArrowBack") {
            moveTo(15f, 18f)
            lineTo(9f, 12f)
            lineTo(15f, 6f)
            moveTo(9f, 12f)
            lineTo(21f, 12f)
        }
    }

    val Send: ImageVector by lazy {
        fishIcon("Send") {
            moveTo(22f, 2f)
            lineTo(15f, 22f)
            lineTo(11f, 13f)
            lineTo(2f, 9f)
            close()
            moveTo(22f, 2f)
            lineTo(11f, 13f)
        }
    }

    val Refresh: ImageVector by lazy {
        fishIcon("Refresh") {
            moveTo(20f, 11f)
            curveTo(19.5f, 6.6f, 15.6f, 3.4f, 11.2f, 4f)
            curveTo(8.4f, 4.4f, 6f, 6.1f, 4.8f, 8.5f)
            lineTo(4f, 6f)
            moveTo(4.8f, 8.5f)
            lineTo(7.5f, 7.8f)
            moveTo(4f, 13f)
            curveTo(4.5f, 17.4f, 8.4f, 20.6f, 12.8f, 20f)
            curveTo(15.6f, 19.6f, 18f, 17.9f, 19.2f, 15.5f)
            lineTo(20f, 18f)
            moveTo(19.2f, 15.5f)
            lineTo(16.5f, 16.2f)
        }
    }

    val MoreVertical: ImageVector by lazy {
        fishIcon("MoreVertical") {
            moveTo(12f, 5f)
            lineTo(12f, 5.01f)
            moveTo(12f, 12f)
            lineTo(12f, 12.01f)
            moveTo(12f, 19f)
            lineTo(12f, 19.01f)
        }
    }

    val Check: ImageVector by lazy {
        fishIcon("Check") {
            moveTo(5f, 12f)
            lineTo(10f, 17f)
            lineTo(20f, 7f)
        }
    }

    val AlertCircle: ImageVector by lazy {
        fishIcon("AlertCircle") {
            moveTo(12f, 2f)
            curveTo(17.52f, 2f, 22f, 6.48f, 22f, 12f)
            curveTo(22f, 17.52f, 17.52f, 22f, 12f, 22f)
            curveTo(6.48f, 22f, 2f, 17.52f, 2f, 12f)
            curveTo(2f, 6.48f, 6.48f, 2f, 12f, 2f)
            close()
            moveTo(12f, 8f)
            lineTo(12f, 12f)
            moveTo(12f, 16f)
            lineTo(12f, 16.01f)
        }
    }

    val AddMedia: ImageVector by lazy {
        fishIcon("AddMedia") {
            moveTo(12f, 3f)
            curveTo(17f, 3f, 21f, 7f, 21f, 12f)
            curveTo(21f, 17f, 17f, 21f, 12f, 21f)
            curveTo(7f, 21f, 3f, 17f, 3f, 12f)
            curveTo(3f, 7f, 7f, 3f, 12f, 3f)
            close()
            moveTo(12f, 8f)
            lineTo(12f, 16f)
            moveTo(8f, 12f)
            lineTo(16f, 12f)
        }
    }

    val Close: ImageVector by lazy {
        fishIcon("Close") {
            moveTo(6f, 6f)
            lineTo(18f, 18f)
            moveTo(18f, 6f)
            lineTo(6f, 18f)
        }
    }

    val Play: ImageVector by lazy {
        fishIcon("Play") {
            moveTo(8f, 5f)
            lineTo(19f, 12f)
            lineTo(8f, 19f)
            close()
        }
    }

    val Pause: ImageVector by lazy {
        fishIcon("Pause") {
            moveTo(9f, 5f)
            lineTo(9f, 19f)
            moveTo(15f, 5f)
            lineTo(15f, 19f)
        }
    }
}

private fun fishIcon(
    name: String,
    block: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit,
): ImageVector = ImageVector.Builder(
    name = name,
    defaultWidth = 24.dp,
    defaultHeight = 24.dp,
    viewportWidth = 24f,
    viewportHeight = 24f,
).apply {
    path(
        fill = null,
        stroke = SolidColor(Color.Black),
        strokeLineWidth = 1.75f,
        strokeLineCap = StrokeCap.Round,
        strokeLineJoin = StrokeJoin.Round,
        pathBuilder = block,
    )
}.build()
