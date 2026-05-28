# Changelog — Filmová Databáza

Všetky zmeny sú dokumentované podľa [Keep a Changelog](https://keepachangelog.com/sk/).

---

## [6.2.0] — 2026-05-29

### Opravené
- **CORS chyba** — `raw.githubusercontent.com` blokoval fetch z Vercel; prepnuté na GitHub Contents API (CORS OK)
- **Duplicitný console.log** — `APP_VERSION` bol definovaný dvakrát
- **Tlačidlo Prehraj film** — `window.location.href` nefungovalo pre `vlc://`, `file://`, `smb://`; nahradené anchor click (`openMovieUrl`)
- **Toggle prepínač** — CSS `.ttab.on` bol prepísaný `#pathModeToggle .ttab` (vyššia špecificita); pridané explicitné `#pathModeToggle .ttab.on`
- **Sirota CSS** — Rozbitý selektor v `.ttab` bloku odstránený

### Pridané
- **Loading status bar** — Zlatý progress bar (0→10→50→80→100%) viditeľný počas ghPull
- **emptyPullStatus** — Status správa priamo v prázdnom stave stránky
- **localPathSave OK button** — Samostatné ukladanie lokálneho základu cesty
- **pathModeHint** — Zobrazenie ukážkovej cesty po prepnutí Lokálna/Sieťová
- **ghPull bez tokenu** — Načítanie databázy funguje aj bez GitHub PAT tokenu

### Zmenené
- Empty state: odstránené tlačidlo „Nahrať ZIP/PDF", zostalo len „Načítať z GitHubu"

---

## [6.1.0] — 2026-05-28

### Opravené
- Duplikát `function closeSett` v IIFE
- CSS `.slider` a `.slider:before` chýbali → toggle switch nemal vizuál
- Vercel deployoval z vetvy `main` (nie `Perplexity`) — všetky opravy presunuté na `main`
- Service Worker cachoval starý `app.js` — bump CACHE verzie pri každom fixe

### Pridané
- `GH_BRANCH = 'Perplexity'` — správna vetva pre GitHub sync
- `autoPull` default ON — automatické načítanie pri štarte
- JSZip CDN pre ZIP export
- `text-overflow: ellipsis` pre `.ttab` v pathMode toggle

---

## [6.0.0] — 2026-05-28

### Pridané
- Kompletný refactor do IIFE modulov
- Service Worker s Cache-First stratégiou
- PWA manifest
- SMB path mapping (lokálna ↔ sieťová cesta)
- TMDB batch fetch s progress barom
- Štatistická obrazovka s Chart.js grafmi
- Filter panel (rok, hodnotenie, krajina, žáner)
- Watchlist a Watch History
- Export ZIP / PDF
