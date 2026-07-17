package space.fishhub.android.core.supabase

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.logging.LogLevel
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.serializer.KotlinXSerializer
import kotlinx.serialization.json.Json
import kotlin.time.Duration.Companion.seconds

object SupabaseClientFactory {
    fun create(url: String, publishableKey: String): SupabaseClient? {
        if (url.isBlank() || publishableKey.isBlank()) return null

        val json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            encodeDefaults = true
        }
        return createSupabaseClient(url, publishableKey) {
            defaultLogLevel = LogLevel.NONE
            defaultSerializer = KotlinXSerializer(json)
            install(Auth)
            install(Postgrest) { requireValidSession = true }
            install(Functions) { requireValidSession = true }
            install(Realtime) {
                requireValidSession = true
                reconnectDelay = 5.seconds
            }
        }
    }
}
