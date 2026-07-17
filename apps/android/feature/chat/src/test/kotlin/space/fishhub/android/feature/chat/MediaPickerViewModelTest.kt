package space.fishhub.android.feature.chat

import space.fishhub.android.data.chat.GifPage
import space.fishhub.android.data.chat.GifRepository
import space.fishhub.android.data.chat.GifSearchItem
import space.fishhub.android.data.chat.model.ChatGif
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MediaPickerViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule(dispatcher)

    @Test
    fun `cancels stale debounced GIF searches and preserves punctuation`() = runTest(dispatcher) {
        val repository = FakeGifRepository()
        val viewModel = MediaPickerViewModel(catalog(), repository, animationsEnabled = true)
        viewModel.selectTab(MediaPickerTab.Gif)
        runCurrent()

        viewModel.updateQuery("fish")
        advanceTimeBy(100)
        viewModel.updateQuery("fish!")
        advanceTimeBy(299)
        assertEquals(emptyList<String>(), repository.searchQueries)

        advanceTimeBy(1)
        runCurrent()
        assertEquals(listOf("fish!"), repository.searchQueries)
    }

    @Test
    fun `deduplicates cursor pages and guards unavailable providers`() = runTest(dispatcher) {
        val repository = FakeGifRepository()
        val viewModel = MediaPickerViewModel(catalog(), repository, animationsEnabled = false)
        viewModel.selectTab(MediaPickerTab.Gif)
        runCurrent()
        viewModel.loadMoreGifs()
        runCurrent()

        assertEquals(listOf("gif-1", "gif-2"), viewModel.uiState.value.gifs.map { it.chatGif.providerId })
        assertFalse(viewModel.uiState.value.animateGifPreviews)

        val unavailable = MediaPickerViewModel(catalog(), FakeGifRepository(available = false), true)
        unavailable.selectTab(MediaPickerTab.Gif)
        runCurrent()
        assertFalse(unavailable.uiState.value.loadingGifs)
        assertEquals(emptyList<GifSearchItem>(), unavailable.uiState.value.gifs)
    }

    @Test
    fun `shared catalog search matches web fields without style filters`() {
        val catalog = catalog()

        assertEquals("wave", catalog.searchEmoji("hand").single().slug)
        assertEquals("sticker-1", catalog.searchStickers("friendly").single().id)
        assertEquals("sticker-1", catalog.searchStickers("expressive").single().id)
    }

    private fun catalog() = ChatMediaCatalog(
        emojiGroups = listOf(
            EmojiCatalogGroup(
                name = "People & Body",
                slug = "people_body",
                emojis = listOf(EmojiCatalogEntry("👋", "waving hand", "wave")),
            ),
        ),
        stickers = listOf(
            StickerCatalogItem(
                id = "sticker-1",
                phrase = "Hello",
                animal = "otter",
                description = "A friendly otter waving",
                sourcePath = "/stickers/aquatic/hello.webp",
                styles = listOf("expressive"),
                keywords = listOf("welcome"),
            ),
        ),
    )
}

private class FakeGifRepository(
    override val available: Boolean = true,
) : GifRepository {
    val searchQueries = mutableListOf<String>()

    override suspend fun trending(cursor: String?, limit: Int): GifPage = if (cursor == null) {
        GifPage(listOf(gifItem("gif-1")), "next")
    } else {
        GifPage(listOf(gifItem("gif-1"), gifItem("gif-2")), null)
    }

    override suspend fun search(query: String, cursor: String?, limit: Int): GifPage {
        searchQueries += query
        return GifPage(listOf(gifItem("search")), null)
    }

    override suspend fun registerShare(gif: ChatGif, query: String?) = Unit

    private fun gifItem(id: String): GifSearchItem = GifSearchItem(
        chatGif = ChatGif(
            provider = "klipy",
            providerId = id,
            title = "Fish",
            description = "A fish",
            sourceUrl = "https://klipy.com/gifs/$id",
            posterUrl = "https://static.klipy.com/$id.gif",
            previewUrl = "https://static.klipy.com/$id.mp4",
            mediaUrl = "https://static.klipy.com/$id-full.mp4",
            width = 480,
            height = 360,
        ),
        animatedPreviewUrl = "https://static.klipy.com/$id-tiny.gif",
    )
}
