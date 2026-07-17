plugins {
    id("fish.android.library")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.fish.android.data.presence"
}

dependencies {
    api(libs.kotlinx.coroutines.core)
    implementation(project(":core:supabase"))
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit4)
    testImplementation(libs.kotlinx.coroutines.test)
}
