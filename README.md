# CardGuard

Never Miss an Expiry Again.

## What this app does

- Add any card/document/fee with an expiry date.
- Optional: attach a card image.
- Shows expiring/expired status and provides an optional Renew link.
- Stores everything locally on your device (IndexedDB).

## Run locally

1. Install dependencies

```bash
npm install
```

2. Start dev server

```bash
npm run dev
```

## Install on phone (PWA)

- Android (Chrome): open the site, then menu → **Add to Home screen**.
- iPhone (Safari): Share → **Add to Home Screen**.

## Free hosting options

This is a static site, so you can host it for free on:

- GitHub Pages
- Netlify
- Cloudflare Pages

Build command:

```bash
npm run build
```

The output folder is `dist/`.

## Data & privacy

Card data + images are stored **locally on the device**. If you clear browser storage or uninstall the app, your local data may be removed.
