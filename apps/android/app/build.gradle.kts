fun String.asBuildConfigString(): String =
    "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

val supabaseUrl = providers.environmentVariable("SUPABASE_URL")
    .orElse(providers.environmentVariable("FISH_SUPABASE_URL"))
    .orElse(providers.gradleProperty("FISH_SUPABASE_URL"))
    .getOrElse("")
val supabasePublishableKey = providers.environmentVariable("SUPABASE_PUBLISHABLE_KEY")
    .orElse(providers.environmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"))
    .orElse(providers.environmentVariable("FISH_SUPABASE_PUBLISHABLE_KEY"))
    .orElse(providers.gradleProperty("FISH_SUPABASE_PUBLISHABLE_KEY"))
    .getOrElse("")
val klipyApiKey = providers.environmentVariable("FISH_ANDROID_KLIPY_API_KEY")
    .orElse(providers.environmentVariable("NEXT_PUBLIC_KLIPY_API_KEY"))
    .orElse(providers.gradleProperty("FISH_ANDROID_KLIPY_API_KEY"))
    .getOrElse("")
val klipyClientKey = providers.environmentVariable("FISH_ANDROID_KLIPY_CLIENT_KEY")
    .orElse(providers.environmentVariable("NEXT_PUBLIC_KLIPY_CLIENT_KEY"))
    .orElse(providers.gradleProperty("FISH_ANDROID_KLIPY_CLIENT_KEY"))
    .getOrElse("fish_chat_android")
val releaseStorePath = providers.environmentVariable("FISH_ANDROID_KEYSTORE_PATH")
    .orElse(providers.gradleProperty("FISH_ANDROID_KEYSTORE_PATH"))
val releaseStorePassword = providers.environmentVariable("FISH_ANDROID_KEYSTORE_PASSWORD")
    .orElse(providers.gradleProperty("FISH_ANDROID_KEYSTORE_PASSWORD"))
val releaseKeyAlias = providers.environmentVariable("FISH_ANDROID_KEY_ALIAS")
    .orElse(providers.gradleProperty("FISH_ANDROID_KEY_ALIAS"))
val releaseKeyPassword = providers.environmentVariable("FISH_ANDROID_KEY_PASSWORD")
    .orElse(providers.gradleProperty("FISH_ANDROID_KEY_PASSWORD"))
val releaseSigningValues = listOf(
    releaseStorePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
)
val configuredReleaseSigningValues = releaseSigningValues.count { it.isPresent }
require(configuredReleaseSigningValues == 0 || configuredReleaseSigningValues == releaseSigningValues.size) {
    "Release signing requires all FISH_ANDROID_KEYSTORE_* and FISH_ANDROID_KEY_* values."
}
val hasReleaseSigning = configuredReleaseSigningValues == releaseSigningValues.size

plugins {
    alias(libs.plugins.android.application)
    id("fish.android.application")
    alias(libs.plugins.baselineprofile)
}

android {
    namespace = "com.fish.android"

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStorePath.get())
                storePassword = releaseStorePassword.get()
                keyAlias = releaseKeyAlias.get()
                keyPassword = releaseKeyPassword.get()
            }
        }
    }

    defaultConfig {
        applicationId = "com.fish.android"
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "SUPABASE_URL", supabaseUrl.asBuildConfigString())
        buildConfigField(
            "String",
            "SUPABASE_PUBLISHABLE_KEY",
            supabasePublishableKey.asBuildConfigString(),
        )
        buildConfigField("String", "KLIPY_API_KEY", klipyApiKey.asBuildConfigString())
        buildConfigField("String", "KLIPY_CLIENT_KEY", klipyClientKey.asBuildConfigString())
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            signingConfig = signingConfigs.findByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":feature:chat"))
    implementation(project(":data:chat"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.profileinstaller)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit4)
    baselineProfile(project(":benchmarks"))
}

baselineProfile {
    mergeIntoMain = true
}
