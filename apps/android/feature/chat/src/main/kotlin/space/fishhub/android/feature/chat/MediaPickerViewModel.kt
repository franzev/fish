package space.fishhub.android.feature.chat

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import space.fishhub.android.data.chat.GifPage
import space.fishhub.android.data.chat.GifRepository
import space.fishhub.android.data.chat.GifSearchItem
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class MediaPickerTab { Emoji, Gif, Sticker }

@Immutable
data class MediaPickerUiState(
    val activeTab: MediaPickerTab = MediaPickerTab.Emoji,
    val emojiQuery: String = "",
    val gifQuery: String = "",
    val stickerQuery: String = "",
    val emojiResults: List<EmojiCatalogEntry> = emptyList(),
    val stickers: List<StickerCatalogItem> = emptyList(),
    val gifs: List<GifSearchItem> = emptyList(),
    val gifAvailable: Boolean = false,
    val online: Boolean = true,
    val loadingGifs: Boolean = false,
    val loadingMoreGifs: Boolean = false,
    val gifError: String? = null,
    val nextGifCursor: String? = null,
    val animateGifPreviews: Boolean = true,
)

class MediaPickerViewModel(
    private val catalog: ChatMediaCatalog,
    private val gifRepository: GifRepository,
    animationsEnabled: Boolean,
) : ViewModel() {
    private val mutableUiState = MutableStateFlow(
        MediaPickerUiState(
            stickers = catalog.stickers,
            gifAvailable = gifRepository.available,
            animateGifPreviews = animationsEnabled,
        ),
    )
    val uiState: StateFlow<MediaPickerUiState> = mutableUiState.asStateFlow()

    private var gifRequest: Job? = null
    private var requestRevision = 0L

    fun selectTab(tab: MediaPickerTab) {
        mutableUiState.value = mutableUiState.value.copy(activeTab = tab)
        if (tab == MediaPickerTab.Gif && shouldLoadGifs()) requestGifs(reset = true)
    }

    fun updateQuery(value: String) {
        when (mutableUiState.value.activeTab) {
            MediaPickerTab.Emoji -> mutableUiState.value = mutableUiState.value.copy(
                emojiQuery = value,
                emojiResults = catalog.searchEmoji(value),
            )
            MediaPickerTab.Sticker -> mutableUiState.value = mutableUiState.value.copy(
                stickerQuery = value,
                stickers = catalog.searchStickers(value),
            )
            MediaPickerTab.Gif -> {
                if (value == mutableUiState.value.gifQuery) return
                mutableUiState.value = mutableUiState.value.copy(gifQuery = value)
                requestGifs(reset = true, debounce = true)
            }
        }
    }

    fun restoreGifQuery(query: String) {
        if (query == mutableUiState.value.gifQuery) return
        mutableUiState.value = mutableUiState.value.copy(gifQuery = query)
        if (mutableUiState.value.activeTab == MediaPickerTab.Gif) {
            requestGifs(reset = true)
        }
    }

    fun setOnline(online: Boolean) {
        if (online == mutableUiState.value.online) return
        mutableUiState.value = mutableUiState.value.copy(online = online)
        if (!online) {
            gifRequest?.cancel()
            mutableUiState.value = mutableUiState.value.copy(
                loadingGifs = false,
                loadingMoreGifs = false,
            )
        } else if (mutableUiState.value.activeTab == MediaPickerTab.Gif && shouldLoadGifs()) {
            requestGifs(reset = true)
        }
    }

    fun retryGifs() = requestGifs(reset = true)

    fun loadMoreGifs() {
        val state = mutableUiState.value
        if (state.nextGifCursor == null || state.loadingGifs || state.loadingMoreGifs) return
        requestGifs(reset = false)
    }

    fun toggleGifAnimations() {
        mutableUiState.value = mutableUiState.value.copy(
            animateGifPreviews = !mutableUiState.value.animateGifPreviews,
        )
    }

    private fun shouldLoadGifs(): Boolean {
        val state = mutableUiState.value
        return state.gifAvailable && state.online && state.gifs.isEmpty() && !state.loadingGifs
    }

    private fun requestGifs(reset: Boolean, debounce: Boolean = false) {
        gifRequest?.cancel()
        val revision = ++requestRevision
        val state = mutableUiState.value
        if (!state.gifAvailable || !state.online) {
            mutableUiState.value = state.copy(
                gifs = if (reset) emptyList() else state.gifs,
                nextGifCursor = if (reset) null else state.nextGifCursor,
                loadingGifs = false,
                loadingMoreGifs = false,
                gifError = null,
            )
            return
        }
        mutableUiState.value = state.copy(
            gifs = if (reset) emptyList() else state.gifs,
            nextGifCursor = if (reset) null else state.nextGifCursor,
            loadingGifs = reset,
            loadingMoreGifs = !reset,
            gifError = null,
        )
        gifRequest = viewModelScope.launch {
            if (debounce) delay(SearchDebounceMs)
            try {
                val current = mutableUiState.value
                val page = if (current.gifQuery.isBlank()) {
                    gifRepository.trending(cursor = if (reset) null else current.nextGifCursor)
                } else {
                    gifRepository.search(
                        query = current.gifQuery,
                        cursor = if (reset) null else current.nextGifCursor,
                    )
                }
                if (revision == requestRevision) publishPage(page, reset)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                if (revision == requestRevision) {
                    mutableUiState.value = mutableUiState.value.copy(
                        loadingGifs = false,
                        loadingMoreGifs = false,
                        gifError = "GIFs did not load yet. Try again.",
                    )
                }
            }
        }
    }

    private fun publishPage(page: GifPage, reset: Boolean) {
        val existing = if (reset) emptyList() else mutableUiState.value.gifs
        val deduplicated = (existing + page.items).distinctBy { item ->
            "${item.chatGif.provider}:${item.chatGif.providerId}"
        }
        mutableUiState.value = mutableUiState.value.copy(
            gifs = deduplicated,
            nextGifCursor = page.nextCursor,
            loadingGifs = false,
            loadingMoreGifs = false,
            gifError = null,
        )
    }

    private companion object {
        const val SearchDebounceMs = 300L
    }
}
