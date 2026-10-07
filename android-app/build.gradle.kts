import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
}

// Signing material comes from the build environment, never from source control.
val releaseSigningEnv = listOf(
    "ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"
).associateWith { providers.environmentVariable(it).orNull }
val hasReleaseSigning = releaseSigningEnv.values.all { !it.isNullOrBlank() }

// Generate Signed App Bundle / APK injects these properties. AGP handles
// the actual signing; only check completeness here, without saving secrets.
val studioSigningProperties = listOf(
    "android.injected.signing.store.file", "android.injected.signing.store.password",
    "android.injected.signing.key.alias", "android.injected.signing.key.password"
).associateWith { providers.gradleProperty(it).orNull }
val hasStudioSigning = studioSigningProperties.values.all { !it.isNullOrBlank() }

android {
    namespace = "sk.bucala.filmy"
    compileSdk = 35

    defaultConfig {
        applicationId = "sk.bucala.filmy"
        // 24 (Android 7.0) is the floor: no code path here needs API 26+,
        // and it covers older unsupported devices (e.g. Xiaomi Mi Pad 3).
        minSdk = 24
        targetSdk = 35
        versionCode = (providers.environmentVariable("FILMY_ANDROID_VERSION_CODE")
            .orNull?.takeIf { it.isNotBlank() }
            ?: providers.gradleProperty("FILMY_ANDROID_VERSION_CODE")
                .orNull?.takeIf { it.isNotBlank() }
            ?: "1").toInt().also {
                require(it in 1..2100000000) { "Invalid Android version code" }
            }
        versionName = providers.environmentVariable("FILMY_RELEASE_VERSION")
            .orNull?.takeIf { it.isNotBlank() }
            ?: providers.gradleProperty("FILMY_RELEASE_VERSION")
                .orNull?.takeIf { it.isNotBlank() }
            ?: "1.0.0"
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseSigningEnv.getValue("ANDROID_KEYSTORE_PATH")!!)
                storePassword = releaseSigningEnv.getValue("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = releaseSigningEnv.getValue("ANDROID_KEY_ALIAS")
                keyPassword = releaseSigningEnv.getValue("ANDROID_KEY_PASSWORD")
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        getByName("release") {
            isDebuggable = false
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

abstract class ValidateReleaseSigning : DefaultTask() {
    @get:Input
    abstract val signingConfigured: Property<Boolean>

    @TaskAction
    fun validate() {
        if (!signingConfigured.get()) {
            throw GradleException("Release signing is required. Use Android Studio's Generate Signed App Bundle / APK wizard, or configure ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD.")
        }
    }
}

// Refuse to package an unsigned release, including when invoked via `build`.
val validateReleaseSigning = tasks.register<ValidateReleaseSigning>("validateReleaseSigning") {
    signingConfigured.set(hasReleaseSigning || hasStudioSigning)
}
tasks.matching { it.name in listOf("packageRelease", "signReleaseBundle") }.configureEach {
    dependsOn(validateReleaseSigning)
}

dependencies {
    // Serves bundled assets over https://appassets.androidplatform.net so the
    // PWA's native ES modules load with correct MIME/CORS inside the WebView.
    implementation("androidx.webkit:webkit:1.11.0")
    testImplementation("junit:junit:4.13.2")
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
