<p align="center">
  <img src="favicon.svg" width="80" alt="Filmy logo">
</p>

<h1 align="center">Marcelova Filmova Databaza</h1>

<p align="center">
  <strong>Osobna filmova databaza s 1 700+ filmami, offline podporou a TMDB integraciou.</strong>
</p>

<p align="center">
  <a href="https://filmy-iota.vercel.app"><img alt="Vercel" src="https://img.shields.io/badge/live-filmy--iota.vercel.app-black?style=flat-square&logo=vercel"></a>
  <img alt="PWA" src="https://img.shields.io/badge/PWA-ready-5A0FC8?style=flat-square&logo=pwa">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
  <img alt="Vanilla JS" src="https://img.shields.io/badge/vanilla-JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black">
  <img alt="Version" src="https://img.shields.io/badge/v6.3.0-gold?style=flat-square">
</p>

---

## Rychly start

```
1. Otvor  https://filmy-iota.vercel.app
2. Klikni "Nacitat z GitHubu" — databaza sa stiahne automaticky
3. (volitelne) Nastav GitHub PAT token v ⚙️ pre ukladanie zmien
```

> Aplikacia funguje aj offline — po prvom nacitani ju mozes pouzivat bez internetu.

---

## Funkcie

### Prehlad filmov

| Rezim | Popis |
|-------|-------|
| **Zoznam** | Kompaktne riadky — cislo, nazov, rok, zanre, hodnotenie |
| **Grid** | Karty s posterom, nazvom, rezisom a zanrami — 2-stlpcovy responzivny layout |
| **Posterwall** | Vysoko-hustotna stena posterov — az 6+ stlpcov, cisty vizual bez textu |

### Vyhladavanie a filtrovanie

- **Fuzzy search** (Fuse.js) — hladaj podla nazvu, rezisera, roku
- **Pokrocily filter** — rok, minimalne hodnotenie, krajina, zanre (multi-select), tagy
- **Radenie** — podla cisla, roku, nazvu (A-Z), hodnotenia (%), dlzky
- **Nahodny film** — tlacidlo na nahodny vyber z kolekcie

### Kolekcie

| Kolekcia | Ikona | Popis |
|----------|-------|-------|
| Oblubene | &#9733; | Oznac filmy hviezdou |
| Watchlist | &#128065; | Filmy na pozretie |
| Videne | &#10003; | Filmy uz pozrete s datumom |

### TMDB integracia

- Automaticke hodnotenia, postery, backdrops a trailery
- Admin panel — pridaj film priamo cez TMDB ID
- Manualne parovanie existujucich filmov s TMDB
- Podpora viacerych zdrojov hodnoteni: **TMDB**, **IMDb** (OMDB), **CSFD**

### CSFD Matcher

- Otvorenie externej matcher appky podla TMDB ID
- Import CSV/JSON exportu s CSFD linkami a hodnoteniami

### Statistiky

Interaktivne grafy (Chart.js):
- Zanrove rozlozenie (kolacovy graf)
- Top reziseri (stlpcovy)
- Krajiny povodou (stlpcovy)
- Histogram hodnoteni
- Rozlozenie dlzky filmov

### Prehravanie

| Metoda | Popis |
|--------|-------|
| VLC Protocol | `vlc://` handler — otvor priamo vo VLC |
| Nativny prehravac | `file://` protokol |
| SMB sietove cesty | `\\server\share\film.mkv` |

### Sync a zalohy

- **GitHub Sync** — push/pull `data.json` cez GitHub API (PAT token)
- **Auto-sync** pri starte + planovany auto-push
- **Export** — CSV (Excel), JSON backup, HTML backup (baked-in data), kolazkove PNG
- **Import** — ZIP (EMDB), PDF fallback, JSON restore

### Dalsie

- **6 farebnych tem** — Dark, Slate, Crimson, Forest, Linen, Paper
- **Vlastna akcentova farba** — color picker
- **PWA** — instalovatelna ako nativna aplikacia
- **Offline rezim** — Service Worker s Network-First strategiou
- **Klavesove skratky** — `/` (hladanie), `Esc` (zatvorit), sipky (navigacia)
- **Rychly scroll** — drag handle na pravej strane
- **Podobne filmy** — scoring podla zanrov a rezisera

---

## Temy

| Tema | Typ | Akcentova farba |
|------|-----|-----------------|
| **Dark** | Tmava | `#d4a943` zlata |
| **Slate** | Tmava | `#5aabff` modra |
| **Crimson** | Tmava | `#e85555` cervena |
| **Forest** | Tmava | `#6ac840` zelena |
| **Linen** | Svetla | `#7a5c18` hneda |
| **Paper** | Svetla | `#1a4e7c` modra |

---

## Architektura

```
filmy/
  index.html              Hlavna stranka (35 KB)
  style.css               Vsetky styly + 6 skinov (50 KB)
  app.js                  Cela aplikacna logika (127 KB)
  data.json               Databaza filmov (GitHub sync)
  sw.js                   Service Worker (PWA cache)
  manifest.webmanifest    PWA manifest
  vercel.json             Vercel deploy config + cache headers
  api/
    csfd.js               CSFD API proxy
    omdb.js               OMDB API proxy
```

### Tech stack

| Technologia | Pouzitie |
|-------------|----------|
| **Vanilla JS** | Ziadny framework — cista IIFE architektura |
| **Fuse.js** | Fuzzy vyhladavanie |
| **Chart.js** | Interaktivne grafy v statistikach |
| **PDF.js** | PDF import fallback |
| **JSZip** | ZIP import (EMDB) |
| **Service Worker** | Offline cache, Network-First strategia |
| **Vercel** | Hosting + serverless API proxy |
| **GitHub API** | Sync databazy |
| **TMDB API** | Metdata filmov, postery, trailery |

---

## Nastavenia

| Tab | Obsah |
|-----|-------|
| **Vzhlad** | Tema, skin, akcentova farba |
| **Data** | Import/export, JSON/CSV/HTML/ZIP |
| **Sync** | GitHub PAT token, auto-pull, auto-push |
| **Prehravanie** | VLC/nativny, lokalna/SMB cesta |
| **Nastroje** | TMDB admin, CSFD matcher, manualny match |
| **Danger** | Reset databazy, vycistenie cache |

---

## Vyvoj

Aplikacia je staticka — bez build stepu. Staci editovat subory a commitnut.

```bash
# Lokalne testovanie
npx serve .

# Deploy — push do main vetvy, Vercel sa redeploy automaticky
git push origin main
```

GitHub Action `.github/workflows/bump-sw-cache.yml` automaticky bumps SW cache version pri kazdom push do `main`.

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

<p align="center">
  <sub>Vytvoril Marcel Bucala</sub>
</p>
