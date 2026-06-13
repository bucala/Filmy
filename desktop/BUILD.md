# Filmy — Windows/Linux Desktop Build Guide

## Prerequisites
- Node.js 18+

## Quick Start

```bash
cd desktop
npm install
npm start          # run locally
```

## Build Installer

```bash
# Windows (produces .exe installer + portable .exe)
npm run build:win

# Linux (produces .AppImage)
npm run build:linux
```

Output is in `desktop/dist/`.

## Configuration

- **`PROD_URL`** in `main.js` — change this to your actual Vercel deployment URL
- The app tries to load the deployed URL first; if offline, falls back to local `index.html`
- Window size, title, and menu are configured in `main.js`

## Alternative: PWABuilder

1. Go to https://www.pwabuilder.com
2. Enter: `https://filmy-iota.vercel.app`
3. Click "Package for stores" → Windows
4. Download the MSIX package

No local tools needed.
