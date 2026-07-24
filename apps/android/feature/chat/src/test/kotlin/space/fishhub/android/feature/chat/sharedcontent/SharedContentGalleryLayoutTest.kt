package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.ui.layout.ContentScale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class SharedContentGalleryLayoutTest {
    @Test
    fun columnsUseWidthInsideHorizontalContentPadding() {
        assertEquals(
            2,
            calculateSharedContentMediaColumns(
                containerWidth = 320f,
                horizontalPadding = 24f,
                minimumCellWidth = 120f,
                gap = 8f,
            ),
        )
        assertEquals(
            1,
            calculateSharedContentMediaColumns(
                containerWidth = 320f,
                horizontalPadding = 24f,
                minimumCellWidth = 180f,
                gap = 8f,
            ),
        )
    }

    @Test
    fun transitionWidthNeverCreatesCellsNarrowerThanTheMinimum() {
        assertEquals(
            2,
            calculateSharedContentMediaColumns(
                containerWidth = 296f,
                horizontalPadding = 24f,
                minimumCellWidth = 120f,
                gap = 8f,
            ),
        )
        assertEquals(
            1,
            calculateSharedContentMediaColumns(
                containerWidth = 295f,
                horizontalPadding = 24f,
                minimumCellWidth = 120f,
                gap = 8f,
            ),
        )
    }

    @Test
    fun stickersFitWhileOtherMediaKindsCrop() {
        assertSame(ContentScale.Fit, sharedContentMediaContentScale("sticker"))
        listOf("photo", "video", "gif").forEach { kind ->
            assertSame(ContentScale.Crop, sharedContentMediaContentScale(kind))
        }
    }
}
