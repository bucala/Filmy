# `twa-manifest.json` is obsolete

This file is a **leftover from an earlier Bubblewrap TWA (Trusted Web
Activity) approach** that has been superseded and is no longer used to
build the Android app.

The real, currently-built Android app is a native WebView shell in
`android-app/` at the repo root (applicationId `sk.bucala.filmy`), which
bundles the PWA's web assets locally and has no TWA / Digital Asset
Links dependency at all. See `android/BUILD.md` in this folder for the
current build process.

`twa-manifest.json` is kept only for historical reference (it documents
what packageId, host, and icons the old Bubblewrap setup used). Do not
treat its `signing` block as live configuration — the keystore
(`android.keystore`) it refers to does not exist in this repo, and its
password fields have been replaced with the placeholder
`UNUSED_LEGACY_CONFIG` (they previously held a real, weak plaintext
password that had no reason to still be committed). If you ever revive a
TWA/Bubblewrap build, generate a fresh keystore and credentials — do not
reuse anything from this file.
