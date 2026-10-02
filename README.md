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
  <img alt="Vanilla JS" src="https://img.shields.io/badge/Vanilla_JS-no_framework-F7DF1E?style=flat-square&logo=javascript&logoColor=black">
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

> **Offline:** po úspešnom prvom načítaní a aktivácii Service Workera funguje knižnica aj vyhľadávanie bez internetu. Postery sú dostupné, ak už boli načítané a zostali v cache. Sync, nové metadáta a trailery vyžadujú internet.

---

## Prehľad funkcií

<table>
<tr>
<td width="50%">

### Zobrazenie filmov
| Režim | Popis |
|-------|-------|
| **Zoznam** | Kompaktné riadky — číslo, názov, rok, žánre, hodnotenie |
| **Grid** | Responzívne karty s posterom, režisérom a žánrami; počet stĺpcov podľa šírky obrazovky |
| **Posterwall** | Stena plagátov s metadátami pri hoveri alebo fokuse; na zariadeniach bez hoveru viditeľný overlay |

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
- **Presné zhody najprv**: názov, režisér, rok, žánre a vlastné tagy v aktuálne filtrovanej kolekcii
- **Fuzzy search** (Fuse.js): ak chýbajú presné zhody, hľadá aj v opise filmu
- **Odozva pri písaní**: 180 ms debounce, Enter hľadá okamžite, vymazanie/reset ruší čakajúcu úlohu; podpora IME zadávania
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

### Rozhranie a odozva

- Prehľadná hlavička s vyhľadávaním, radením a filtrami; označená navigácia a ovládanie prispôsobené úzkym obrazovkám.
- Všetky tri zobrazenia zachovávajú šesť tém, klávesové/TV ovládanie a hromadný výber. **Označiť zobrazené** zahŕňa iba aktuálne vykreslené karty.
- Filmy sa vykresľujú po **24 kartách** cez `requestAnimationFrame`; vysoká obrazovka sa doplní automaticky. Domovské riadky sa neprestavujú pri každom filtrovaní.
- Presné vyhľadávanie nevytvára Fuse index. Fuzzy vyhľadávanie používa jeden lenivo vytvorený index a cache posledných **8 dopytov** zdieľanú medzi filtrami; úprava databázy cache zneplatní.
- Pri návrate z detailu sa obnoví fokus na pôvodný film. Prázdna kolekcia ponúkne reset a použiteľný fokus; svetlé témy majú čitateľnejší tlmený text.

**Kontrolné meranie (2026-10-02):** v izolovanom Chromium na Windows s 1 767 filmami klesol medián opakovaného fuzzy dopytu `star wras` z 95,1 ms na 1,8 ms. Prvé fuzzy hľadanie vrátane vytvorenia indexu trvalo 98,3 ms. Meraný bol synchrónny priebeh filtrovania a vynútený layout, medián posledných 7 z 9 vzoriek. Nejde o Core Web Vitals ani meranie na Android/TV hardvéri.

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
| **GitHub Sync** | Push / pull `data.json` (filmy a kolekcie) a `data-live.json` (metadáta) cez GitHub API; podmienený pull s ETag |
| **Auto-sync** | Automatický pull pri štarte + plánovaný auto-push |
| **Export** | CSV · JSON · HTML (baked-in dáta) · kolážové PNG |
| **Import** | ZIP (EMDB) · PDF fallback · JSON restore |
| **Hromadný výber** | Výber filmov vo všetkých troch zobrazeniach, označenie zobrazených kariet a hromadné akcie |
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

Gradle automaticky skopíruje web appku vrátane `src/` modulov do Android assets. Pozri [`android/BUILD.md`](android/BUILD.md).
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
├── style.css                Responzívne štýly + 6 tém a auto režim
├── src/                     ES moduly so zdieľaným namespace S
│   ├── main.js              Vstup aplikácie, udalosti a inicializácia
│   ├── state.js             Zdieľaný stav a konfigurácia
│   ├── render.js            Filtre, karty, stránkovanie a detail
│   ├── ui.js                Témy, radenie a rozloženie
│   ├── storage.js           Lokálne ukladanie a invalidácia vyhľadávania
│   ├── sync.js              Rozdelený GitHub sync a ETag
│   ├── settings.js          Nastavenia, importy a admin
│   ├── players.js           Prehrávanie a cesty k filmom
│   ├── tv.js                Navigácia diaľkovým ovládačom
│   └── lib/                 Čisté, testovateľné helpery
│       ├── browse.js         Vyhľadávanie, cache, debounce a stránkovanie
│       └── …                Text, parsovanie, cesty, navigácia a sync
├── test/                    Vitest unit testy
├── portable-handler.js      Portable prehrávač modul
├── data.js                  Vložená databáza pre prvé načítanie
├── data.json                Filmy a kolekcie (GitHub sync)
├── data-live.json           Živé metadáta (GitHub sync)
├── sw.js                    Offline shell, Network-First a cache posterov
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
├── android/                 Build dokumentácia a historická TWA konfigurácia
│   ├── BUILD.md
│   └── twa-manifest.json
└── desktop/                 Electron wrapper
    ├── main.js
    ├── preload.js
    ├── embed-win.js         Win32 vnorenie MPC-HC/BE cez koffi
    └── package.json
```

### Tech stack

| Technológia | Použitie |
|-------------|----------|
| **Vanilla JS** | Žiadny framework, natívne ES moduly a zdieľaný namespace `S` |
| **Fuse.js** | Lenivo vytvorený fuzzy index a cache dopytov |
| **Vitest / ESLint** | Unit testy čistých helperov a kontrola kódu |
| **Chart.js** | Interaktívne grafy v štatistikách |
| **PDF.js** | PDF import fallback |
| **JSZip** | ZIP import (EMDB) |
| **Service Worker** | Offline shell a Fuse.js, Network-First pre lokálne súbory, samostatná cache posterov |
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
| `/`, `Ctrl+K` / `Cmd+K` | Fokus na vyhľadávanie v knižnici |
| `Enter` vo vyhľadávaní | Vyhľadať okamžite bez čakania na debounce |
| `Enter` / `Space` | Aktivovať fokusovanú kartu alebo filter |
| `Esc` | Zatvoriť detail, filtre alebo otvorený panel |
| `←` `→` v detaile na PC | Predchádzajúci / nasledujúci film |

Na TV šípky presúvajú fokus medzi ovládacími prvkami aj v detaile. Krátke stlačenie OK/Enter otvorí film, dlhé stlačenie na karte otvorí menu akcií.

---

## Vývoj

Aplikácia je statická, bez build stepu pre web. Vývojové kontroly používajú Node.js 22 a npm:

```bash
# Inštalácia vývojových závislostí
npm ci

# Kontroly (rovnaké ako CI)
npm run lint
npm test

# Lokálny HTTP server, ES moduly neotváraj cez file://
npx serve .

# Deploy po overení zmien, Vercel sa automaticky redeployne
git push origin main
```

CI spúšťa lint a unit testy pri pushi do `main` a pri PR. `.github/workflows/bump-sw-cache.yml` automaticky aktualizuje SW cache verziu pri zmenách webových zdrojov na `main`.

Pri zmene rozhrania over všetky tri zobrazenia, svetlé/tmavé témy, klávesový fokus a offline režim. Responzívne testy v prehliadači nenahrádzajú kontrolu dotyku, TV ovládača ani natívnych Android/Electron balíkov na zariadení.

---

<p align="center">
  <sub>Vytvoril <b>Marcel Bucala</b> · 2026</sub><br>
  <sub><a href="https://filmy-iota.vercel.app">filmy-iota.vercel.app</a></sub>
</p>
