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

---

## [11.0.0] — 2026-05-28

### ✨ Kompletný rebuild
- Aplikácia prebudovaná z pôvodného single-file zdroja (Google Drive) do modulárnej štruktúry
- Zdrojový kód: `index.html` (35 KB) + `style.css` (50 KB) + `app.js` (127 KB)
- 115 funkcií, 0 duplikátov, 20/20 features ✅

### 🐛 Opravené (kumulatívne zo všetkých predchádzajúcich verzií)
- `.sett-sec display:flex` — nastavenia sekcie viditeľné (SVG + text v jednom riadku)
- `.gtag` (žánre pills) — `rgba(var(--gold-rgb),.13)` namiesto hardcoded `#1a1a2e`
- `--gold-rgb` CSS var — pridaná do všetkých 6 skinov
- `.cfav` + `.lfav` (hviezda obľúbených) — 38×38px button s bg/border/hover/active
- `.batch-bar` — `position:fixed;top:0;z-index:8000`
- `.sett-panel` — `user-select:none`, `background:var(--bg)` (opaque)
- `.scrn-body` — `background:var(--bg)` (žiadne presvitanie)
- `skinGrid` wrapper + DARK chip + "Vzhľad / Skin" header obnovené
- `.switch`/`.slider` CSS pre toggle prepínače
- `.hdr-icon.active` stav CSS
- CSS duplikáty vyčistené (23 → 0)
- `onclick="closeSett()"` nahradený `addEventListener`
