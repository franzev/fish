package space.fishhub.android.feature.chat.logic

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import android.net.Uri
import java.io.File

internal fun String.toMediaUri(): Uri = Uri.parse(this).takeIf { !it.scheme.isNullOrBlank() }
    ?: Uri.fromFile(File(this))
