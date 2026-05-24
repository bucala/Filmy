# Changelog — Filmová Databáza

Všetky významné zmeny sú zdokumentované v tomto súbore.  
Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/).  
Verziovanie sleduje [Semantic Versioning](https://semver.org/).

---

## [9.0.0] — 2026-05-24

### ✨ Pridané
- **Separátory s presvitajúcimi štatistikami** — každý separator medzi kartami filmov obsahuje zaoblený štvorček (`28×28 px`) s ikonou; cez ikonu presvitá ghost číslo (polopriesvitné, `opacity 0.18–0.22`):
  - Hviezdičková ikona → aktuálny počet obľúbených filmov (mení sa živě)
  - Hodinová ikona → rok filmov v danom bloku (napr. `25` pre 2025)
  - Zoznamová ikona → celkový počet filmov v databáze (`1736`)
- **Animácia hviezdy obľúbených** — `star-pop` keyframe (scale 1→1.5→0.85→1 s rotáciou) + 7 iskier (`spark-fly`) rozletujúcich sa do okolia
- **Ghost čísla na pozadí filmových kariet** — poradie (`data-rank-short`) presvitá cez `::before` pseudo-element, `opacity 0.025`, pri hoveri `0.04`
- **Ghost čísla v stat kartách** — každá štatistická karta má `::after` s veľkým presvitajúcim číslom v pozadí
- **Rozšírené nastavenia** — nové skupiny v skladateľnom paneli:
  - Toggle: Štatistiky v separátoroch (vypne/zapne ghost čísla)
  - Toggle: Ghost čísla na kartách
  - Select: Export databázy (JSON / CSV)
  - Sekcia Nebezpečná zóna: Vymazať databázu
- **Progress bar videných filmov** — vizuálna lišta s percentom (`89 / 1736 = 5.1 %`)
- **Tmavý / svetlý režim** — pill prepínač ☀️ / 🌙 v topbare (okamžitý, bez reloadu)
- **Live vyhľadávanie** — input v topbare filtruje podľa názvu aj réžiséra; aktualizuje počítadlo `X z Y`
- **Filter žánrov** — chip lišta (Všetky · Horor · Sci-Fi · Thriller · Mysteriózny · Dobrodružný · Akčný)

### 🔄 Zmenené
- Topbar redesign — logo + vyhľadávací vstup + theme pill + gear ikona
- Filmové karty prepracované na `grid-template-columns: 56px 1fr 38px`
- Poster má vnorený rank badge (absolútne pozicionovaný, blur backdrop)
- Stat karty zmenšené na 4-stĺpcovú mriežku, fluid `clamp()` veľkosti
- Separátory zmenené z čistej dekorácie na interaktívne štatistické elementy
- Nastavenia — panel teraz používa `grid-template-rows: 0fr → 1fr` pre plynulé otvorenie (bez JS výšky)
- Farba akcentu zjednotená: fialová `#a78bfa` (primary), zlatá `#fbbf24` (obľúbené)

### 🐛 Opravené
- Separator ghost číslo sa teraz aktualizuje pri každom toggle obľúbeného
- Filter chips správne resetuje search query pri zmene žánru
- Fav badge počítadlo synchronizované so stat kartou

---

## [8.0.0] — 2026-05-24

### ✨ Pridané
- Základné separátory medzi kartami s hviezdičkovou ikonou
- Zoznam obľúbených s live aktualizáciou
- Skladateľný panel nastavení (Zobrazenie · Triedenie · Synchronizácia · Nebezpečná zóna)
- Star-pop animácia + particle efekt pri pridaní do obľúbených
- Ghost rank čísla na pozadí filmových kariet
- Stats banner s presvitajúcim číslom

### 🔄 Zmenené
- Kompletný redesign filmových kariet
- Nová farebná paleta — tmavé povrchy s fialovým akcentom

---

## [7.0.0] — 2026-05-23

### ✨ Pridané
- Stats banner (celkom / obľúbené / videné / hodnotenie)
- Filter chips pre žánre
- Bottom navigation bar

### 🔄 Zmenené
- Migrovaný font z Inter na Satoshi
- Spacing systém prepísaný na 4px grid s CSS premennými

---

## [6.0.0] — 2026-05-22

### ✨ Pridané
- Hviezda obľúbených na každej karte
- Tmavý režim (základný)
- Sticky topbar s blur efektom

---

## [5.0.0] — 2026-05-21

### ✨ Pridané
- Filmové karty s posterom, titulom, metadátami, tagmi
- CSS design tokeny (farby, spacing, typografia)
- Základná responzivita pre mobile

---

## [1.0.0 – 4.0.0] — 2026-05-20

### Iniciálne verzie
- Základný HTML zoznam filmov
- Iteratívne UI vylepšenia
- Pridanie CSS premenných a fluid typografie
