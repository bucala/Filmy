<p align="center">
  <a href="https://filmy-iota.vercel.app">
    <img src="https://github.com/bucala/Filmy/raw/main/favicon.svg" width="96" alt="Filmy — MFD logo">
  </a>
</p>

<h1 align="center">Marcelova Filmová Databáza</h1>

<p align="center">
  <em>Osobná filmová databáza s <b>1 700+</b> filmami, offline podporou, TMDB integráciou a natívnymi appkami.</em>
</p>

<p align="center">
  <a href="https://filmy-iota.vercel.app"><img alt="Live" src="https://img.shields.io/badge/▸_LIVE_DEMO-filmy--iota.vercel.app-0a0a0f?style=for-the-badge&logo=vercel&logoColor=white"></a>
</p>

<p align="center">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white">
  <img alt="Vanilla JS" src="https://img.shields.io/badge/Vanilla_JS-zero_deps-F7DF1E?style=flat-square&logo=javascript&logoColor=black">
  <img alt="Offline" src="https://img.shields.io/badge/offline-first-43a047?style=flat-square">
  <img alt="Android" src="https://img.shields.io/badge/Android-APK-3DDC84?style=flat-square&logo=android&logoColor=white">
  <img alt="Windows" src="https://img.shields.io/badge/Windows-Electron-357EC7?style=flat-square&logo=electron&logoColor=white">
  <img alt="Version" src="https://img.shields.io/badge/v7.0.0-d4a943?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
</p>

---

## Rýchly štart

```
1.  Otvor   https://filmy-iota.vercel.app
2.  Klikni  ⚙️ → Sync → "Načítať z GitHubu"
3.  Hotovo — databáza sa stiahne automaticky
```

> **Offline:** po prvom načítaní funguje aj bez internetu — Service Worker všetko cachuje.

---

## Prehľad funkcií

<table>
<tr>
<td width="50%">

### Zobrazenie filmov
| Režim | Popis |
|-------|-------|
| **Zoznam** | Kompaktné riadky — číslo, názov, rok, žánre, hodnotenie |
| **Grid** | Karty s posterom, režisérom a žánrami — 2‑stĺpcový layout |
| **Posterwall** | Hustá stena posterov — 6+ stĺpcov, čistý vizuál |

</td>
<td width="50%">

### Kolekcie
| Kolekcia | Popis |
|----------|-------|
| &#9733; **Obľúbené** | Označ filmy hviezdou |
| &#128065; **Watchlist** | Filmy na pozeranie |
| &#10003; **Videné** | Pozreté filmy s dátumom |

</td>
</tr>
<tr>
<td>

### Vyhľadávanie a filtre
- **Fuzzy search** (Fuse.js) — názov, režisér, rok
- **Pokročilý filter** — rok, min. hodnotenie, krajina, žánre, tagy
- **Radenie** — číslo, rok, názov (A→Z), hodnotenie (%), dĺžka
- **Náhodný film** — jedno kliknutie na náhodný výber
- **Dekádový prehľad** — filmy zoskupené podľa dekád

</td>
<td>

### TMDB integrácia
- Automatické hodnotenia, postery, backdrops a trailery
- Admin panel — pridaj film cez TMDB ID
- Manuálne párovanie existujúcich filmov
- Zdroje hodnotení: **TMDB** · **IMDb** (OMDB) · **ČSFD**
- **ČSFD Matcher** — import CSV/JSON s hodnoteniami

</td>
</tr>
</table>

### Štatistiky

Interaktívne grafy (Chart.js): žánrové rozloženie · top režiséri · krajiny pôvodu · histogram hodnotení · rozloženie dĺžky filmov

### Prehrávanie filmov

| Metóda | Protokol | Platforma |
|--------|----------|-----------|
| **MPC‑HC** | `mpc://` | Windows |
| **VLC** | `vlc://` | Windows, Android |
| **Portable MPC/VLC** | `portable://` | Windows (USB) |
| **SMB sieť** | `vlc://smb://server/path` | Android, Windows |
| **Lokálna cesta** | `W:\Movies\film.mkv` | Windows |

<details>
<summary><b>Nastavenie prehrávača na PC</b></summary>

1. Stiahni `register-mpc.reg` alebo `register-vlc.reg` zo zložky `setup/`
2. Spusti ako správca — zaregistruje `mpc://` alebo `vlc://` handler
3. V nastaveniach vyber prehrávač a režim cesty (lokálna / SMB)
4. Klikni **Prehráť** na filme — cesta sa skopíruje + otvorí sa prehrávač

Pre **Portable** režim: stiahni `.reg` a `.bat` z nastavení → ulož do `W:\Portable-Handler\`
</details>

### Sync a zálohy

| Funkcia | Popis |
|---------|-------|
| **GitHub Sync** | Push / pull `data.json` cez GitHub API (PAT token) |
| **Auto-sync** | Automatický pull pri štarte + plánovaný auto-push |
| **Export** | CSV · JSON · HTML (baked-in dáta) · kolážové PNG |
| **Import** | ZIP (EMDB) · PDF fallback · JSON restore |
| **Hromadný výber** | Označenie viacerých filmov + hromadné akcie |
| **Rýchle pridanie** | Pridaj film priamo cez TMDB z nastavení |

---

## Témy

<table>
<tr>
<td align="center"><img src="https://img.shields.io/badge/●-0a0a0f?style=flat-square" width="12"> <b>Dark</b><br><sub><img src="https://img.shields.io/badge/accent-d4a943?style=flat-square&logoColor=white" height="14"></sub></td>
<td align="center"><img src="https://img.shields.io/badge/●-1a1e2e?style=flat-square" width="12"> <b>Slate</b><br><sub><img src="https://img.shields.io/badge/accent-5aabff?style=flat-square&logoColor=white" height="14"></sub></td>
<td align="center"><img src="https://img.shields.io/badge/●-1a0a0a?style=flat-square" width="12"> <b>Crimson</b><br><sub><img src="https://img.shields.io/badge/accent-e85555?style=flat-square&logoColor=white" height="14"></sub></td>
<td align="center"><img src="https://img.shields.io/badge/●-0a1a0a?style=flat-square" width="12"> <b>Forest</b><br><sub><img src="https://img.shields.io/badge/accent-6ac840?style=flat-square&logoColor=white" height="14"></sub></td>
<td align="center"><img src="https://img.shields.io/badge/●-f5f0e6?style=flat-square" width="12"> <b>Linen</b><br><sub><img src="https://img.shields.io/badge/accent-7a5c18?style=flat-square&logoColor=white" height="14"></sub></td>
<td align="center"><img src="https://img.shields.io/badge/●-f0f4f8?style=flat-square" width="12"> <b>Paper</b><br><sub><img src="https://img.shields.io/badge/accent-1a4e7c?style=flat-square&logoColor=white" height="14"></sub></td>
<td align="center"><img src="https://img.shields.io/badge/●-auto?style=flat-square" width="12"> <b>Auto</b><br><sub>systémová</sub></td>
</tr>
</table>

Vlastná akcentová farba cez color picker v nastaveniach.

---

## Platformy

<table>
<tr>
<td align="center" width="33%">
  <img src="https://img.shields.io/badge/Web-PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA"><br>
  <sub><b>filmy-iota.vercel.app</b></sub><br>
  <sub>Inštalovateľná ako natívna appka</sub>
</td>
<td align="center" width="33%">
  <img src="https://img.shields.io/badge/Android-APK-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android"><br>
  <sub><b>WebView + immersive fullscreen</b></sub><br>
  <sub>Build cez GitHub Actions alebo Android Studio</sub>
</td>
<td align="center" width="33%">
  <img src="https://img.shields.io/badge/Windows-Electron-357EC7?style=for-the-badge&logo=electron&logoColor=white" alt="Windows"><br>
  <sub><b>Standalone desktopová appka</b></sub><br>
  <sub>npm install → npm start</sub>
</td>
</tr>
</table>

<details>
<summary><b>Android build</b></summary>

**Lokálne:**
1. Otvor koreň repozitára v Android Studio
2. Počkaj na Gradle sync
3. Spusti `:android-app:assembleDebug`

**GitHub Actions:**
Workflow **Android APK** zostaví debug APK pri PR, push do `main`, alebo manuálne cez **Run workflow**. Výsledok: artifact `filmy-debug-apk`.

Gradle automaticky skopíruje web appku do Android assets.
</details>

<details>
<summary><b>Windows (Electron) build</b></summary>

```bash
cd desktop
npm install
npm start          # dev režim
npm run build      # produkčný build
```

Pozri [`desktop/BUILD.md`](desktop/BUILD.md) pre detaily.
</details>

---

## Architektúra

```
Filmy/
├── index.html               Hlavná stránka
├── style.css                Všetky štýly + 7 skinov
├── app.js                   Aplikačná logika (IIFE)
├── portable-handler.js      Portable prehrávač modul
├── data.json                Databáza filmov (GitHub sync)
├── sw.js                    Service Worker (Network-First)
├── manifest.webmanifest     PWA manifest
├── favicon.svg              Logo — filmový pás s "MFD"
├── vercel.json              Vercel deploy + cache headers
├── api/
│   ├── csfd.js              ČSFD API proxy
│   └── omdb.js              OMDB API proxy
├── setup/
│   ├── MPC-Handler/         register-mpc.reg + mpc-run.bat
│   └── VLC-Handler/         register-vlc.reg + vlc-run.bat
├── android-app/             Android Studio modul (WebView)
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/.../MainActivity.java
│       └── res/drawable/ic_launcher_foreground.xml
├── android/                 TWA konfigurácia
│   └── twa-manifest.json
└── desktop/                 Electron wrapper
    ├── main.js
    ├── preload.js
    └── package.json
```

### Tech stack

| Technológia | Použitie |
|-------------|----------|
| **Vanilla JS** | Žiadny framework — čistá IIFE architektúra |
| **Fuse.js** | Fuzzy vyhľadávanie |
| **Chart.js** | Interaktívne grafy v štatistikách |
| **PDF.js** | PDF import fallback |
| **JSZip** | ZIP import (EMDB) |
| **Service Worker** | Offline cache, Network-First stratégia |
| **Vercel** | Hosting + serverless API proxy |
| **GitHub API** | Sync databázy cez PAT token |
| **TMDB API** | Metadáta filmov, postery, trailery |
| **Electron** | Windows desktopová appka |
| **Android WebView** | Natívna Android appka |

---

## Nastavenia

| Tab | Obsah |
|-----|-------|
| **Vzhľad** | Téma, skin, akcentová farba, auto téma |
| **Dáta** | Import / export — JSON, CSV, HTML, ZIP |
| **Sync** | GitHub PAT token, auto-pull, auto-push |
| **Prehrávanie** | MPC-HC / VLC / Portable, lokálna / SMB cesta |
| **Nástroje** | TMDB admin, ČSFD matcher, manuálny match |
| **Danger** | Reset databázy, vyčistenie cache |

---

## Klávesové skratky

| Klávesa | Akcia |
|---------|-------|
| `/` | Fokus na vyhľadávanie |
| `Esc` | Zatvoriť detail / nastavenia |
| `←` `→` | Predchádzajúci / nasledujúci film |

---

## Vývoj

Aplikácia je statická — bez build stepu. Stačí editovať súbory a commitnúť.

```bash
# Lokálne testovanie
npx serve .

# Deploy — push do main, Vercel sa automaticky redeployne
git push origin main
```

GitHub Action `.github/workflows/bump-sw-cache.yml` automaticky bumpne SW cache version pri každom push do `main`.

---

<p align="center">
  <sub>Vytvoril <b>Marcel Bucala</b> · 2026</sub><br>
  <sub><a href="https://filmy-iota.vercel.app">filmy-iota.vercel.app</a></sub>
</p>
