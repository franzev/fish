package space.fishhub.app.feature.auth

import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation

internal data class FieldSpec(
    val label: String,
    val value: String,
    val onChange: (String) -> Unit,
    val hint: String? = null,
    val notice: String? = null,
    val error: String? = null,
    val keyboardType: KeyboardType = KeyboardType.Text,
    val visualTransformation: VisualTransformation = VisualTransformation.None,
)

internal data class LinkSpec(
    val text: String,
    val onClick: () -> Unit,
    val prefix: String = "",
)

internal data class PageSpec(
    val title: String,
    val body: String? = null,
    val notice: String? = null,
    val fields: List<FieldSpec> = emptyList(),
    val primary: String,
    val onPrimary: () -> Unit,
    val secondary: String? = null,
    val onSecondary: (() -> Unit)? = null,
    val links: List<LinkSpec> = emptyList(),
)
