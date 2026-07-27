# Signal — Weekly Data Aggregation Script

Automates the weekly data pull for Word of Life Fellowship's Signal newsletter.
Replaces the manual Gemini-prompt workflow used during the pilot.

## Status: written and syntax-checked, NOT yet tested against live APIs

Every file here has been verified to:
- Install cleanly (`npm install` succeeded, 0 vulnerabilities)
- Parse as valid JavaScript (`node --check` passed on every file)
- Produce correctly-formatted output when tested with mock data
  (the template builder logic is fully verified)

What has **not** been tested: any live network call to TMDB, Spotify, YouTube,
Steam, Apple, Reddit, or the podcast charts site. That requires a real API
key and a real internet connection — neither was available in the sandbox
this was built in. **This is the first thing to do when you open this in
Claude Code.**

## Setup

```bash
npm install
cp .env.example .env
```

Then fill in `.env` with three free API keys:
1. **TMDB** — themoviedb.org → Settings → API (instant approval)
2. **YouTube Data API v3** — console.cloud.google.com → enable the API → create an API key
3. **Spotify** — developer.spotify.com/dashboard → Create App → copy Client ID + Secret

No key needed for Billboard/PopVortex, Steam, Apple, Reddit, or podcast charts.

## Run it

```bash
npm start
```

This pulls all 10 sources in parallel, writes `output/YYYY-MM-DD.md`, and
prints a per-source success/failure summary to the console.

## Design notes — why these specific sources were chosen

**Spotify** uses the official Web API against Spotify's own editorial
"Top 50 - Global" playlist (ID `37i9dQZEVXbMDoHDwVN2tF`), not a scrape of
charts.spotify.com. The scraped version produced unreliable/reordered
results across three separate pilot runs with Gemini — this should fix that,
since it's pulling structured data from Spotify's actual API rather than
parsing a JS-rendered page.

**YouTube** uses the official Data API with an API key — stateless, no
browser session. The Gemini pilot's browser-based approach produced an
identical "trending" list two weeks in a row, which strongly suggested it
wasn't a genuine live pull. This should be a real fix since there's no
session/personalization involved.

**Billboard Christian Songs** tries Billboard directly first, then falls
back to PopVortex's iTunes Christian & Gospel chart if Billboard's paywall
blocks it (which it did during the pilot). The fallback is a real, working,
free source — confirmed during testing.

**Steam** uses the public `featuredcategories` JSON endpoint instead of
scraping the topsellers HTML page — same data, more stable format.

**Apple, Reddit** are unchanged from the pilot — both were reliable
throughout and use native JSON/RSS, no scraping.

**Podcast charts** still scrapes byspotify.com's public chart page — there's
no clean API alternative here, so this one may need selector maintenance
if the page structure changes.

## Known limitation to verify first

The CSS selectors in `sources/billboard.js` (fallback) and
`sources/podcasts.js` are best-effort based on typical page structure —
they have NOT been verified against the live rendered HTML, since this
sandbox can't reach those sites. **First task in Claude Code: run this,
see what breaks, and fix selectors against the actual live pages.**

## If a source fails

`run.js` is built so one failing source doesn't crash the whole run — it's
caught, logged to the console, and surfaced in the draft's Agent Notes
section so the editor knows to check that section manually.

## Next steps after this works

- Add a cron job (`0 7 * * 1 ...`) to run this automatically every Monday
- Point the output at wherever the editor actually works from (email, shared doc, etc.)
