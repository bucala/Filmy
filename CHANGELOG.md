# Changelog

Vsetky vyznamne zmeny v projekte su dokumentovane v tomto subore.

Format vychadza z [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

---

## [6.3.0] — 2026-06-12

### Opravene
- **Posterwall layout** — `aspect-ratio:2/3` priamo na obrazkoch namiesto nespolahlivej `::before` padding techniky (#39, #38, #37, #36, #35)
- **Ikony v headeri** — opravena CSS syntax chyba ktora zozrala `.hdr-act` pravidlo (#34)
- **Service Worker strategia** — prepnutie z Cache-First na Network-First pre same-origin subory (#33)
- **SW pre-caching** — `fetch(url, {cache:'no-store'})` bypass HTTP cache (#32)
- **Cache-Control hlavicky** — `vercel.json` hlavicky pre vsetky shell subory (#31)
- **Akciove ikony** — zjednoteny vizual s `ctrl-btn` stylom (#30)
- **TMDB obrazky v SW** — passthrough pre cross-origin requesty (#39)
- **Poster border-radius** — zaoblenie na vsetkych stranach v grid view (#40)

---

## [6.2.0] — 2026-06-10

### Opravene
- **openDet crash** — `const` temporal dead zone opravena (#25)
- **Header na mobile** — vsetky tlacidla sa zmestia bez scrollovania (#26)
- **JustWatch SK** — spravna cesta `/sk/vyhladavat` (#26)

---

## [6.1.0] — 2026-06-02

### Pridane
- **Batch 1** — obnovene 7 mrtvych funkcii: SW registracia, toast notifikacie, Fuse.js init, posterwall, color picker, HTML export (#27)
- **Batch 2** — spolahliva synchronizacia kolekcii, flush fix, key bug (#27)
- **Batch 4** — mobilny layout, design tokeny, UX vylepsenia (#27)

### Opravene
- **Batch 3** — bezpecnost (SSRF ochrana), timeouty, SW, deploy konfiguracia (#27)
- **Batch 5** — odstraneny dead code (#27)

---

## [6.0.0] — 2026-06-01

### Pridane
- **Settings panel audit** — preorganizovane do 6 tabov (#21, #22, #23)
- **CSFD matcher audit** — vylepseny import workflow (#22)
- **Vercel deploy** — `vercel.json` s cache hlavickami

---

## [11.1.0] — 2026-05-28

### Opravene
- **Settings X button** — `closeSett()` vnuti IIFE, `onclick` z HTML ju nedosiahol; pridany `addEventListener`
- **Infinite scroll** — napojeny na `scrnBody` namiesto `mlist` s 300px triggerom
- **hdr-row2-right** — `position:sticky;right:0` aby ikony nezmizli pri scroll

---

## [11.0.0] — 2026-05-28

### Pridane
- Kompletny rebuild aplikacie z povodneho single-file zdroja
- 115 funkcii, 0 duplikatov, 20/20 features
- Modularna architektura: `index.html` + `style.css` + `app.js`

### Opravene
- `.sett-sec display:flex` — nastavenia sekcie viditelne
- `.gtag` zanre pills — `rgba(var(--gold-rgb),.13)` namiesto hardcoded farby
- `--gold-rgb` CSS var pridana do vsetkych 6 skinov
- `.cfav` + `.lfav` — 38x38px button s hover/active stavmi
- `.batch-bar` — `position:fixed;top:0;z-index:8000`
- `.sett-panel` — `user-select:none`, opaque pozadie
- `skinGrid` wrapper + DARK chip obnovene
- `.switch`/`.slider` CSS pre toggle prepinade
- CSS duplikaty vycistene (23 -> 0)

---

## [10.2.0] — 2026-05-28

### Pridane
- Kompletna restrukturalizacia z povodneho single-file (236KB) na modularnu architekturu
- Vsetkych 115 povodnych funkcii zachovanych
- ZIP import, PDF fallback, TMDB batch, VLC prehravanie
- GitHub sync s 401/404/409 error handling
- Pokrocily filter panel
- 6 skinov: Dark, Slate, Crimson, Forest, Linen, Paper

### Opravene
- Settings X button — prepojenie cez `addEventListener`
- Scroll — `#scrnBody` s `top:88px`, infinite scroll na spravnom elemente
- Scrollbar (fscroll) — sleduje `scrnBody`
- Header row2 right ikony — sticky positioning
- Header row2 left — horizontalny scroll s ukrytym scrollbarom
- Text v nastaveniach — `user-select:none`
- Genre pills skin-aware
- cfav/lfav zjednotene na 38x38px
