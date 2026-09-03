# Signal — Weekly Data Aggregation Script

Automates the weekly data pull for Word of Life Fellowship's Signal newsletter —
a youth-culture briefing covering movies/TV, music, gaming, podcasts, and
social trends. Replaces the manual Gemini-prompt workflow used during the
pilot.

## Status: tested against live APIs, in active weekly use

This is not a prototype — it has produced multiple real weekly issues against
live data, with real bugs found and fixed along the way (see "Design notes"
below). All 10 sources are currently working correctly:

- **TMDB** (movies/TV trending), **Apple Music**, **Christian Songs**
  (Billboard, with a PopVortex fallback), **Steam** (official weekly Top Sellers
  chart, storefront feed as fallback), **Apple App Store**
  (games + all-apps charts), **YouTube** (trending), **Apple Podcasts**,
  **Reddit** (r/teenagers, r/GenZ, r/TikTokCringe)

A **Data QA pass** (`qa.js`) runs automatically before the draft is built,
flagging duplicate entries and known parsing-artifact patterns even on
sources that reported success — this has caught real bugs (see below) that
a simple pass/fail check would have missed.

## Setup

```bash
npm install
cp .env.example .env
```

Then fill in `.env` with two free API keys:
1. **TMDB** — themoviedb.org → Settings → API (instant approval) — use the
   **v3 API Key**, not the longer v4 Read Access Token.
2. **YouTube Data API v3** — console.cloud.google.com → enable the API →
   create an API key (restrict it to YouTube Data API v3; "Public data",
   not "User data")

No key needed for Billboard/PopVortex, Steam, Apple (Music/Games/Apps/Podcasts),
or Reddit — all use public endpoints with no authentication required.

## Run it

**Step 1 — pull the data:**
```bash
npm start
```
Pulls all 10 sources, runs the Data QA pass, and writes `output/YYYY-MM-DD.md`
with a per-source success/failure summary printed to the console. Open the
draft — it starts with a **Data QA** section, then the real pulled data, then
three sections marked `> EDITOR:` for the human editor to complete (a social
trend write-up, five podcast picks with one-line descriptions, and a
one-sentence ministry angle tying a cultural moment to youth ministry).

**Step 2 — generate the branded HTML** once the editor's copy is locked in:
edit `build-branded.js` with this week's real data plus the editor's picks,
then:
```bash
node build-branded.js
```
`template/build-html.js` is a real code template (not a generative design
tool) that renders a WOL Fellowship–branded HTML email — numbered section
badges, italic subheads, styled callouts for the editor's picks. It has a
structural guardrail: it throws an error if a podcast pick doesn't exactly
match a real entry in that week's chart, so a fabricated pick can't
accidentally get rendered.

## Design notes — real bugs found and fixed, not just design choices

**Apple Music** replaced an earlier Spotify-based design. Spotify's
Client Credentials OAuth flow can no longer read Spotify-owned editorial
playlists (a November 2024 platform policy change restricts this for apps in
Development Mode) — no `.env` value fixes this, it's a Spotify-side
restriction. Apple's public Top Songs RSS feed is free, unauthenticated, and
was already the most reliable source in every prior test.

**Podcast charts** replaced an earlier attempt to scrape byspotify.com's
chart page. That page is a JS-rendered React app — a plain `fetch` only
returns the empty pre-render shell, so the scraper silently returned zero
results without ever throwing an error. Apple's official Top Podcasts JSON
feed (`rss.marketingtools.apple.com`) replaced it — free, unauthenticated,
same reliable pattern as the other Apple sources.

**Billboard Christian Songs** had a real parsing bug: the artist field was
briefly picking up chart-movement badges ("RE-ENTRY", "NEW") instead of the
real artist name, because those badges share the same CSS class as the rank
number on rows with a movement badge. Fixed by matching the artist span's
unique class combination instead of its position in the row.

**Steam** had duplicate entries in its own API response (not a scraping bug —
confirmed via direct API inspection that Steam's `featuredcategories`
endpoint returns literal duplicate item IDs for some entries). Deduped
client-side by ID.

**Reddit** went through two full rebuilds. The original OAuth (Client
Credentials) design got stuck on Reddit's app-creation form silently failing —
root cause was Reddit closing self-serve OAuth app registration in November
2025 in favor of an approval-request process (the "Responsible Builder
Policy"), not an account-karma issue as first suspected. Rebuilt on Reddit's
public Atom RSS feeds (`/r/<sub>/.rss`) instead — no auth, no app, no
approval needed. RSS lacks a "stickied" flag the old API had, so
chart-position mod/announcement posts are filtered by post age instead (a
structural proxy, not phrase-guessing) — confirmed real pinned posts were
dated months to years old while genuine content was 1-2 days old. A shared
keyword/content-safety filter (`sources/content-safety.js`) screens both
Reddit and its fallback, though this is explicitly a first-pass net, not a
substitute for the editor's review of every pick before publishing.

**YouTube comment fallback** (`sources/youtube-comments.js`): if Reddit fails
or is rate-limited, the pipeline automatically falls back to mining top
comments on the YouTube trending videos already pulled that run — reuses the
existing YouTube API key, adds no new credentials or failure points. Not a
like-for-like replacement for Reddit's discussion threads, but a genuine
"what are real people saying" signal tied directly to content already in the
newsletter. Has its own quality filters (rejects spam/promotional comments
and blank-line-padded troll comments) on top of the shared content-safety
screen.

## Known limitations

- **Reddit's RSS feed rate-limits** on rapid repeated requests, though it
  recovers within roughly a minute and is a non-issue at the actual once-a-week
  production cadence. The YouTube comment fallback covers any week it doesn't.
- The keyword/content-safety filter is a first-pass screen, not a complete
  solution — some categories of inappropriate content (e.g. a disturbing
  personal anecdote) share no vocabulary with anything keyword-blockable.
  The editor reviews every Social Pulse candidate before publishing, by
  design, and this will always be necessary regardless of how the filter
  list grows.
- Billboard and the Apple podcast feed are the two "scrapes a real page"
  sources most likely to need selector maintenance if either site's HTML
  structure changes — TMDB/YouTube/Steam/Apple RSS are official APIs and
  shouldn't break the same way.

## If a source fails

`run.js` is built so one failing source doesn't crash the whole run — it's
caught, logged to the console, and surfaced in the draft's Agent Notes
section so the editor knows to check that section manually.

## Next steps

- Register Signal as a formally-tracked project (pending an internal
  decision on which division/team owns it)
- Add a cron job to run this automatically every Monday
- Point the output at wherever the editor actually works from (email, shared
  doc, etc.)

## Changes 2026-09-03 (first live run since 2026-08-05)

- **Reddit was failing from Node but not from curl.** Same IP, same
  User-Agent, 8 seconds apart: curl got 200, Node's built-in `fetch()` got
  429 / 403 "Blocked". undici's default cross-origin headers
  (`sec-fetch-mode`, `accept-language: *`) trip Reddit's bot screen.
  `sources/reddit.js` now uses `fetchTextMinimal` (raw `https` module,
  sends only the headers it is given) from `sources/http.js`. Also added one
  65-second backoff retry for subreddits that come back 429/403, since the
  limit is per-IP and clears in about a minute.
- **Steam switched to the official weekly Top Sellers chart**
  (`IStoreTopSellersService/GetWeeklyTopSellers`), the same JSON the public
  chart page renders from. It returns 20 real games with an item type. The
  old `featuredcategories` storefront feed is kept as the fallback. Both
  paths now filter hardware SKUs (Steam Deck/Machine/Controller/Frame),
  DLC/"Supporter Edition" rows (type != 0), and duplicate ids. The draft
  labels which source produced the list.
- **Transient 5xx retries** for the no-auth JSON feeds (Apple Music/Games/
  Apps, Apple Podcasts, Steam) via `fetchJsonWithRetry` in `sources/http.js`.
  Prompted by a one-off 504 from Apple's podcast feed that blanked the
  Podcast section. 404/403/400 are not retried.
- **Content-safety filter widened** (`sources/content-safety.js`): strong
  profanity, slurs, and sexual-exploitation/abuse vocabulary. Prompted by a
  YouTube comment containing "FUCKING" and an r/teenagers title about AI
  child pornography both reaching the editor's candidate list.
- **Reddit candidate quality:** explicit `[mod]`/`[meta]`/megathread titles
  are dropped regardless of age, and titles with fewer than 15
  letters/digits (emoji-only, "DAWG WHAT") are dropped.
- **Template:** unreleased titles with no TMDB vote render as
  "not yet rated" instead of "Score: n/a".
- Still deliberately human-only: the Social Pulse pick, the five podcast
  blurbs, and the Ministry Angle sentence.
- **Politics filter** (later the same day, editorial rule from John Yarosh:
  "Absolutely no politics"): candidate titles/comments mentioning partisan
  figures, parties, elections, government bodies, or hot-button policy
  topics are dropped before the editor sees them. Deliberately broad.

