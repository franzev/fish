package space.fishhub.android.data.chat

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class TestAttachmentProvider : ContentProvider() {
    override fun onCreate(): Boolean = true

    override fun getType(uri: Uri): String? = entries[uri.lastPathSegment]?.mimeType

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor? {
        val entry = entries[uri.lastPathSegment] ?: return null
        val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        return MatrixCursor(columns).apply {
            addRow(columns.map { column ->
                when (column) {
                    OpenableColumns.DISPLAY_NAME -> entry.displayName
                    OpenableColumns.SIZE -> entry.file.length()
                    else -> null
                }
            })
        }
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        val entry = entries[uri.lastPathSegment] ?: throw java.io.FileNotFoundException()
        return ParcelFileDescriptor.open(entry.file, ParcelFileDescriptor.MODE_READ_ONLY)
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0

    companion object {
        private val entries = ConcurrentHashMap<String, Entry>()

        fun register(file: File, displayName: String, mimeType: String?): Uri {
            val id = UUID.randomUUID().toString()
            entries[id] = Entry(file, displayName, mimeType)
            return Uri.parse("content://space.fishhub.android.data.chat.testfiles/$id")
        }

        fun clear() = entries.clear()

        private data class Entry(val file: File, val displayName: String, val mimeType: String?)
    }
}
