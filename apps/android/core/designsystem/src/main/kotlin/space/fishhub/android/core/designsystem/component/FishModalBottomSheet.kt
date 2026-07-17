package space.fishhub.android.core.designsystem.component

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.colorspace.ColorSpaces
import androidx.compose.foundation.layout.ColumnScope
import space.fishhub.android.core.designsystem.FishTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FishModalBottomSheet(
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    content: @Composable ColumnScope.() -> Unit,
) {
    // Material's Android dialog wrapper calculates luminance in RGB. FISH
    // colors are authored in OKLCH/Oklab, so convert only at this boundary.
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        modifier = modifier,
        sheetState = sheetState,
        containerColor = FishTheme.colors.surface.convert(ColorSpaces.Srgb),
        contentColor = FishTheme.colors.foreground.convert(ColorSpaces.Srgb),
        scrimColor = FishTheme.colors.scrim.convert(ColorSpaces.Srgb),
        dragHandle = null,
        content = content,
    )
}
