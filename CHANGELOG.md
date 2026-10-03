# Changelog

Všetky významné zmeny v projekte sú dokumentované v tomto súbore.

Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

---

## [Unreleased]

### Pridané
- **Podpísané vydania**: manuálny workflow `Signed release` pre Windows (PFX/P12) a Android release APK/AAB; podpisové secrets sú oddelené od PR buildov, podpisy sa overujú pred nahraním artefaktov a pribudli SHA-256 súčty. Aktivácia vyžaduje certifikát/keystore, postup v `SIGNING.md`.
- **Vnorené prehrávanie v MPC-HC/BE** — natívne vnorenie okna prehrávača priamo do desktop appky cez Win32 `SetParent` (koffi FFI), s fullscreen overlay UI (`desktop/embed-win.js`)
- **CI workflow** — `npm ci && npm run lint && npm test` na každý push/PR (`.github/workflows/ci.yml`)
- **Testy prehliadania knižnice**: 19 nových testov pre presné a fuzzy vyhľadávanie, invalidáciu cache, debounce a stránkovanie (`test/browse.test.js`)
- **Skratka vyhľadávania**: `Ctrl+K` / `Cmd+K` dopĺňa `/` bez preberania fokusu z otvoreného detailu alebo panelu
- **Testy štartu desktopu**: overenie vypnutia GPU akcelerácie pred pripravenosťou Electronu na Windows a zachovania predvoleného vykresľovania na Linux/macOS (`test/desktop-startup.test.js`).

### Opravené
- **Windows blikanie — opatrenie**: Electron pred inicializáciou aplikácie vypína hardvérovú akceleráciu iba na Windows, aby obmedzil blikanie pri GPU vykresľovaní na monitoroch s vysokou frekvenciou/VRR (napr. G-Sync, 180 Hz). Účinok na konkrétnom monitore ešte vyžaduje overenie; natívny MPC/VLC používa vlastný renderer.
- **Bezpečnosť (XSS)** — escapovanie `poster_thumb` a `director` polí pri vykresľovaní (uložené XSS cez neescapovaný HTML atribút/`innerHTML`)
- **Bezpečnosť (Electron IPC)** — validácia cesty k súboru (`isSafeMoviePath`) pred spustením prehrávača z renderer procesu
- **Bezpečnosť (protokol handler)** — `mpc://`/`vlc://` handlery (`setup/MPC-Handler`, `setup/VLC-Handler`) už nikdy nespustia neoverenú cestu z URL, keď prehrávač nie je nájdený v známych cestách ani v `PATH` — predtým šlo o spustenie ľubovoľného kódu cez vlastnú URL schému
- **Vnorené prehrávanie — obnova rendereru** — `embed-win.js` teraz pri zatvorení/crashi MPC vždy obnoví pôvodný DirectShow renderer namiesto trvalej zmeny v registri
- **desktop balík** — natívna binárka `koffi` je teraz vyňatá z `asar` archívu (`asarUnpack`), inak by nefungovala v zabalenej (installer) appke
- **Android inštalácia** — `minSdk` znížený z 26 na 24 (opravuje zlyhanie inštalácie na starších zariadeniach ako Xiaomi Mi Pad 3)
- **Android CI**: `setup-android@v3` explicitne inštaluje iba `platform-tools`, nie odstránený balík `tools`; opravené zlyhanie prípravy SDK ešte pred spustením Gradlu
- **Android výkon** — debounce vyhľadávania (180 ms) a nižšia `PAGE_SIZE` (40 → 24) pre plynulejší chod na slabších zariadeniach
- **Vyhľadávanie a fokus**: dokončenie IME zadávania spustí vyhľadávanie, Enter ho vykoná okamžite a vymazanie/reset zruší čakajúcu úlohu; návrat z detailu aj prázdna kolekcia zachovajú použiteľný fokus
- **Posterwall a svetlé témy**: opravené prekrývanie riadkov plagátov na úzkych obrazovkách a zvýšený kontrast tlmeného textu v témach Linen a Paper
- **Hromadný výber a filtre**: stav výberu sa zachová pri prekreslení, tlačidlá oznamujú svoj stav a označenie všetkých jasne zahŕňa iba zobrazené filmy

### Zmenené
- **Android distribúcia**: release signing z premenných prostredia, odmietnutie balenia nepodpísaného release a samostatné debug ID `.debug`; vypnutý WebView file access a explicitne vypnutý debugging v release. Staré debug inštalácie vyžadujú export dát a reinštaláciu pred prechodom na iný kľúč.
- **Odstránený riadok nad filmami**: názov kolekcie (napr. „Moja knižnica“), počet filmov a označenie zobrazenia už nezaberajú samostatný riadok na žiadnej platforme; odstránené aj súvisiace štýly a aktualizácie textov. Reset zostáva cez ikonu knižnice a pri prázdnych výsledkoch.
- **Kompaktná hlavička (do 700 px)**: vyhľadávanie, inštalácia a nastavenia vedľa seba; navigačné ikony sú posúvateľné v spoločnom riadku s radením, filtrom a prepínačom zobrazenia. Odstránený opakovaný názov databázy pri logu a pomocná veta pod názvom kolekcie vo webovej, Android aj desktop verzii.
- **Offline cache**: nová verzia shell cache pre aktualizovanú hlavičku; cache posterov zostáva zachovaná.
- **android/BUILD.md** — kompletne prepísaný, dokumentuje aktuálny natívny WebView shell (nie zastaraný Bubblewrap/TWA postup)
- **android/twa-manifest.json** — odstránené heslo v plain texte z historického (nepoužívaného) konfiguračného súboru
- **Responzívne rozhranie**: prehľadnejšia hlavička, navigácia, karty, filtre a prázdne stavy vo všetkých troch zobrazeniach; zachovaných všetkých šesť tém aj TV ovládanie
- **Vyhľadávanie**: presné zhody bez Fuse indexu, jeden lenivo vytvorený index a cache ôsmich fuzzy dopytov zdieľaná medzi filtrami; úprava databázy cache zneplatní. Prvé fuzzy hľadanie stále vyžaduje vytvorenie indexu a nezacachované vyhľadávanie
- **Vykresľovanie knižnice**: delegované udalosti, dávky po 24 kartách plánované cez `requestAnimationFrame` a opätovné použitie domovských riadkov; nový helper `src/lib/browse.js` je súčasťou offline cache
- **README**: aktuálna ES-module architektúra, responzívne zobrazenia, rozdelený sync, klávesové ovládanie, offline obmedzenia a príkazy na lint/testy; meranie odozvy uvádza aj náklady prvého fuzzy hľadania

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
