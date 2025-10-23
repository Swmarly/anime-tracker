# Anime Tracker

A cute, pastel anime dashboard that fetches an Anime-Planet profile (Swmarly by default) and displays their lists with kawaii flair. The app works fully offline with a handcrafted sample profile and will switch to live data when the proxy request succeeds.

## Features

- 🌸 Dreamy kawaii UI with gentle gradients and sparkles.
- 📊 Animated stat cards summarising watching, completed, and more.
- 🃏 Responsive anime cards with cover art, progress, and personal notes.
- 🔍 Instant search and per-status filtering to find shows quickly.
- 🔄 Built-in proxy endpoint to bypass CORS and reuse Anime-Planet HTML.
- 🧸 Graceful fallback sample data so the garden still blooms without network access.

## Getting started

```bash
npm install # (optional, no dependencies required)
npm run start
```

Then visit [http://localhost:3000](http://localhost:3000) in your browser.

> **Tip:** If Anime-Planet blocks the proxy, use the “Use sample data” button to explore the interface.

## Customisation

- Change the default username in `public/app.js` or type another username in the input.
- Update colours, typography, or spacing in `public/styles.css`.
- Modify the offline dataset in `public/sample-profile.json` (and `data/sample-profile.json` for the API fallback).

## Notes

- The `/api/profile` endpoint simply proxies HTML from Anime-Planet using native Node.js modules (no extra dependencies required).
- Anime-Planet may employ rate-limiting or bot detection. If a request fails, the UI transparently falls back to the included sample.
- Parsing of Anime-Planet HTML happens in the browser via `DOMParser`, so selectors may need tweaks if the site’s layout changes.
