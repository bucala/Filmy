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
