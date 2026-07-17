plugins {
    id("fish.android.library")
}

android {
    namespace = "com.fish.android.core.supabase"
}

dependencies {
    api(platform(libs.supabase.bom))
    api(libs.supabase.auth)
    api(libs.supabase.postgrest)
    api(libs.supabase.functions)
    api(libs.supabase.realtime)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.ktor.client.okhttp)
}
