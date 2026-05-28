# Changelog — FilmDB

## [Fáza 6] — 2026-05-28
### Opravené
- **KRITICKÉ** `closeSett()` chýbala — spôsobovala crash celého DCL bloku, žiadne tlačidlo nereagovalo
- `GH_BRANCH` zmenený z `'main'` na `'Perplexity'` — ghPull/ghPush smeroval na zlú vetvu
- `nativePlayerTog` checkbox sa nenastavoval pri otvorení nastavení
- `autoPull` default zmenený na `ON` (namiesto false po reset cache)
- Vnorená `forEach` v pathMode toggle DCL bloku — rozdelená na 2 samostatné volania
- ZIP import — pridaná JSZip CDN knižnica do `index.html` (chýbala)
- `cpost-play` onclick — refaktorovaný na `playMovie(id)` helper funkciu
### Pridané
- `function playMovie(id)` — centrálny helper pre prehrávanie z karet aj detailu

## [Fáza 5] — 2026-05-28
### Opravené
- 9 chýbajúcich CSS tried: `.stat-charts`, `.chart-card`, `.chart-wrap`, `.fz-hl`, `.thumbnail` atď.
- Null-safe `resCnt` v `applyFilters()`
- `ghPush`/`ghPull` URL building → template literals
- 14 `toast()`/`ghSetStatus()` volaní so `+` → template literals
### Refaktorované
- `applyFilters()`: `var→const/let`, `function()→arrow`, null-safe badge
- `showStats()`: kompletný rewrite — `var→const`, arrow funkcie, spread `Math.min/max`
- 7 mŕtvych CSS pravidiel odstránených

## [Fáza 4] — 2026-05-28
### Opravené
- B1: `autoCheckGitHub` + `autoPull` double-fetch
- B2: `renderList()` null-safe guardy
- B4: `openSett()` `autoPullTog` sync
- B5: `.det-actions` flex CSS
- B6: debug `console.log` v produkcii
### Refaktorované
- `cardHTML`, `openDet`, `buildSimilarHtml`, `sc`, `infoItem` → template literals (−70% concat operácií)
- 5 globálnych SVG konštánt (`STAR_ON`, `STAR_OFF`, `EYE_ON`, `EYE_OFF`, `FILM_ICO`)

## [Fáza 3] — 2026-05-28
### Refaktorované
- Hromadná modernizácia: `var→const/let` v core funkciách
- Arrow funkcie v `map`/`filter`/`forEach` callbackoch
- Template literals v URL buildingu

## [Fáza 1-2] — 2026-05-28
### Pridané
- Fuzzy vyhľadávanie (Fuse.js) s PRESNE/FUZZY badge
- Zvýraznenie výsledkov vyhľadávania (`.fz-hl`)
- Watchlist, Obľúbené, Videné + dátumy
- Štatistiky s Chart.js grafmi (žánre, dekády)
- GitHub auto-sync (pull/push s debounce)
- Podpora ZIP importu (EMDB export)
- SMB/lokálna cesta pre prehrávanie filmov
- Responzívny grid/list view
