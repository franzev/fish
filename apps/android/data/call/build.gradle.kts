plugins {
    id("fish.android.library")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.fish.android.data.call"
}

dependencies {
    api(libs.kotlinx.coroutines.core)
    implementation(project(":core:supabase"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.livekit.android)

    testImplementation(libs.junit4)
    testImplementation(libs.kotlinx.coroutines.test)
}
