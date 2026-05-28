# 🎬 FilmDB — Osobná filmová databáza

Lokálna webová aplikácia pre správu osobnej filmovej zbierky z EMDB exportu.

## Funkcie
- 📦 Import databázy zo ZIP (EMDB export) alebo PDF
- 🔍 Vyhľadávanie — presné aj fuzzy (Fuse.js)
- 🎭 Filtrovanie podľa žánru, roku, hodnotenia, krajiny
- ⭐ Obľúbené, Watchlist, Videné + dátumy
- 📊 Štatistiky s grafmi (Chart.js)
- 🖼 Automatické sťahovanie plagátov z TMDB
- 🔄 Synchronizácia s GitHub (auto-pull/push)
- ▶ Prehrávanie filmov cez VLC alebo natívny prehrávač
- 🌐 Podpora lokálnych aj sieťových (SMB) ciest

## Prehrávanie filmov
| Režim | Popis |
|---|---|
| **Lokálna cesta (W:\)** | Priama cesta z EMDB — funguje pri lokálnom HTML |
| **Sieťová cesta (SMB)** | Prevedie W:\ na smb:// pre VLC cez sieť |
| **Natívny prehrávač** | Použije file:// protokol namiesto vlc:// |

## GitHub Sync
1. Nastav Personal Access Token (repo scope) v Nastaveniach
2. Nastav `GH_REPO`, `GH_FILE`, `GH_BRANCH` v `app.js`
3. Auto-pull pri štarte (default: zapnuté)
4. Auto-push po každej zmene (5s debounce)

## Technológie
- Vanilla JS (ES6+), HTML5, CSS3
- [Fuse.js](https://fusejs.io/) — fuzzy search
- [Chart.js](https://www.chartjs.org/) — grafy
- [JSZip](https://stuk.github.io/jszip/) — ZIP import
- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF import
- GitHub REST API — synchronizácia

## Vetva
Aktívny vývoj: `Perplexity` → merge do `main` po testovaní
