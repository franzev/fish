package space.fishhub.android.feature.chat

import android.content.Context
import androidx.compose.runtime.Immutable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Immutable
@Serializable
data class EmojiCatalogEntry(
    val emoji: String,
    val name: String,
    val slug: String,
)

@Immutable
@Serializable
data class EmojiCatalogGroup(
    val name: String,
    val slug: String,
    val emojis: List<EmojiCatalogEntry>,
)

@Immutable
@Serializable
data class StickerCatalogItem(
    val id: String,
    val phrase: String,
    val animal: String,
    val description: String,
    @SerialName("src") val sourcePath: String,
    val styles: List<String>,
    val keywords: List<String>,
) {
    val assetPath: String get() = sourcePath.removePrefix("/stickers/")
}

@Immutable
data class ChatMediaCatalog(
    val emojiGroups: List<EmojiCatalogGroup>,
    val stickers: List<StickerCatalogItem>,
) {
    private val stickersById = stickers.associateBy(StickerCatalogItem::id)

    fun sticker(stickerId: String): StickerCatalogItem? = stickersById[stickerId]
    fun isKnownSticker(stickerId: String): Boolean = sticker(stickerId) != null

    companion object {
        val Empty = ChatMediaCatalog(emptyList(), emptyList())

        fun load(context: Context): ChatMediaCatalog {
            val json = Json { ignoreUnknownKeys = true }
            val assets = context.applicationContext.assets
            val emoji = assets.open("emoji-groups.json").bufferedReader().use {
                json.decodeFromString<List<EmojiCatalogGroup>>(it.readText())
            }
            val stickers = assets.open("sticker-catalog.json").bufferedReader().use {
                json.decodeFromString<List<StickerCatalogItem>>(it.readText())
            }
            return ChatMediaCatalog(emojiGroups = emoji, stickers = stickers)
        }
    }
}

internal fun ChatMediaCatalog.searchEmoji(query: String): List<EmojiCatalogEntry> {
    val normalized = query.trim().lowercase()
    if (normalized.isEmpty()) return emptyList()
    return emojiGroups.flatMap(EmojiCatalogGroup::emojis).filter { entry ->
        entry.name.lowercase().contains(normalized) || entry.slug.lowercase().contains(normalized)
    }
}

internal fun ChatMediaCatalog.searchStickers(query: String): List<StickerCatalogItem> {
    val normalized = query.trim().lowercase()
    if (normalized.isEmpty()) return stickers
    return stickers.filter { sticker ->
        sequenceOf(sticker.phrase, sticker.animal, sticker.description)
            .plus(sticker.keywords.asSequence())
            .plus(sticker.styles.asSequence())
            .any { value -> value.lowercase().contains(normalized) }
    }
}
