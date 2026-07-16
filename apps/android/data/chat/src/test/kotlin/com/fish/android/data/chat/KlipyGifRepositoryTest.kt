package com.fish.android.data.chat

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class KlipyGifRepositoryTest {
    private val json = Json

    @Test
    fun `maps required renditions without changing punctuation`() {
        val item = mapKlipyResult(result(source = "https://klipy.com/gifs/fish-1"))

        requireNotNull(item)
        assertEquals("A fish says: yes!", item.chatGif.description)
        assertEquals("https://static2.klipy.com/tiny.gif", item.animatedPreviewUrl)
        assertEquals(480, item.chatGif.width)
    }

    @Test
    fun `rejects a non-KLIPY media host`() {
        val item = mapKlipyResult(
            result(source = "https://klipy.com/gifs/fish-1").toMutableMap().apply {
                val formats = getValue("media_formats").jsonObject.toMutableMap()
                formats["mp4"] = json.parseToJsonElement(
                    """{"url":"https://example.com/media.mp4","dims":[480,360]}""",
                )
                put("media_formats", kotlinx.serialization.json.JsonObject(formats))
            }.let(::JsonObject),
        )

        assertNull(item)
    }

    @Test
    fun `skips malformed result fields instead of failing the page`() {
        val malformed = result(source = "https://klipy.com/gifs/fish-1").toMutableMap().apply {
            put("id", json.parseToJsonElement("{\"unexpected\":true}"))
        }.let(::JsonObject)

        assertNull(mapKlipyResult(malformed))
    }

    private fun result(source: String) = json.parseToJsonElement(
        """
        {
          "id":"fish-1",
          "title":"Fish says yes",
          "content_description":"A fish says: yes!",
          "itemurl":"$source",
          "media_formats":{
            "preview":{"url":"https://static.klipy.com/poster.gif","dims":[480,360]},
            "tinygif":{"url":"https://static2.klipy.com/tiny.gif","dims":[240,180]},
            "tinymp4":{"url":"https://static.klipy.com/preview.mp4","dims":[240,180]},
            "mp4":{"url":"https://static.klipy.com/media.mp4","dims":[480,360]}
          }
        }
        """.trimIndent(),
    ).jsonObject
}
