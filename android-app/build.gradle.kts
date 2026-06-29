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

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Serves bundled assets over https://appassets.androidplatform.net so the
    // PWA's native ES modules load with correct MIME/CORS inside the WebView.
    implementation("androidx.webkit:webkit:1.11.0")
}

val webAssetFiles = listOf(
    "index.html",
    "portable-handler.js",
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
        // ES module entry + split modules + pure libs (path preserved → web/src/**)
        include("src/**/*.js")
    }
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}
