# Filmy — Android APK Build Guide

The Android app is a **native WebView shell**, not a TWA (Trusted Web
Activity) and not a Capacitor app. It lives in `android-app/` at the repo
root (a Gradle module of the root project `Filmy`), applicationId
`sk.bucala.filmy`. It bundles the PWA's web assets *locally* into the APK
and serves them from `https://appassets.androidplatform.net` via
`androidx.webkit`'s `WebViewAssetLoader` — there is no dependency on the
live Vercel deployment, and no Digital Asset Links / `assetlinks.json`
concept involved.

For downloading the repository and building debug or signed release APKs
directly in Android Studio, follow [ANDROID_STUDIO.md](../ANDROID_STUDIO.md).
Local IDE builds do not require GitHub signing secrets.

> The old `android/` folder (this file's own directory) is a leftover from
> an earlier Bubblewrap-TWA approach that is **no longer used**. See
> `twa-manifest.json.README.md` in this same folder for details. This
> BUILD.md now documents the real build, which happens in `android-app/`.

## What `syncWebAssets` does

`android-app/build.gradle.kts` defines a Gradle `Sync` task,
`syncWebAssets`, that runs automatically before every build (wired into
`preBuild`). It copies these files from the repo root into
`android-app/src/main/assets/web/`:

- `index.html`, `style.css`, `data.js`, `data.json`, `sw.js`,
  `manifest.webmanifest`
- `portable-handler.js`, `favicon.svg`, `apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`
- `src/**/*.js` (all JS modules under `src/`, path preserved)

**If you change any of those files (e.g. edit `src/**/*.js`, `data.json`,
`style.css`), the next Gradle build automatically re-syncs them** — no
manual copy step needed. If you add a *new* top-level web asset file that
isn't already covered by the `src/**/*.js` glob, you must add it to the
`webAssetFiles` list in `android-app/build.gradle.kts` or it won't be
bundled.

## Prerequisites

- JDK 17 (Temurin recommended). The build only requires 17+; there is no
  pinned toolchain (`gradle/gradle-daemon-jvm.properties` deliberately
  leaves criteria empty — a previous auto-generated JetBrains/21 pin broke
  on CI and most local machines, see the comment in that file).
- Gradle 8.10.2 (via the wrapper, or install matching Gradle if you build
  without it) — see `gradle/wrapper/gradle-wrapper.properties`.
- Android SDK with platform `android-35` and `build-tools;35.0.0` (or
  Android Studio, which manages these for you).
- Android Gradle Plugin 8.7.3 (declared in the root `build.gradle.kts`,
  applied to `:android-app`).

No Node.js, Bubblewrap, PWABuilder, or Capacitor is needed.

## Building locally

From the repo root (`C:\GitHub\Filmy`):

```bash
./gradlew :android-app:assembleDebug
```

On Windows, use the checked-in wrapper:

```powershell
.\gradlew.bat :android-app:assembleDebug
```

Output: `android-app/build/outputs/apk/debug/*.apk`

Debug builds use applicationId `sk.bucala.filmy.debug`. For signed release
APK/AAB, see "Signing / release" below.

## How CI builds it

`.github/workflows/android-build.yml` ("Android APK") runs on
`workflow_dispatch`, and on pushes/PRs touching `android-app/**`, the
root Gradle files, or the tracked web asset files (`index.html`,
`src/**/*.js`, `style.css`, `data.js`, `data.json`, `sw.js`,
`manifest.webmanifest`). Steps:

1. Checkout the repo.
2. Set up JDK 17 (Temurin) via `actions/setup-java`.
3. Set up the Android SDK via `android-actions/setup-android` with
   `packages: "platform-tools"` to avoid requesting the removed legacy
   `tools` package.
4. Install `platforms;android-35` and `build-tools;35.0.0` via
   `sdkmanager`.
5. Set up Gradle 8.10.2 via `gradle/actions/setup-gradle`.
6. Run `gradle :android-app:assembleDebug --no-daemon --stacktrace`.
7. Upload the resulting APK as the `filmy-debug-apk` artifact
   (`android-app/build/outputs/apk/debug/*.apk`).

If you change the build in a way CI needs to mirror (new SDK version, new
Gradle version, new web asset paths), update the workflow's `paths:`
filters and the corresponding steps above at the same time as this
section, so this doc can't drift from CI again.

## Signing / release

Release signing accepts either Android Studio's **Generate Signed App Bundle
or APK** wizard or `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` from the build environment.
Incomplete signing fails when packaging a release, not during a normal
debug build or IDE sync. An unsigned release is still rejected explicitly.
Release is not debuggable; debug uses a separate `.debug` application ID.

For local versions, edit `FILMY_RELEASE_VERSION` and
`FILMY_ANDROID_VERSION_CODE` in the root `gradle.properties`. CI environment
variables with the same names take priority. The configuration cache is off
by default so local signing credentials are not serialized into it.

The manual **Signed release** workflow builds and verifies release APK/AAB
using environment secrets. Setup, key backup, version codes, and migration
from older debug installations: [SIGNING.md](../SIGNING.md).
