# Changelog

Všetky významné zmeny v projekte sú dokumentované v tomto súbore.

Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

---

## [7.0.0] — 2026-06-13

### Pridané
- **Android appka** — natívny WebView wrapper s immersive fullscreen, Gradle build, GitHub Actions CI (#47, #52, #54, #55)
- **Windows appka** — Electron wrapper s `desktop/main.js`, `package.json`, `preload.js` (#47)
- **TWA konfigurácia** — `android/twa-manifest.json` pre Trusted Web Activity (#47)
- **9 nových funkcií** — hromadný výber, rýchle pridanie, dekádový prehľad, auto téma, a ďalšie (#42, #43)
- **Portable prehrávač** — podpora pre portable MPC-HC / VLC z USB, `portable://` handler, download `.reg` a `.bat` (#51)
- **Hromadný výber inline** — select-all sub-tlačidlo a akčné tlačidlá priamo v headeri (#46, #49)
- **Auto téma** — automatické prepínanie Dark / Linen podľa systémového `prefers-color-scheme` (#45)
- **Rýchle pridanie** — pridaj film cez TMDB priamo z nastavení (#45)

### Opravené
- **Android prehrávanie** — ARC error 124 opravený použitím `vlc://smb://` namiesto `intent://` (#50)
- **Kde pozerať vizuál** — konzistentný outlined štýl s SVG ikonou namiesto emoji (#50)
- **Ikona dekád** — zmenená z grid na layers SVG (bola rovnaká ako Grid) (#50)
- **Header tlačidlá** — obnovené priame tlačidlá namiesto "..." dropdown menu (#45)
- **Auto téma init** — `applyTheme()` teraz spracováva `auto` priamo, nie cez monkey-patch (#45)
- **Bulk bar duplikácia** — odstránená spodná lišta, kontroly presunuté do headeru (#46, #49)
- **Posterwall layout** — `aspect-ratio:2/3` namiesto nespoľahlivej padding techniky (#35–#39)
- **Poster border-radius** — zaoblenie na všetkých stranách v grid view (#40)
- **Ikona Android appky** — zmenená z "MD" na "MFD" podľa favicon.svg (#57)

### Zmenené
- **README** — kompletný redizajn s tabuľkami, badgami, platform sekciou a detailnou architektúrou
- **CHANGELOG** — rozšírený o všetky PR od v6.3.0

---

## [6.3.0] — 2026-06-12

### Pridané
- **README** — vylepšený s badges, tabuľkami, tech stack sekciou (#41)
- **CHANGELOG** — prvá verzia tohto súboru (#41)
- **MIT licencia** (#41)

### Opravené
- **Posterwall layout** — `aspect-ratio:2/3` priamo na obrázkoch (#35–#39)
- **Ikony v headeri** — opravená CSS syntax chyba pre `.hdr-act` (#34)
- **Service Worker** — Network-First pre same-origin súbory (#33)
- **SW pre-caching** — `fetch(url, {cache:'no-store'})` bypass HTTP cache (#32)
- **Cache-Control hlavičky** — `vercel.json` hlavičky pre shell súbory (#31)
- **Akciové ikony** — zjednotený vizuál s `ctrl-btn` štýlom (#30)
- **TMDB obrázky v SW** — passthrough pre cross-origin requesty (#39)
- **Poster border-radius** — zaoblenie na všetkých stranách v grid view (#40)

---

## [6.2.0] — 2026-06-10

### Opravené
- **openDet crash** — `const` temporal dead zone opravená (#25)
- **Header na mobile** — všetky tlačidlá sa zmestia bez scrollovania (#26)
- **JustWatch SK** — správna cesta `/sk/vyhladavat` (#26)

---

## [6.1.0] — 2026-06-02

### Pridané
- **Batch 1** — obnovené 7 mŕtvych funkcií: SW registrácia, toast notifikácie, Fuse.js init, posterwall, color picker, HTML export (#27)
- **Batch 2** — spoľahlivá synchronizácia kolekcií, flush fix, key bug (#27)
- **Batch 4** — mobilný layout, design tokeny, UX vylepšenia (#27)

### Opravené
- **Batch 3** — bezpečnosť (SSRF ochrana), timeouty, SW, deploy konfigurácia (#27)
- **Batch 5** — odstránený dead code (#27)

---

## [6.0.0] — 2026-06-01

### Pridané
- **Settings panel** — preorganizované do 6 tabov (#21, #22, #23)
- **ČSFD matcher** — vylepšený import workflow (#22)
- **Vercel deploy** — `vercel.json` s cache hlavičkami

---

## [11.1.0] — 2026-05-28

### Opravené
- **Settings X button** — `closeSett()` vnútri IIFE, pridaný `addEventListener`
- **Infinite scroll** — napojený na `scrnBody` s 300px triggerom
- **hdr-row2-right** — `position:sticky;right:0` aby ikony nezmizli pri scroll

---

## [11.0.0] — 2026-05-28

### Pridané
- Kompletný rebuild aplikácie z pôvodného single-file zdroja
- 115 funkcií, 0 duplikátov, 20/20 features
- Modulárna architektúra: `index.html` + `style.css` + `app.js`

### Opravené
- `.sett-sec display:flex` — nastavenia sekcie viditeľné
- `.gtag` žánre pills — `rgba(var(--gold-rgb),.13)` namiesto hardcoded farby
- `--gold-rgb` CSS var pridaná do všetkých 6 skinov
- `.cfav` + `.lfav` — 38×38px button s hover/active stavmi
- `.batch-bar` — `position:fixed;top:0;z-index:8000`
- `.sett-panel` — `user-select:none`, opaque pozadie
- CSS duplikáty vyčistené (23 → 0)

---

## [10.2.0] — 2026-05-28

### Pridané
- Kompletná reštrukturalizácia z pôvodného single-file (236 KB) na modulárnu architektúru
- Všetkých 115 pôvodných funkcií zachovaných
- ZIP import, PDF fallback, TMDB batch, VLC prehrávanie
- GitHub sync s 401/404/409 error handling
- Pokročilý filter panel
- 6 skinov: Dark, Slate, Crimson, Forest, Linen, Paper

---

<p align="center"><sub>Formát: <a href="https://keepachangelog.com">Keep a Changelog</a></sub></p>
