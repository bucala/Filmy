# Changelog — Filmová Databáza

## [1.3.0] — 2026-05-25

### 🔴 Kritické opravy
- **`doWrite()` — `r.json()` bez `.catch()`**: Pri non-JSON odpovedi GitHubu (napr. HTTP 503) crash bez feedbacku. Pridaný `.catch()` ktorý vráti `{status, ok:false, d:{message:'HTTP '+r.status}}` a zobrazí chybu používateľovi.

### 🟡 Stredné opravy
- **`buildMovies()` mimo IIFE**: Pridaný vysvetľujúci komentár `/* buildMovies is intentionally global */` — funkcia musí zostať v separátnom `<script>` tagu kvôli C00–C21 export mechanizmu.
- **`window.__toggleSortDir` → `toggleSortDir`**: Premenované globals (odstránený `__` prefix). Opravené aj `onclick`/`onchange` atribúty v HTML.
- **`updateSortDirBtn()` — prázdny wrapper**: Funkcia odstránená, priame volanie `syncSortPill()`.
- **`88px` hardcoded v CSS**: Nahradené `var(--hdr-height, 88px)` — CSS custom property s fallbackom.

### 🟢 Code Quality
- **`catch(e){}` prázdne bloky**: Pridané `console.warn` do 5 kľúčových miest:
  - `[Init] localStorage parse error` — korumpovaná DB pri štarte
  - `[Init] favs / watchlist / watched parse error`
  - `[ghPull] buildMovies poster restore failed`
- **18 nepoužívaných CSS tried odstránených** (−2 153 chars): `.gbar*`, `.sort-wrap`, `.sort-dir`, `.sett-row-2`, `.bg-palette-*`, `.text-palette-swatch`, `.dec-row`, `.dec-c`, `.frollbar`, `.btn-tr`, `.act-lbl`, `.tmdb-inp` (duplikát).
- **`!important` — 14× → 7×**: Nepoužívané triedy niesli zbytočné `!important`; zvyšok je odôvodnený (utility `.hidden`, skin overrides).
- **`onclick`/`onchange` inline → `addEventListener`**: `initSortCycle()` prerobená — `sortDir` a `sortSel` teraz používajú `addEventListener`.
- **`decEnt()` komentár**: Pridaný `/* textarea trick is safe here — no user input, only EMDB-generated HTML */`.

### 🎨 Ikony — toolbar
- **Obľúbené** `⭐ polygon star` → **srdce** `♥` — intuitívnejšie pre "obľúbené"
- **Watchlist** `👁 eye` → **záložka + plus** `🔖+` — jasnejší sémantický rozdiel od "Videné"
- **Videné** `✓ checkmark` — zachovaný
- **Náhodný film** `🎲 kocka` — zachovaná
- **Štatistiky** `📊 bar chart` — zachovaný

---

## [1.2.0] — 2026-05-24

### Fuse.js Fuzzy Search
- Implementovaná Fuse.js knižnica pre vyhľadávanie s toleranciou preklepov
- Dvojfázový systém: Exact match (zelený badge PRESNE) → Fuzzy fallback (zlatý badge FUZZY ~)
- Zvýrazňovanie nájdených zhôd (`<mark class="fz-hl">`) priamo v názvoch a menách
- Váhy: `title` 0.55, `director` 0.20, `year` 0.10, `genres` 0.10, `description` 0.05
- Threshold: 0.42 — dobrý balans medzi toleranciou a presnosťou

---

## [1.1.0] — 2026-05-23

### Oprava posterov po importe
- Trojvrstvová záchrana posterov (runtime `all[]` → localStorage snapshot → baked-in C00 dáta)
- Opravený bug: `localStorage.setItem` mohol crashnúť pri 19 MB base64 dátach (quota limit)

---

## [1.0.0] — 2026-05-22

### Základ
- Filmová databáza s PDF/ZIP importom (EMDB formát)
- Grid + list zobrazenie, žánrové filtre, obľúbené
- TMDB batch fetch: hodnotenia, trailery, plagáty
- GitHub sync (Push/Pull)
- 6 skinov: Dark, Slate, Crimson, Forest, Linen, Paper
- Vlastná farba akcentu (color picker)
- PWA manifest
- VLC Protocol Handler integrácia (SMB + lokálne cesty)
- Štatistiky a grafy (Chart.js)

---

## [10.0.0] — 2026-05-26

### ✨ Nová štruktúra (v10)
Aplikácia reštrukturalizovaná z single-file na modulárnu architektúru:
- `index.html` (21 KB) — HTML šablóna
- `app.js` (143 KB) — celá aplikačná logika
- `style.css` (29 KB) — všetky štýly
- `data.json` (1.9 MB) — databáza filmov
- `sw.js` — Service Worker (PWA)
- `manifest.webmanifest` — PWA manifest
- Chart.js pre štatistiky

### 🐛 Opravené (Fáza 1 — kritické)
- **`.switch`/`.slider` CSS chýbal** — toggle prepínače (autoPush, nativePlayer) boli neviditeľné; pridaný kompletný switch CSS vrátane light-skin variant
- **`skinGrid` wrapper chýbal** — skin chips boli orphan v DOM bez grid layoutu; pridaný `<div id="skinGrid">` wrapper
- **DARK skin chip chýbal** — prvý skin bol úplne vymazaný; pridaný späť
- **"Vzhľad / Skin" section header** — chýbal nadpis pred skin chips; pridaný SVG palette ikona + text
- **`--gold-rgb` CSS premenná** — chýbala vo všetkých skinoch; pridaná (dark: 212,169,67 · slate: 90,171,255 · crimson: 232,85,85 · forest: 106,200,64 · linen: 122,92,24 · paper: 26,78,124)
- **`.gtag` (žánre pills)** — prepísaný na `rgba(var(--gold-rgb),.1)` — reaguje na zmenu skinu

### 🐛 Opravené (Fáza 2 — konzistentnosť)
- **`.cfav` (grid star)** — zmenený z `background:none;border:none` na 38×38px button s pozadím, borderom, hover a active stavom
- **`.lfav` (list star)** — zjednotený s `.cfav` designom (identický button look)
- **`.batch-bar`** — `position:fixed;top:0;z-index:8000` — progress bar vždy viditeľný na vrchu stránky
- **`.hdr-row1` CSS duplikát** — odstránený
- **`playMovieBtn` orphan handler** — odstránený z `app.js`

---

## [10.1.0] — 2026-05-27

### 🐛 Opravené
- **Settings X button nefungoval** — `closeSett()` bola vnútri IIFE scope, `onclick="closeSett()"` ju nenašiel; prepísané na `addEventListener` v DCL bloku
- **Scroll zobrazoval iba 40 filmov** — `#scrnBody` nemal `top:90px` → absolutne pozicovaný div nemal výšku → `overflow-y:auto` nefungovalo; infinite scroll prepojený na `scrnBody` namiesto `mlist`
- **Scrollbar na ľavej strane nereagoval** — `fscroll` sledoval `mlist.scrollTop` ale scroll bol na `scrnBody`; prepojený na správny element
- **Pokročilý filter** — `openFp()` a `initFp()` boli správne wired, CSS `.fp-panel.open` existoval; problém bol maskovaný broken scrollom
- **Import/Pull tlačidlá na hlavnej ploche** — `emptyBtnZip`/`emptyBtnPull` boli wired ale `fileInp.click()` nefungoval kvôli broken layoutu; po fix #3 fungujú

### 🔄 Zmenené
- **Permanentne označený text v nastaveniach** — pridaný `user-select:none` na `.sett-panel`
- **hdr-left** (Obľúbené/Watchlist/Videné/Náhodný/Štatistiky) — `flex:1` s horizontálnym scrollom, `scrollbar-width:none`
- **hdr-right** (Filter/Sort/View/Settings) — `position:sticky;right:0` s pozadím — vždy viditeľné na pravej strane
- **hdr-icon active/on state** — vizuálna zmena pri zakliknutí (`color:var(--gold)`, bg highlight)
- **Infinite scroll** — citlivejší trigger (300px pred koncom namiesto 200px)
