# Changelog — Filmová Databáza

## [10.2.0] — 2026-05-28

### 🏗 Kompletná reštrukturalizácia
Aplikácia prepísaná z pôvodného single-file (236KB) na modulárnu architektúru:
- `index.html` (35 KB) — HTML šablóna, odkazy na externý CSS/JS
- `style.css` (50 KB) — všetky štýly, 6 skinov s --gold-rgb
- `app.js` (127 KB) — celá aplikačná logika (115 funkcií, IIFE)
- `data.json` — databáza filmov (GitHub sync)
- `sw.js` — Service Worker (PWA)
- `manifest.webmanifest` — PWA manifest

### ✨ Pridané / Obnovené z pôvodnej verzie
- Všetkých 115 pôvodných funkcií zachovaných
- ZIP import (parseEMDBZip), PDF fallback, TMDB batch, VLC prehrávanie
- GitHub sync (ghPush/ghPull, 401/404/409 handling, validateGhToken)
- scheduleAutoPush, autoCheckGitHub, autoPushTog
- Pokročilý filter panel (openFp, initFp, applyFp, resetFp)
- 6 skinov (Dark, Slate, Crimson, Forest, Linen, Paper)

### 🐛 Opravené (kombinácia všetkých predchádzajúcich fixov)
- **Settings X button** — closeSett() vnútri IIFE scope, onclick nefungovalo; prepísané na addEventListener
- **Scroll iba 40 filmov** — #scrnBody nemal top:88px; infinite scroll prepojený na scrnBody namiesto mlist
- **Scrollbar (fscroll) nereagoval** — sledoval mlist namiesto scrnBody
- **hdr-row2-right ikony zmizli** — pridané position:sticky;right:0;background:var(--hdr)
- **hdr-row2-left nepokrývali** — overflow-x:auto s -webkit-overflow-scrolling:touch, skrytý scrollbar
- **Text v nastaveniach sa označoval** — user-select:none na sett-panel
- **sett-sec neviditeľné** — display:flex;align-items:center;gap:6px;white-space:nowrap
- **skinGrid wrapper chýbal** — pridaný div#skinGrid + DARK chip + Vzhľad/Skin section header
- **Genre pills nerespektovali skin** — .gtag prepísaný na rgba(var(--gold-rgb))
- **cfav/lfav nekonzistentné** — zjednotené na 38×38px s bg, border, hover, active stavy
- **.switch/.slider CSS chýbal** — toggle prepínače fungujú
- **batch-bar neviditeľný** — position:fixed;top:0;z-index:8000
- **--gold-rgb** pridané do všetkých 6 skinov
- **hdr-icon active/on stav** — vizuálna zmena pri zakliknutí
- **playMovieBtn orphan** — odstránený
