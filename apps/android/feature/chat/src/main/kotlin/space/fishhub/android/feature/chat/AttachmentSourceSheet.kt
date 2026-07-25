package space.fishhub.android.feature.chat

import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun AttachmentSourceSheet(
    remainingSlots: Int,
    cameraAvailable: Boolean,
    onChoosePhotos: () -> Unit,
    onTakePhoto: () -> Unit,
    onChooseFile: () -> Unit,
    onDismiss: () -> Unit,
) {
    FishModalBottomSheet(onDismissRequest = onDismiss) {
        AttachmentSourceContent(
            remainingSlots = remainingSlots,
            cameraAvailable = cameraAvailable,
            onChoosePhotos = onChoosePhotos,
            onTakePhoto = onTakePhoto,
            onChooseFile = onChooseFile,
            onDismiss = onDismiss,
            modifier = Modifier.navigationBarsPadding(),
        )
    }
}
