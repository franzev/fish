package com.fish.android.core.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

object FishIcons {
    val CircleFilled: ImageVector by lazy {
        filledFishIcon("CircleFilled") {
            moveTo(12f, 2f)
            curveTo(17.52f, 2f, 22f, 6.48f, 22f, 12f)
            curveTo(22f, 17.52f, 17.52f, 22f, 12f, 22f)
            curveTo(6.48f, 22f, 2f, 17.52f, 2f, 12f)
            curveTo(2f, 6.48f, 6.48f, 2f, 12f, 2f)
            close()
        }
    }

    val OutlineCircle: ImageVector by lazy {
        fishIcon("OutlineCircle") {
            moveTo(12f, 2f)
            curveTo(17.52f, 2f, 22f, 6.48f, 22f, 12f)
            curveTo(22f, 17.52f, 17.52f, 22f, 12f, 22f)
            curveTo(6.48f, 22f, 2f, 17.52f, 2f, 12f)
            curveTo(2f, 6.48f, 6.48f, 2f, 12f, 2f)
            close()
        }
    }

    val Moon: ImageVector by lazy {
        fishIcon("Moon") {
            moveTo(20.5f, 14.5f)
            curveTo(17.1f, 16f, 13.1f, 14.5f, 11.6f, 11.1f)
            curveTo(10.1f, 7.7f, 11.6f, 3.7f, 15f, 2.2f)
            curveTo(9.7f, 1f, 4.5f, 4.3f, 3.3f, 9.6f)
            curveTo(2.1f, 14.9f, 5.4f, 20.1f, 10.7f, 21.3f)
            curveTo(14.8f, 22.2f, 18.9f, 19.5f, 20.5f, 14.5f)
            close()
        }
    }

    val Clock: ImageVector by lazy {
        fishIcon("Clock") {
            moveTo(12f, 2f)
            curveTo(17.52f, 2f, 22f, 6.48f, 22f, 12f)
            curveTo(22f, 17.52f, 17.52f, 22f, 12f, 22f)
            curveTo(6.48f, 22f, 2f, 17.52f, 2f, 12f)
            curveTo(2f, 6.48f, 6.48f, 2f, 12f, 2f)
            close()
            moveTo(12f, 6f)
            lineTo(12f, 12f)
            lineTo(16f, 14f)
        }
    }

    val CircleMinus: ImageVector by lazy {
        fishIcon("CircleMinus") {
            moveTo(12f, 2f)
            curveTo(17.52f, 2f, 22f, 6.48f, 22f, 12f)
            curveTo(22f, 17.52f, 17.52f, 22f, 12f, 22f)
            curveTo(6.48f, 22f, 2f, 17.52f, 2f, 12f)
            curveTo(2f, 6.48f, 6.48f, 2f, 12f, 2f)
            close()
            moveTo(8f, 12f)
            lineTo(16f, 12f)
        }
    }

    val EyeOff: ImageVector by lazy {
        fishIcon("EyeOff") {
            moveTo(3f, 3f)
            lineTo(21f, 21f)
            moveTo(10.6f, 10.6f)
            curveTo(9.8f, 11.4f, 9.8f, 12.6f, 10.6f, 13.4f)
            curveTo(11.4f, 14.2f, 12.6f, 14.2f, 13.4f, 13.4f)
            moveTo(9.9f, 4.2f)
            curveTo(10.6f, 4.1f, 11.3f, 4f, 12f, 4f)
            curveTo(17f, 4f, 20f, 8f, 22f, 12f)
            curveTo(21.4f, 13.2f, 20.7f, 14.3f, 19.8f, 15.3f)
            moveTo(6.6f, 6.6f)
            curveTo(4.5f, 8f, 3f, 10f, 2f, 12f)
            curveTo(4f, 16f, 7f, 20f, 12f, 20f)
            curveTo(13.5f, 20f, 14.9f, 19.6f, 16.1f, 19f)
        }
    }

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

    val Phone: ImageVector by lazy {
        fishIcon("Phone") {
            moveTo(5f, 4f)
            curveTo(5f, 12.3f, 11.7f, 19f, 20f, 19f)
            lineTo(20f, 15f)
            lineTo(15.5f, 14f)
            lineTo(13.5f, 16f)
            curveTo(10.8f, 14.8f, 9.2f, 13.2f, 8f, 10.5f)
            lineTo(10f, 8.5f)
            lineTo(9f, 4f)
            close()
        }
    }

    val PhoneOff: ImageVector by lazy {
        fishIcon("PhoneOff") {
            moveTo(5f, 4f)
            curveTo(5f, 12.3f, 11.7f, 19f, 20f, 19f)
            lineTo(20f, 15f)
            lineTo(15.5f, 14f)
            lineTo(13.5f, 16f)
            curveTo(10.8f, 14.8f, 9.2f, 13.2f, 8f, 10.5f)
            lineTo(10f, 8.5f)
            lineTo(9f, 4f)
            close()
            moveTo(3f, 3f)
            lineTo(21f, 21f)
        }
    }

    val Video: ImageVector by lazy {
        fishIcon("Video") {
            moveTo(4f, 6f)
            lineTo(15f, 6f)
            curveTo(16.1f, 6f, 17f, 6.9f, 17f, 8f)
            lineTo(17f, 16f)
            curveTo(17f, 17.1f, 16.1f, 18f, 15f, 18f)
            lineTo(4f, 18f)
            curveTo(2.9f, 18f, 2f, 17.1f, 2f, 16f)
            lineTo(2f, 8f)
            curveTo(2f, 6.9f, 2.9f, 6f, 4f, 6f)
            close()
            moveTo(17f, 10f)
            lineTo(22f, 7f)
            lineTo(22f, 17f)
            lineTo(17f, 14f)
        }
    }

    val VideoOff: ImageVector by lazy {
        fishIcon("VideoOff") {
            moveTo(2f, 8f)
            curveTo(2f, 6.9f, 2.9f, 6f, 4f, 6f)
            lineTo(15f, 6f)
            curveTo(16.1f, 6f, 17f, 6.9f, 17f, 8f)
            lineTo(17f, 16f)
            curveTo(17f, 17.1f, 16.1f, 18f, 15f, 18f)
            lineTo(4f, 18f)
            curveTo(2.9f, 18f, 2f, 17.1f, 2f, 16f)
            close()
            moveTo(17f, 10f)
            lineTo(22f, 7f)
            lineTo(22f, 17f)
            lineTo(17f, 14f)
            moveTo(3f, 3f)
            lineTo(21f, 21f)
        }
    }

    val Microphone: ImageVector by lazy {
        fishIcon("Microphone") {
            moveTo(12f, 2f)
            curveTo(10.3f, 2f, 9f, 3.3f, 9f, 5f)
            lineTo(9f, 12f)
            curveTo(9f, 13.7f, 10.3f, 15f, 12f, 15f)
            curveTo(13.7f, 15f, 15f, 13.7f, 15f, 12f)
            lineTo(15f, 5f)
            curveTo(15f, 3.3f, 13.7f, 2f, 12f, 2f)
            close()
            moveTo(5f, 11f)
            curveTo(5f, 15f, 8f, 18f, 12f, 18f)
            curveTo(16f, 18f, 19f, 15f, 19f, 11f)
            moveTo(12f, 18f)
            lineTo(12f, 22f)
            moveTo(8f, 22f)
            lineTo(16f, 22f)
        }
    }

    val MicrophoneOff: ImageVector by lazy {
        fishIcon("MicrophoneOff") {
            moveTo(9f, 5f)
            curveTo(9f, 3.3f, 10.3f, 2f, 12f, 2f)
            curveTo(13.7f, 2f, 15f, 3.3f, 15f, 5f)
            lineTo(15f, 11f)
            moveTo(5f, 11f)
            curveTo(5f, 15f, 8f, 18f, 12f, 18f)
            curveTo(14f, 18f, 15.7f, 17.3f, 17f, 16f)
            moveTo(12f, 18f)
            lineTo(12f, 22f)
            moveTo(8f, 22f)
            lineTo(16f, 22f)
            moveTo(3f, 3f)
            lineTo(21f, 21f)
        }
    }

    val SwitchCamera: ImageVector by lazy {
        fishIcon("SwitchCamera") {
            moveTo(4f, 7f)
            lineTo(7f, 4f)
            lineTo(10f, 7f)
            moveTo(7f, 4f)
            lineTo(7f, 14f)
            moveTo(20f, 17f)
            lineTo(17f, 20f)
            lineTo(14f, 17f)
            moveTo(17f, 20f)
            lineTo(17f, 10f)
        }
    }

    val Speaker: ImageVector by lazy {
        fishIcon("Speaker") {
            moveTo(4f, 10f)
            lineTo(8f, 10f)
            lineTo(13f, 6f)
            lineTo(13f, 18f)
            lineTo(8f, 14f)
            lineTo(4f, 14f)
            close()
            moveTo(17f, 9f)
            curveTo(19f, 10.5f, 19f, 13.5f, 17f, 15f)
            moveTo(19f, 6f)
            curveTo(23f, 9f, 23f, 15f, 19f, 18f)
        }
    }

    val Messages: ImageVector by lazy {
        fishIcon("Messages") {
            moveTo(4f, 4f)
            lineTo(20f, 4f)
            curveTo(21.1f, 4f, 22f, 4.9f, 22f, 6f)
            lineTo(22f, 16f)
            curveTo(22f, 17.1f, 21.1f, 18f, 20f, 18f)
            lineTo(9f, 18f)
            lineTo(4f, 22f)
            lineTo(4f, 18f)
            curveTo(2.9f, 18f, 2f, 17.1f, 2f, 16f)
            lineTo(2f, 6f)
            curveTo(2f, 4.9f, 2.9f, 4f, 4f, 4f)
            close()
        }
    }

    val Settings: ImageVector by lazy {
        fishIcon("Settings") {
            moveTo(12f, 8f)
            curveTo(14.2f, 8f, 16f, 9.8f, 16f, 12f)
            curveTo(16f, 14.2f, 14.2f, 16f, 12f, 16f)
            curveTo(9.8f, 16f, 8f, 14.2f, 8f, 12f)
            curveTo(8f, 9.8f, 9.8f, 8f, 12f, 8f)
            close()
            moveTo(12f, 2f)
            lineTo(13f, 5f)
            lineTo(16f, 6f)
            lineTo(19f, 5f)
            lineTo(21f, 8f)
            lineTo(19f, 11f)
            lineTo(19f, 14f)
            lineTo(21f, 16f)
            lineTo(19f, 19f)
            lineTo(16f, 18f)
            lineTo(13f, 19f)
            lineTo(12f, 22f)
            lineTo(9f, 19f)
            lineTo(6f, 18f)
            lineTo(3f, 19f)
            lineTo(2f, 16f)
            lineTo(5f, 14f)
            lineTo(5f, 11f)
            lineTo(2f, 8f)
            lineTo(4f, 5f)
            lineTo(8f, 6f)
            lineTo(11f, 5f)
            close()
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

private fun filledFishIcon(
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
        fill = SolidColor(Color.Black),
        stroke = null,
        pathBuilder = block,
    )
}.build()
