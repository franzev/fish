package space.fishhub.app.designsystem.component

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class ButtonSourceTest {
    @Test
    fun buttonDefaultsToContentWidthUnlessFullWidthIsRequested() {
        val source = readProjectFile(
            "app/src/main/java/space/fishhub/app/designsystem/component/Button.kt",
            "src/main/java/space/fishhub/app/designsystem/component/Button.kt",
        )

        assertTrue(source.contains("fullWidth: Boolean = false"))
    }

    @Test
    fun previewScreensRequestFullWidthPrimaryActionExplicitly() {
        val source = readProjectFile(
            "app/src/main/java/space/fishhub/app/ui/PreviewApp.kt",
            "src/main/java/space/fishhub/app/ui/PreviewApp.kt",
        )

        assertTrue(source.contains("Button(onClick = page.onPrimary, fullWidth = true)"))
    }

    private fun readProjectFile(vararg paths: String): String {
        val root = File(System.getProperty("user.dir"))
        val file = paths
            .map { File(root, it) }
            .firstOrNull { it.exists() }

        requireNotNull(file) {
            "Could not find any of: ${paths.joinToString()}"
        }

        return file.readText()
    }
}
