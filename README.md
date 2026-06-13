# 🎬 Filmová Databáza

Osobná webová databáza filmov s offline podporou, GitHub synchronizáciou a TMDB integráciou.

**Live:** https://filmy-iota.vercel.app

---

## ✨ Funkcie

- **GitHub Sync** — Načítanie databázy priamo z GitHub (bez tokenu). Push vyžaduje PAT token.
- **TMDB integrácia** — Automatické hodnotenia, plagáty a trailer pre každý film
- **Offline podpora** — Service Worker cachuje aplikáciu pre prácu bez internetu
- **Prehrávanie filmov** — Podpora VLC Protocol Handler, natívny prehrávač (file://), SMB sieťové cesty
- **Filtrovanie** — Podľa žánru, roku, hodnotenia, krajiny, obľúbených, watchlistu, videných
- **Štatistiky** — Prehľad kolekcie s grafmi (Chart.js)
- **Témy** — Dark / Linen / Paper skin
- **PWA** — Inštalovateľná ako aplikácia

---

## 🚀 Použitie

1. Otvor https://filmy-iota.vercel.app
2. Klikni **Načítať z GitHubu** — databáza sa stiahne automaticky
3. Pre ukladanie zmien nastav GitHub PAT token v nastaveniach ⚙️

---

## ⚙️ Nastavenia

| Sekcia | Popis |
|--------|-------|
| GitHub Sync | PAT token pre push, auto-pull pri štarte |
| Prehrávanie filmov | VLC / natívny prehrávač, lokálna / SMB cesta |
| TMDB | API kľúč pre automatické metadáta |
| Admin | Pridanie filmu cez TMDB ID |

---

## 🗂️ Štruktúra

```
index.html   — Hlavná stránka
app.js       — Celá logika aplikácie
style.css    — Štýly
sw.js        — Service Worker
data.json    — Databáza filmov (GitHub)
manifest.webmanifest — PWA manifest
```

---

## 🤖 Android aplikácia

Repo obsahuje Android Studio projekt v module `android-app`.

### Lokálne cez Android Studio

1. Otvor koreň repozitára `Filmy` v Android Studio.
2. Počkaj na Gradle sync.
3. Spusti konfiguráciu `android-app` alebo task `:android-app:assembleDebug`.

Gradle pred buildom automaticky skopíruje web appku (`index.html`, `app.js`, `style.css`, `data.json`, manifest a ikony) do Android assets a spustí ju vo WebView.

### GitHub Actions

Workflow **Android APK** zostaví debug APK pri PR, pushi do `Perplexity` / `main`, alebo manuálne cez **Run workflow** v GitHub Actions.

Výsledný APK je v artifacte `filmy-debug-apk`.

---

## 📋 Changelog

Pozri [CHANGELOG.md](CHANGELOG.md)
