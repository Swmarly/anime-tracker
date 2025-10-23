# Anime Tracker

A cute, pastel anime dashboard that renders a static snapshot of an Anime-Planet profile. All of the data lives in `public/profile.json`, so you can host the site anywhere that can serve static files—no Node server or proxy required.

## Features

- 🌸 Dreamy kawaii UI with gentle gradients and sparkles.
- 📊 Stat cards summarising watching, completed, and more.
- 🃏 Responsive anime cards with cover art, progress, and personal notes.
- 🔍 Instant search and per-status filtering to explore the collection.
- 🗂️ Works fully offline because the profile data ships with the site.

## Getting started

1. Open `public/index.html` directly in your browser, **or**
2. Serve the `public/` directory with any static web server (for example `python -m http.server`).

No build step is required.

## Updating the data

1. Export your Anime-Planet profile into `public/profile.json`.
2. Keep the existing structure (`username`, `bio`, `stats`, `statuses`, etc.) and update the values with your own data.
3. Refresh the page to see the new snapshot.

> Tip: each status (watching/completed/etc.) can use any label—just make sure each entry has a unique `slug`.

## Customisation

- Update colours, typography, or spacing in `public/styles.css`.
- Change the fallback imagery or copy in `public/app.js`.
- Add or remove statuses/items by editing `public/profile.json`.

## Deployment

Upload the contents of the `public/` directory to your static host of choice (Netlify, GitHub Pages, Cloudflare Pages, etc.) and you are done.
