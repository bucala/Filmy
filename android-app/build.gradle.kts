import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
}

android {
    namespace = "sk.bucala.filmy"
    compileSdk = 35

    defaultConfig {
        applicationId = "sk.bucala.filmy"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
}

val webAssetFiles = listOf(
    "index.html",
    "app.js",
    "style.css",
    "data.js",
    "data.json",
    "sw.js",
    "manifest.webmanifest",
    "favicon.svg",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png"
)

val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    into(layout.projectDirectory.dir("src/main/assets/web"))
    from(rootProject.projectDir) {
        include(webAssetFiles)
    }
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}
