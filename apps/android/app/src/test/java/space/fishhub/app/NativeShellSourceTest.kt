package space.fishhub.app

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeShellSourceTest {
    @Test
    fun androidSignedInPreviewUsesTheSketchShellWithoutProgress() {
        val shell = readProjectFile(
            "app/src/main/java/space/fishhub/app/feature/app/AppShell.kt",
            "src/main/java/space/fishhub/app/feature/app/AppShell.kt",
        )
        val preview = readProjectFile(
            "app/src/main/java/space/fishhub/app/feature/auth/PreviewApp.kt",
            "src/main/java/space/fishhub/app/feature/auth/PreviewApp.kt",
        )

        assertTrue(shell.contains("Home"))
        assertTrue(shell.contains("Messages"))
        assertTrue(shell.contains("Profile"))
        assertFalse(shell.contains("Progress"))
        assertTrue(preview.contains("AppShell("))
    }

    @Test
    fun iosSignedInPreviewUsesTheSketchShellWithoutProgress() {
        val shell = readProjectFile("../ios/FISH/App/AppShell.swift")
        val authPreview = readProjectFile("../ios/FISH/App/AuthPreviewScreen.swift")

        assertTrue(shell.contains("TabView"))
        assertTrue(shell.contains("Home"))
        assertTrue(shell.contains("Messages"))
        assertTrue(shell.contains("Profile"))
        assertFalse(shell.contains("Progress"))
        assertTrue(authPreview.contains("AppShell("))
    }

    private fun readProjectFile(vararg paths: String): String {
        val root = File(requireNotNull(System.getProperty("user.dir")))
        val file = paths
            .map { File(root, it) }
            .firstOrNull { it.exists() }

        return requireNotNull(file) {
            "Could not find any of: ${paths.joinToString()}"
        }.readText()
    }
}
