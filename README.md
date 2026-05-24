# đźŽ¬ FilmovĂˇ DatabĂˇza

> OsobnĂˇ filmovĂˇ databĂˇza s pokroÄŤilĂ˝mi UI funkciami â€” verzia 9

![screenshot](screenshot.jpg)

## Popis projektu

FilmovĂˇ DatabĂˇza je mobilne-first webovĂˇ aplikĂˇcia (static HTML) na sprĂˇvu a prehÄľad osobnej zbierky filmov. NavrhnutĂˇ pre pouĹľitie s existujĂşcim backendom (GitHub: [bucala/Filmy](https://github.com/bucala/Filmy)).

---

## âś¨ Funkcie â€” Verzia 9

### 1. SeparĂˇtory s presvitajĂşcimi Ĺˇtatistikami
Medzi kaĹľdĂ˝mi dvoma kartami filmov je malĂˇ zaoblenĂˇ ikona (hviezdiÄŤka / hodiny / zoznam). Cez tĂşto ikonu **presvitĂˇ relevantnĂ© ÄŤĂ­slo** â€” poÄŤet obÄľĂşbenĂ˝ch, rok, celkovĂ˝ poÄŤet filmov. ÄŚĂ­slo je polopriesvitnĂ© (ghost overlay), ikona zostĂˇva ÄŤitateÄľnĂˇ.

### 2. Ikona hviezdy obÄľĂşbenĂ˝ch
- KaĹľdĂˇ filmovĂˇ karta mĂˇ tlaÄŤidlo s hviezdiÄŤkou vpravo
- Kliknutie spustĂ­ **pop animĂˇciu** + 7 zlatĂ˝ch iskier (particle efekt)
- AktĂ­vna hviezda: zlatĂˇ vĂ˝plĹ + `drop-shadow` Ĺľiara
- Ĺ˝ivĂ˝ zoznam obÄľĂşbenĂ˝ch sa okamĹľite aktualizuje
- PoÄŤĂ­tadlo obÄľĂşbenĂ˝ch v ĹˇtatistikĂˇch sa menĂ­ v reĂˇlnom ÄŤase

### 3. RozĹˇĂ­renĂ© menu nastavenĂ­ (accordion)
PlynulĂˇ CSS animĂˇcia (`grid-template-rows: 0fr â†’ 1fr`). Sekcie:
- **Zobrazenie** â€” rozloĹľenie, tmavĂ˝ reĹľim, ghost ÄŤĂ­sla, Ĺˇtatistiky v separĂˇtoroch
- **Triedenie** â€” radiĹĄ podÄľa, pamĂ¤taĹĄ filtre
- **DĂˇta** â€” zĂˇloha do cloudu, export JSON/CSV
- **NebezpeÄŤnĂˇ zĂłna** â€” vymazanie databĂˇzy

### 4. ÄŽalĹˇie vylepĹˇenia
- Live vyhÄľadĂˇvanie (filter podÄľa nĂˇzvu + rĂ©ĹľisĂ©ra)
- Filter chips podÄľa ĹľĂˇnru
- Progress bar videnĂ˝ch filmov
- SvetlĂˇ / tmavĂˇ tĂ©ma (toggle v topbare)
- Ghost ÄŤĂ­sla (rank) na pozadĂ­ kaĹľdej karty
- WCAG AA kontrast, keyboard navigĂˇcia, `aria-label` na vĹˇetkĂ˝ch tlaÄŤidlĂˇch

---

## đźš€ Spustenie

SĂşbor je ÄŤistĂ˝ **static HTML** â€” Ĺľiadne zĂˇvislosti, Ĺľiadny build krok.

```bash
# Otvorte priamo v prehliadaÄŤi:
open filmova-databaza-v9.html

# Alebo cez lokĂˇlny server:
npx serve .
python3 -m http.server 8080
```

---

## đź“ Ĺ truktĂşra

```
filmova-databaza-v9.html   â† kompletnĂˇ aplikĂˇcia (single-file)
README.md                  â† tento sĂşbor
CHANGELOG.md               â† histĂłria verziĂ­
```

---

## đź”— RepozitĂˇr

```
https://github.com/bucala/Filmy
```

---

## đź›  TechnolĂłgie

| TechnolĂłgia | PouĹľitie |
|---|---|
| HTML5 + CSS3 | Ĺ truktĂşra a dizajn |
| Vanilla JS | Interaktivita, animĂˇcie |
| Satoshi (Fontshare) | Typografia |
| CSS custom properties | Design tokens (dark/light mode) |
| `grid-template-rows` animĂˇcia | Accordion nastavenia |
| `drop-shadow` filter | Glow efekt hviezdy |
| OKLCH color space | ModernĂ© mieĹˇanie farieb |

---

## đź“¸ DizajnovĂ© rozhodnutia

### SeparĂˇtorovĂˇ ikona
InĹˇpirovanĂˇ originĂˇlnym dizajnom aplikĂˇcie (screenshot). MalĂ˝ zaoblenĂ˝ ĹˇtvorÄŤek s ikonou uprostred, umiestnenĂ˝ na stredovej ÄŤiare medzi kartami. Cez ikonu presvitĂˇ ÄŤĂ­slo Ĺˇtatistiky â€” `position: absolute`, `opacity: 0.18â€“0.22`, `font-weight: 900`.

### FarebnĂˇ schĂ©ma
- Primary: `#a78bfa` (fialovĂˇ) â€” tmavĂ˝ reĹľim
- Primary: `#7c3aed` (tmavĹˇia fialovĂˇ) â€” svetlĂ˝ reĹľim
- Gold: `#fbbf24` â€” obÄľĂşbenĂ©/hviezdiÄŤky
- Pozadie: `#0d0d10` (tmavĂ˝) / `#f0eff5` (svetlĂ˝)

---

*VytvorenĂ©: 24. mĂˇja 2026*
