# 🎬 Filmová Databáza

> Osobná filmová databáza s pokročilými UI funkciami — verzia 9

![screenshot](screenshot.jpg)

## Popis projektu

Filmová Databáza je mobilne-first webová aplikácia (static HTML) na správu a prehľad osobnej zbierky filmov. Navrhnutá pre použitie s existujúcim backendom (GitHub: [bucala/Filmy](https://github.com/bucala/Filmy)).

---

## ✨ Funkcie — Verzia 9

### 1. Separátory s presvitajúcimi štatistikami
Medzi každými dvoma kartami filmov je malá zaoblená ikona (hviezdička / hodiny / zoznam). Cez túto ikonu **presvitá relevantné číslo** — počet obľúbených, rok, celkový počet filmov. Číslo je polopriesvitné (ghost overlay), ikona zostáva čitateľná.

### 2. Ikona hviezdy obľúbených
- Každá filmová karta má tlačidlo s hviezdičkou vpravo
- Kliknutie spustí **pop animáciu** + 7 zlatých iskier (particle efekt)
- Aktívna hviezda: zlatá výplň + `drop-shadow` žiara
- Živý zoznam obľúbených sa okamžite aktualizuje
- Počítadlo obľúbených v štatistikách sa mení v reálnom čase

### 3. Rozšírené menu nastavení (accordion)
Plynulá CSS animácia (`grid-template-rows: 0fr → 1fr`). Sekcie:
- **Zobrazenie** — rozloženie, tmavý režim, ghost čísla, štatistiky v separátoroch
- **Triedenie** — radiť podľa, pamätať filtre
- **Dáta** — záloha do cloudu, export JSON/CSV
- **Nebezpečná zóna** — vymazanie databázy

### 4. Ďalšie vylepšenia
- Live vyhľadávanie (filter podľa názvu + réžiséra)
- Filter chips podľa žánru
- Progress bar videných filmov
- Svetlá / tmavá téma (toggle v topbare)
- Ghost čísla (rank) na pozadí každej karty
- WCAG AA kontrast, keyboard navigácia, `aria-label` na všetkých tlačidlách

---

## 🚀 Spustenie

Súbor je čistý **static HTML** — žiadne závislosti, žiadny build krok.

```bash
# Otvorte priamo v prehliadači:
open filmova-databaza-v9.html

# Alebo cez lokálny server:
npx serve .
python3 -m http.server 8080
```

---

## 📁 Štruktúra

```
filmova-databaza-v9.html   ← kompletná aplikácia (single-file)
README.md                  ← tento súbor
CHANGELOG.md               ← história verzií
```

---

## 🔗 Repozitár

```
https://github.com/bucala/Filmy
```

---

## 🛠 Technológie

| Technológia | Použitie |
|---|---|
| HTML5 + CSS3 | Štruktúra a dizajn |
| Vanilla JS | Interaktivita, animácie |
| Satoshi (Fontshare) | Typografia |
| CSS custom properties | Design tokens (dark/light mode) |
| `grid-template-rows` animácia | Accordion nastavenia |
| `drop-shadow` filter | Glow efekt hviezdy |
| OKLCH color space | Moderné miešanie farieb |

---

## 📸 Dizajnové rozhodnutia

### Separátorová ikona
Inšpirovaná originálnym dizajnom aplikácie (screenshot). Malý zaoblený štvorček s ikonou uprostred, umiestnený na stredovej čiare medzi kartami. Cez ikonu presvitá číslo štatistiky — `position: absolute`, `opacity: 0.18–0.22`, `font-weight: 900`.

### Farebná schéma
- Primary: `#a78bfa` (fialová) — tmavý režim
- Primary: `#7c3aed` (tmavšia fialová) — svetlý režim
- Gold: `#fbbf24` — obľúbené/hviezdičky
- Pozadie: `#0d0d10` (tmavý) / `#f0eff5` (svetlý)

---

*Vytvorené: 24. mája 2026*
