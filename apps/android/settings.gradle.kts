pluginManagement {
    includeBuild("build-logic")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven(url = "https://jitpack.io")
    }
}

rootProject.name = "fish-android"

include(":app")
include(":core:designsystem")
include(":core:supabase")
include(":data:chat")
include(":data:call")
include(":data:presence")
include(":feature:chat")
include(":feature:call")
include(":feature:presence")
include(":feature:settings")
include(":benchmarks")
