# 🎬 Filmová Databáza

Osobná webová databáza filmov s offline podporou, GitHub synchronizáciou a TMDB integráciou.

**Live:** https://filmy-iota.vercel.app

---

## ✨ Funkcie

- **GitHub Sync** — Načítanie databázy priamo z GitHub (bez tokenu). Push vyžaduje PAT token.
- **TMDB integrácia** — Automatické hodnotenia, plagáty a trailer pre každý film
- **TMDb → ČSFD matcher integrácia** — Otvorenie externej matcher appky a import jej CSV/JSON exportu podľa TMDb ID
- **Offline podpora** — Service Worker cachuje aplikáciu pre prácu bez internetu
- **Prehrávanie filmov** — Podpora VLC Protocol Handler, natívny prehrávač (file://), SMB sieťové cesty
- **Filtrovanie** — Podľa žánru, roku, hodnotenia, krajiny, obľúbených, watchlistu, videných
- **Štatistiky** — Prehľad kolekcie s grafmi (Chart.js)
- **Témy** — Dark / Linen / Paper skin
- **PWA** — Inštalovateľná ako aplikácia

---

## 🚀 Použitie

1. Otvor https://filmy-iota.vercel.app
2. Klikni **Načítať z GitHubu** — databáza sa stiahne automaticky
3. Pre ukladanie zmien nastav GitHub PAT token v nastaveniach ⚙️

---

## ⚙️ Nastavenia

| Sekcia | Popis |
|--------|-------|
| GitHub Sync | PAT token pre push, auto-pull pri štarte |
| Prehrávanie filmov | VLC / natívny prehrávač, lokálna / SMB cesta |
| TMDB | API kľúč pre automatické metadáta |
| ČSFD matcher | URL externej matcher appky a import ČSFD linkov/hodnotení |
| Admin | Pridanie filmu cez TMDB ID |

---

## 🗂️ Štruktúra

```
index.html   — Hlavná stránka
app.js       — Celá logika aplikácie
style.css    — Štýly
sw.js        — Service Worker
data.json    — Databáza filmov (GitHub)
manifest.webmanifest — PWA manifest
```

---

## 📋 Changelog

Pozri [CHANGELOG.md](CHANGELOG.md)
