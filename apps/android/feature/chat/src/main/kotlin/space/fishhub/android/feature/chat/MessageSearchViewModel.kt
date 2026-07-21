package space.fishhub.android.feature.chat

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.MessageSearchCursor
import space.fishhub.android.data.chat.MessageSearchHit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@Immutable
data class MessageSearchResultUiModel(
    val id: String,
    val senderLabel: String,
    val dateTimeLabel: String,
    val excerpt: String,
    val accessibilityLabel: String,
)

@Immutable
data class MessageSearchUiState(
    val visible: Boolean = false,
    val query: String = "",
    val submittedQuery: String = "",
    val results: List<MessageSearchResultUiModel> = emptyList(),
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val nextCursor: MessageSearchCursor? = null,
    val notice: String? = null,
)

class MessageSearchViewModel(
    private val repository: ChatRepository,
    private val formatter: ChatTextFormatter,
    private val debounceMs: Long = SearchDebounceMs,
) : ViewModel() {
    private val mutableUiState = MutableStateFlow(MessageSearchUiState())
    val uiState: StateFlow<MessageSearchUiState> = mutableUiState.asStateFlow()

    private var activeConversation: AuthorizedConversation? = null
    private var requestJob: Job? = null
    private var requestGeneration = 0L

    fun open(conversation: AuthorizedConversation) {
        if (mutableUiState.value.visible &&
            activeConversation?.conversationId == conversation.conversationId
        ) return
        cancelRequest()
        activeConversation = conversation
        mutableUiState.value = MessageSearchUiState(visible = true)
    }

    fun close() {
        cancelRequest()
        activeConversation = null
        mutableUiState.value = MessageSearchUiState()
    }

    fun updateQuery(value: String) {
        if (!mutableUiState.value.visible || value == mutableUiState.value.query) return
        cancelRequest()
        val generation = ++requestGeneration
        mutableUiState.value = mutableUiState.value.copy(
            query = value,
            submittedQuery = "",
            results = emptyList(),
            loading = false,
            loadingMore = false,
            nextCursor = null,
            notice = null,
        )
        if (value.trim().isBlank()) return
        requestJob = viewModelScope.launch {
            delay(debounceMs)
            if (generation == requestGeneration) {
                startInitialSearch(value.trim(), generation)
            }
        }
    }

    fun submitQuery() {
        val query = mutableUiState.value.query.trim()
        cancelRequest()
        val generation = ++requestGeneration
        if (query.isBlank()) {
            mutableUiState.update {
                it.copy(
                    submittedQuery = "",
                    results = emptyList(),
                    loading = false,
                    loadingMore = false,
                    nextCursor = null,
                    notice = null,
                )
            }
            return
        }
        startInitialSearch(query, generation)
    }

    fun retry() {
        val state = mutableUiState.value
        if (state.submittedQuery.isBlank()) return
        if (state.results.isNotEmpty() && state.nextCursor != null) {
            loadMore()
        } else {
            cancelRequest()
            startInitialSearch(state.submittedQuery, ++requestGeneration)
        }
    }

    fun loadMore() {
        val state = mutableUiState.value
        val conversation = activeConversation ?: return
        val cursor = state.nextCursor ?: return
        if (state.loading || state.loadingMore || state.submittedQuery.isBlank()) return

        cancelRequest()
        val generation = ++requestGeneration
        mutableUiState.value = state.copy(loadingMore = true, notice = null)
        requestJob = viewModelScope.launch {
            try {
                when (
                    val result = repository.searchMessages(
                        conversationId = conversation.conversationId,
                        query = state.submittedQuery,
                        cursor = cursor,
                        limit = SearchPageSize,
                    )
                ) {
                    is ChatResult.Success -> if (generation == requestGeneration) {
                        publishPage(result.value.items, result.value.nextCursor, append = true)
                    }
                    is ChatResult.Failure -> if (generation == requestGeneration) {
                        mutableUiState.update {
                            it.copy(loadingMore = false, notice = result.message)
                        }
                    }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                if (generation == requestGeneration) {
                    mutableUiState.update {
                        it.copy(loadingMore = false, notice = SearchFailureNotice)
                    }
                }
            }
        }
    }

    private fun startInitialSearch(query: String, generation: Long) {
        val conversation = activeConversation ?: return
        mutableUiState.update {
            it.copy(
                submittedQuery = query,
                results = emptyList(),
                loading = true,
                loadingMore = false,
                nextCursor = null,
                notice = null,
            )
        }
        requestJob = viewModelScope.launch {
            try {
                when (
                    val result = repository.searchMessages(
                        conversationId = conversation.conversationId,
                        query = query,
                        cursor = null,
                        limit = SearchPageSize,
                    )
                ) {
                    is ChatResult.Success -> if (generation == requestGeneration) {
                        publishPage(result.value.items, result.value.nextCursor, append = false)
                    }
                    is ChatResult.Failure -> if (generation == requestGeneration) {
                        mutableUiState.update {
                            it.copy(loading = false, notice = result.message)
                        }
                    }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                if (generation == requestGeneration) {
                    mutableUiState.update {
                        it.copy(loading = false, notice = SearchFailureNotice)
                    }
                }
            }
        }
    }

    private fun publishPage(
        items: List<MessageSearchHit>,
        nextCursor: MessageSearchCursor?,
        append: Boolean,
    ) {
        val conversation = activeConversation ?: return
        val existing = if (append) mutableUiState.value.results else emptyList()
        val mapped = items.map { it.toUiModel(conversation) }
        mutableUiState.update {
            it.copy(
                results = (existing + mapped).distinctBy(MessageSearchResultUiModel::id),
                loading = false,
                loadingMore = false,
                nextCursor = nextCursor,
                notice = null,
            )
        }
    }

    private fun MessageSearchHit.toUiModel(
        conversation: AuthorizedConversation,
    ): MessageSearchResultUiModel {
        val senderLabel = if (senderId == conversation.currentUserId) {
            YouLabel
        } else {
            conversation.participantDisplayName
        }
        val excerpt = body.replace(WhitespacePattern, " ").trim()
        val dateTimeLabel = listOf(
            formatter.dateLabel(createdAt),
            formatter.timeLabel(createdAt),
        ).filter(String::isNotBlank).joinToString(", ")
        return MessageSearchResultUiModel(
            id = id,
            senderLabel = senderLabel,
            dateTimeLabel = dateTimeLabel,
            excerpt = excerpt,
            accessibilityLabel = listOf(senderLabel, excerpt.trimEnd('.', '!', '?'), dateTimeLabel)
                .filter(String::isNotBlank)
                .joinToString(". "),
        )
    }

    private fun cancelRequest() {
        requestJob?.cancel()
        requestJob = null
        requestGeneration += 1
    }

    private companion object {
        const val SearchDebounceMs = 300L
        const val SearchPageSize = 25
        const val YouLabel = "You"
        const val SearchFailureNotice =
            "Search is taking a little longer. Check your connection and try again."
        val WhitespacePattern = Regex("\\s+")
    }
}
