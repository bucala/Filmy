# Filmy — Android APK Build Guide

## Prerequisites
- Node.js 18+
- Java 17+ (JDK)
- Android SDK (or Android Studio)

## Option A: Bubblewrap (Recommended — TWA)

Bubblewrap creates a Trusted Web Activity wrapper. The app loads
the deployed PWA URL in Chrome without the address bar.

```bash
# Install bubblewrap
npm i -g @nicolo-ribaudo/bubblewrap   # maintained fork

# Initialize project (uses twa-manifest.json)
cd android
bubblewrap init --manifest ../manifest.webmanifest

# Build APK
bubblewrap build

# Output: app-release-signed.apk
```

### Digital Asset Links

After building, you need to add the SHA-256 fingerprint to your Vercel
deployment so Chrome trusts your app. Create a file:

**`public/.well-known/assetlinks.json`**
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.bucala.filmy",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

Get the fingerprint after building:
```bash
keytool -list -v -keystore android.keystore -alias filmy
```

## Option B: PWABuilder (Easiest)

1. Go to https://www.pwabuilder.com
2. Enter: `https://filmy-iota.vercel.app`
3. Click "Package for stores" → Android
4. Download the generated APK/AAB

No local tools needed — the APK is built in the cloud.

## Option C: Capacitor (Full native shell)

```bash
npm init -y
npm i @capacitor/core @capacitor/cli
npx cap init Filmy com.bucala.filmy --web-dir ..
npx cap add android
npx cap sync
npx cap open android   # opens Android Studio
```

Then build the APK from Android Studio.
