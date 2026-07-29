plugins {
    id("fish.android.library")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "space.fishhub.android.data.friends"
}

dependencies {
    api(libs.kotlinx.coroutines.core)
    implementation(project(":core:supabase"))
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit4)
    testImplementation(libs.ktor.client.mock)
    testImplementation(libs.kotlinx.coroutines.test)
}
