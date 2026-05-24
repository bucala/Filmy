# 🎬 Filmová Databáza

> Osobná filmová databáza — single-file HTML aplikácia, dark mode, TMDB integrácia, VLC prehrávanie

## Popis

**Filmová Databáza** je mobilne-first webová aplikácia (čistý static HTML, žiadny build krok) na správu osobnej zbierky filmov. Dáta sa ukladajú do `localStorage` a synchronizujú na GitHub cez API.

---

## ✨ Hlavné funkcie (v9.x)

| Funkcia | Detail |
|---|---|
| 📥 Import z EMDB ZIP | Automatický import filmov, plagátov, trailerov a ciest zo ZIP exportu z EMDB |
| 🎬 TMDB integrácia | Stiahnutie hodnotení, trailer linkov a HD plagátov pre všetky filmy (~7 min) |
| ▶ VLC prehrávanie | Spustenie lokálnych `.mkv` súborov cez VLC Protocol Handler alebo natívny prehrávač |
| 🔄 SMB/lokálna cesta | Prepínač medzi lokálnou (W:\) a sieťovou (smb://) cestou k filmom |
| ☁ GitHub sync | Push/Pull dát do repozitára `bucala/Filmy` cez PAT token; auto-push pri zmenách |
| 🔎 Vyhľadávanie | Fulltextové cez Fuse.js (názov, réžisér) s živým zvýraznením |
| 🔖 Filtrovanie | Filter chips podľa žánru, zobrazenie obľúbených / watchlistu / videných |
| 📊 Štatistiky | Panel so štatistikami, hodnoteniami a prehľadom databázy |
| 🎨 6 skin-ov | Dark · Slate · Crimson · Forest · Linen · Paper — s vlastnou farbou akcentu |

---

## 🚀 Spustenie

```bash
# Otvorte priamo v prehliadači (lokálne prehrávanie funguje iba lokálne):
open index.html

# Alebo cez lokálny server:
python3 -m http.server 8080
```

Aplikácia funguje ako **pure static HTML** — žiadne závislosti, žiadny build. Externé CDN:
- `pdf.js` — parsovanie PDF
- `jszip` — parsovanie EMDB ZIP exportu
- `fuse.js` — fuzzy vyhľadávanie
- Google Fonts: `Bebas Neue`, `JetBrains Mono`

---

## 📁 Štruktúra repozitára

```
index.html     ← kompletná aplikácia (single-file, ~19 MB s dátami)
data.json      ← synchronizovaná databáza filmov (cez GitHub API)
README.md      ← tento súbor
changelog.md   ← história verzií
```

---

## ⚙ Nastavenia

### Import databázy
1. Exportujte z EMDB: `File → Export → HTML`
2. V aplikácii: `Nastavenia → Databáza filmov → NAHRAŤ NOVÚ DATABÁZU`
3. Vyberte `.zip` súbor

### TMDB API
1. Zaregistrujte sa na [themoviedb.org](https://www.themoviedb.org/)
2. `Settings → API → API Key (v3 auth)`
3. Vložte do `Nastavenia → TMDB Metadáta → API kľúč`
4. Kliknite `Spustiť načítanie dát`

### GitHub sync
1. Vytvorte [PAT token](https://github.com/settings/tokens/new?scopes=repo) so scope `repo`
2. Vložte do `Nastavenia → Záloha → GitHub sync`
3. `Uložiť do GitHubu` — uloží do `data.json` v tomto repozitári

### VLC prehrávanie
- Nainštalujte [VLC Protocol Handler](https://github.com/Morgyn/VLCProtocol-Handler/releases) do priečinka VLC
- V nastaveniach prepnite režim ciest: `Lokálna (W:\)` alebo `Sieťová (SMB)`
- Kliknite `▶ Prehrať film` v detaile libovolného filmu

---

## 🛠 Technológie

| Technológia | Použitie |
|---|---|
| HTML5 + CSS3 + Vanilla JS | Celá aplikácia, bez frameworkov |
| CSS custom properties | Design tokens, 6 skin-ov, dynamické farby |
| `JSZip` | Parsovanie EMDB HTML ZIP exportu |
| `pdf.js` | Legacy PDF import (backwards compat) |
| `Fuse.js` | Fuzzy vyhľadávanie |
| TMDB API | HD plagáty, hodnotenia, trailery |
| GitHub Contents API | Sync `data.json` |
| VLC Protocol Handler | Spustenie `.mkv` z prehliadača |
| `Bebas Neue` + `JetBrains Mono` | Typografia |

---

## 🔗 Repozitár

```
https://github.com/bucala/Filmy
```

*Vytvorené: máj 2026*
