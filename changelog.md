# Changelog — Filmová Databáza

Všetky významné zmeny sú zdokumentované v tomto súbore.
Formát: [Keep a Changelog](https://keepachangelog.com/sk/) · Verziovanie: [Semantic Versioning](https://semver.org/)

---

## [9.1.0] — 2026-05-24

### 🐛 Opravené
- **PREHĽAD / presvitajúce štatistiky** — text sekcie "Prehľad" z nastavení bol viditeľný za kartami filmov; príčina: `scrnBody` nemal explicitnú farbu pozadia; opravené nastavením `background: var(--bg)` na `.scrn-body` a `.sett-panel`
- **Ikona hviezdy obľúbených** — `☆/⭐` emoji sa zobrazovala ako samostatný element medzi kartami v list mode; príčina: `lcard` nemal `display:flex`; opravené + `lfav` button má teraz explicitné rozmery `36×36px`; ikony prepísané na SVG `currentColor`
- **Accordion "Rozšírené nastavenia"** — matúci double-accordion (všetky sekcie boli vnorené v jednom togglevom bloku); accordion (`advToggle` + `advBody`) odstránený, všetky sekcie nastavení sú teraz vždy viditeľné a priamo prístupné

### 🔄 Zmenené
- Ikona hviezdy: emoji `★☆` → SVG `polygon` (reaguje na farbu akcentu skinu)
- Nastavenia: lineárny scroll cez sekcie namiesto accordion

---

## [9.0.0] — 2026-05-24

### ✨ Pridané
- Prepínač **natívny prehrávač zariadenia** vs VLC Protocol Handler v sekcii Prehrávanie filmov
- Auto-push na GitHub pri interakciách — obľúbené, watchlist, videné (5s debounce); TMDB Admin Panel pushuje okamžite (800ms delay)
- Toggle **Automatický push pri zmenách** v GitHub sync sekcii

### 🔄 Zmenené
- Všetky emoji ikony v UI nahradené SVG stroke ikonami s `stroke="currentColor"` — reagujú na akcentovú farbu aktívneho skinu
- Body font: `Crimson Pro, Georgia, serif` → `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`
- Inline `<video>` player z karty detailu **odstránený** — zostáva iba tlačidlo `▶ Prehrať film`
- Sekcia `Lokálne prehrávanie (VLC)` (stará) odstránená — zostáva iba `Prehrávanie filmov` s prepínačom lokálna/SMB
- `Zdroj videa` dropdown v ZOBRAZENIE sekcii odstránený (duplikát)

### 🐛 Opravené
- `init()` už nepoužíva baked-in `MOVIES` (C00..C21) ako fallback — pri prázdnom `localStorage` zobrazí empty state s tlačidlami `Nahrať ZIP/PDF` / `Načítať z GitHubu`
- `autoCheckGitHub()` bezpečne pulluje z GitHubu keď sú lokálne dáta prázdne (nebude sa volať ak `all[]` je neprázdne)
- `ghPush()` validuje `all.length` pred uploadom — zabraňuje uloženiu prázdnej databázy

---

## [8.0.0] — 2026-05-23

### ✨ Pridané
- **EMDB ZIP import** — `parseEMDBZip()` extrahuje z `HTML/index.html` + `HTML/movies/*.html` + `HTML/covers/*.jpg`; importuje: názov, rok, réžisér, žánre, krajina, dĺžka, YouTube trailer, TMDB/IMDB ID, lokálna cesta k `.mkv`, popis, obsadenie, plagáty
- `JSZip` library pre parsovanie ZIP
- `fileInpUpdate` + `handleFileUpdate()` — aktualizácia z EMDB (merge, nie replace): zachová hodnotenia, trailery, plagáty existujúcich filmov
- Empty state s akčnými tlačidlami `📥 Nahrať ZIP/PDF` / `☁ Načítať z GitHubu`
- `scheduleAutoPush()` — throttlovaný auto-push na GitHub (5s debounce po zmenách)
- **GitHub SHA mismatch fix** — `ghPush()` prepísaný na Contents API + automatický retry so cache bust pri 409/422
- `validateGhToken()` — overenie PAT tokenu pri uložení cez `GET /api.github.com/user`
- 401/404 diagnostické hlášky pri GitHub Push/Pull
- `.switch` / `.slider` CSS prepínač
- `adjustScrnBody()` — dynamické meranie výšky headera

### 🔄 Zmenené
- Import `PDF` → primárne `ZIP`, PDF zachovaný ako fallback (backwards compatible)
- Settings panel: sekcie `📥 Databáza filmov` · `🎬 TMDB Metadáta` · `☁ Záloha` · `⚙ Admin` · `⚠ Nebezpečná zóna` + `▶ Prehrávanie filmov`
- `handleFile()` — ZIP vetva používa `parseEMDBZip`, PDF vetva zachovaná
- `settStartBatch()` — ukladá `poster_thumb` URL do `localStorage` každých 50 filmov + na konci

### 🐛 Opravené
- Modal CSS (`z-index: 9000`, `position: fixed`) — progress bar bol neviditeľný
- `fileInp` `accept` atribút — neumožňoval výber ZIP súborov; duplikátny `fileInp` element odstránený
- `batchBar` presunutý na `position: fixed; top: 0; z-index: 8000` — viditeľný počas načítavania

---

## [7.0.0] — 2026-05-22

### ✨ Pridané
- **Inline video player** v detaile (`<video>` element s `preload="none"`)
- **Prepínač lokálna/SMB cesta** (`pathModeToggle`) — `Lokálna (W:\)` alebo `Sieťová (smb://DESKTOP-EGOG348/Movies/)`
- `getMoviePath()` + `localPathToSmb()` — konverzia Windows ciest na SMB URL
- Importuje `_localPath` z EMDB HTML (tag `<b>Umiestnenie:</b>`)
- `autoCheckGitHub()` — po načítaní pulluje z GitHubu ak sú `localStorage` prázdne

### 🔄 Zmenené
- `buildVlcUrl()` prioritizuje `_localPath` z EMDB; fallback na SMB konštrukciu
- `ghPush()` prepísaný: Git Data API (3 kroky) → Contents API (1 krok) + SHA retry
- Nastavenia reorganizované do skupín so sekciami `sett-grp`

### 🐛 Opravené
- VLC URL mangling: `<a href="vlc://...">` → `<button onclick="location.href=...">` (prehliadač neparsuje protokol)
- `getMoviePath()` používa forward slashes `/` pre URL kompatibilitu

---

## [6.0.0] — 2026-05-21

### ✨ Pridané
- **VLC Protocol Handler integrácia** — spustenie `.mkv` súborov cez `vlc://` protokol
- `removeDiacritics()` — konverzia SK/CZ diakritiky pre názvy súborov
- `buildVlcUrl()` + `buildMovieFilename()` — konštrukcia VLC URL zo SMB základu + roku + názvu
- SMB base URL konfigurácia v nastaveniach (`smb://DESKTOP-EGOG348/Movies/`)
- Tlačidlo `▶ Prehrať film` v detaile + `📋` (kopírovať cestu)
- Overlay ▶ na plagáte v grid mode (pri hover)
- **TMDB poster fetch** — `doTMDBFetch()` sťahuje `poster_path` z TMDB (`/t/p/w300`)
- Floating `batchBar` (`position: fixed; top: 0`)
- SVG ikony sekcií nastavení (nahradili emoji)

### 🔄 Zmenené
- `handleFile()` extrahuje plagáty z PDF strán cez `getOperatorList()` (PDF.js)
- `handleFileUpdate()` — merge importu: zachová TMDB dáta existujúcich filmov
- Settings panel: clear sekcie Databáza · TMDB · Záloha · Admin · Nebezpečná zóna

### 🐛 Opravené
- Modal CSS chýbal celý — `.m-ov`, `.modal`, `.m-bar`, `.m-fill` neboli definované
- Scroll: `scrnBody` wrapper (pôvodne mimo `mainSc`) dostal `position: fixed; top: 88px` pre korektné dimenzie

---

## [5.0.0] — 2026-05-20

### ✨ Pridané
- **TMDB API integrácia** — `doTMDBFetch()`, `settStartBatch()` — hromadné stiahnutie hodnotení a trailerov
- `liveCache` — dočasná cache TMDB dát (hodnotenie %, YouTube kľúč, TMDB/IMDB URL)
- `saveLiveCache()` / `loadLiveCache()` — persistencia cache do `localStorage`
- **GitHub sync** — `ghPush()`, `ghPull()`, `ghToken`, `GH_REPO/GH_FILE/GH_BRANCH` constants
- 6 skin-ov: Dark · Slate · Crimson · Forest · Linen · Paper
- Vlastná farba akcentu (color picker + prednastavené swatches)
- Sort controls: dropdown `Poradie/Názov/Rok/Hodnotenie` + tlačidlo smeru
- Filter chips v header row 2 (`fpPills`)
- Detail view: posuvná karta s plagátom, popis, obsadenie, podobné filmy, trailer overlay
- Stats panel (`statSc`) — štatistiky z `liveCache`
- TMDB Admin Panel — vyhľadávanie a pridanie jednotlivého filmu

### 🔄 Zmenené
- Kompletný redesign UI: dark `#0a0a0f`, zlatá `#d4a943`, `Bebas Neue` + `JetBrains Mono`
- Card layout: grid + list mode s toggle
- `parseEMDB()` — PDF text parser s rozpoznaním EMDB export formátu

### 🐛 Opravené
- Scroll na mobile: `overflow-y: scroll`, `touch-action: pan-y`, `overscroll-behavior: contain`
- Fuse.js `tokenize` parameter deprecated — nahradený `useExtendedSearch`

---

## [4.0.0] — 2026-05-19

### ✨ Pridané
- PDF import cez `pdf.js` — parsovanie EMDB exportu
- `parseEMDB()` — extrakcia filmov z PDF textu (regex pre číslo, názov, rok, réžisér, žánre, krajina, dĺžka)
- Modal progress dialog pre import (`showMod`, `hideMod`, `setP`)
- `localStorage` persistencia (`mdb_v5`, `mdb_fav5`, `mdb_wl1`, `mdb_watched1`)
- Watchlist (`togWl`) + Watched (`togWatched`) funkcie
- Fuse.js full-text vyhľadávanie
- `appendCards()` + infinite scroll (`IntersectionObserver`)
- Baked-in data chunks `C00–C21` pre offline demo

### 🔄 Zmenené
- Všetky dáta migrované do premennej `all[]` (runtime array)
- Oddelené `favs`, `wl`, `watched`, `liveCache` kolekcie
