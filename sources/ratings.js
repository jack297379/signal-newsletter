// sources/ratings.js
// Content flags for the chart items (v2 format, 2026-10-09, John Yarosh).
// The Signal now goes to youth leaders AND parents on one list, and the
// decision for charts is "show as is, with a flag" - so nothing here ever
// drops or reorders a chart row. It only adds `rating` (a short label such as
// "PG-13", "TV-MA", "Explicit", "17+", "ESRB T") and `advisories` (the
// publisher's own descriptor list, verbatim) to rows we can look up, and a
// `crudeTitle` flag when the title itself contains language the Social Pulse
// filter would have blocked.
//
// Every lookup is best-effort. A failed or missing rating leaves the row
// unflagged and adds a note for Agent Notes; it never fails the run. Ratings
// come only from the publisher's data, never inferred - a row with no rating
// renders with no chip rather than a guess.
//
// Sources (all verified live 2026-10-09):
//   TMDB  /movie/{id}/release_dates  -> US certification (MPA)
//   TMDB  /tv/{id}/content_ratings   -> US TV rating
//   iTunes lookup?id=a,b,c           -> songs: trackExplicitness;
//                                       apps: trackContentRating + advisories
//   apps.apple.com/us/app/id{N}      -> apps: the age rating the storefront
//                                       shows. Apple moved to 4+/9+/13+/16+/18+
//                                       tiers, but the lookup API still returns
//                                       the old 4+/9+/12+/17+ (found 2026-10-19:
//                                       Claude and Muse show 18+, KICK 16+,
//                                       ChatGPT 13+). The storefront wins; the
//                                       lookup value is the fallback.
//   Steam appdetails?appids=N        -> ratings.esrb {rating, descriptors}
//   YouTube trending has no usable rating (contentRating comes back empty).

import 'dotenv/config';
import { fetchJsonWithRetry } from './http.js';
import { isBlocked, isPolitical } from './content-safety.js';

const TMDB = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;

// Milder words that the Social Pulse filter does not block but a parent
// reading a forwarded email would notice. Flag only, never drop.
const CRUDE_TITLE_PATTERNS = [
  /\bhoes?\b/i,
  /\bb[i1!]tch/i,
  /\bsh[i1!]t/i,
  /\bf[u*]ck/i,
  /\bdamn\b/i,
  /\bass(es)?\b/i,
  /\bcrap\b/i,
];

// isBlocked() also covers politics, so politics is checked first and kept
// as its own flag rather than mislabeled "crude".
export function hasCrudeTitle(text) {
  const t = text || '';
  if (CRUDE_TITLE_PATTERNS.some((re) => re.test(t))) return true;
  return !isPolitical(t) && isBlocked(t);
}

async function tmdbMovieRating(id) {
  const data = await fetchJsonWithRetry(`${TMDB}/movie/${id}/release_dates?api_key=${TMDB_KEY}`, { label: `TMDB movie ${id} ratings` });
  const us = (data.results || []).find((r) => r.iso_3166_1 === 'US');
  const cert = (us?.release_dates || []).map((d) => d.certification).find((c) => c && c.trim());
  return cert ? { rating: cert } : null;
}

async function tmdbTvRating(id) {
  const data = await fetchJsonWithRetry(`${TMDB}/tv/${id}/content_ratings?api_key=${TMDB_KEY}`, { label: `TMDB tv ${id} ratings` });
  const us = (data.results || []).find((r) => r.iso_3166_1 === 'US');
  return us?.rating ? { rating: us.rating } : null;
}

// One batched call for a whole list. Returns Map(id -> result row).
async function itunesLookup(ids) {
  const clean = ids.filter(Boolean);
  if (!clean.length) return new Map();
  const data = await fetchJsonWithRetry(`https://itunes.apple.com/lookup?id=${clean.join(',')}&country=us`, { label: 'iTunes lookup' });
  return new Map((data.results || []).map((r) => [String(r.trackId), r]));
}

// Reads the "Age Rating" figure from the public App Store page.
export async function storefrontAgeRating(id) {
  const res = await fetch(`https://apps.apple.com/us/app/id${encodeURIComponent(id)}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`App Store page ${id}: HTTP ${res.status}`);
  const html = await res.text();
  const at = html.search(/Age Rating/i);
  if (at < 0) return null;
  const m = html.slice(at, at + 400).replace(/<[^>]*>/g, ' ').match(/(\d{1,2}\+)/);
  return m ? m[1] : null;
}

export async function refreshAppRatings(rows, notes) {
  for (const row of rows || []) {
    if (!row.id) continue;
    try {
      const r = await storefrontAgeRating(row.id);
      if (r) row.rating = r;
    } catch (err) {
      notes.push(`Ratings (App Store page): ${row.name}: ${err.message}`);
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
}

// Billboard rows (Christian Songs) carry no Apple id, so the email had to
// link to an Apple Music search. This finds the song with the free iTunes
// Search API and keeps it only on an exact (case-insensitive) title AND
// artist match, so a link never points at the wrong song (2026-10-19).
const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
export async function resolveAppleSongIds(rows, notes) {
  for (const row of rows || []) {
    if (row.id) continue;
    try {
      const term = encodeURIComponent(`${row.title} ${row.artist || ''}`.trim());
      const data = await fetchJsonWithRetry(`https://itunes.apple.com/search?term=${term}&entity=song&country=us&limit=10`, { label: `iTunes search ${row.title}` });
      const hit = (data.results || []).find((r) => norm(r.trackName) === norm(row.title) && norm(r.artistName) === norm(row.artist));
      if (hit) {
        row.id = String(hit.trackId);
        if (hit.trackExplicitness === 'explicit') row.rating = 'Explicit';
      } else {
        notes.push(`Apple Music link: no exact match for "${row.title}" by ${row.artist}; email falls back to a search link.`);
      }
    } catch (err) {
      notes.push(`Apple Music link (${row.title}): ${err.message}`);
    }
  }
}

async function steamRating(id) {
  const data = await fetchJsonWithRetry(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=us&l=en`, { label: `Steam app ${id}` });
  const d = data?.[id]?.data;
  const esrb = d?.ratings?.esrb;
  if (!esrb?.rating) return null;
  const split = (s) => (s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return {
    rating: `ESRB ${esrb.rating.toUpperCase()}`,
    advisories: [...split(esrb.descriptors), ...split(esrb.interactive_elements)],
  };
}

async function eachRow(rows, label, notes, fn) {
  for (const row of rows || []) {
    try {
      const r = await fn(row);
      if (r) Object.assign(row, r);
    } catch (err) {
      notes.push(`Ratings (${label}): ${row.title || row.name}: ${err.message}`);
    }
  }
}

// Mutates the chart arrays in place. Returns notes for Agent Notes.
export async function addContentFlags(byLabel) {
  const notes = [];

  if (TMDB_KEY) {
    await eachRow(byLabel['TMDB Movies'], 'movies', notes, (m) => (m.id ? tmdbMovieRating(m.id) : null));
    await eachRow(byLabel['TMDB TV'], 'TV', notes, (s) => (s.id ? tmdbTvRating(s.id) : null));
  }

  for (const label of ['Apple Music', 'Apple Games', 'Apple All Apps']) {
    const rows = byLabel[label] || [];
    try {
      const found = await itunesLookup(rows.map((r) => r.id));
      for (const row of rows) {
        const hit = found.get(String(row.id));
        if (!hit) continue;
        if (hit.wrapperType === 'track' || hit.kind === 'song') {
          if (hit.trackExplicitness === 'explicit') row.rating = 'Explicit';
        } else if (hit.trackContentRating) {
          row.rating = hit.trackContentRating;
          if (Array.isArray(hit.advisories) && hit.advisories.length) row.advisories = hit.advisories;
        }
      }
    } catch (err) {
      notes.push(`Ratings (${label}): ${err.message}`);
    }
  }

  for (const label of ['Apple Games', 'Apple All Apps']) {
    await refreshAppRatings(byLabel[label], notes);
  }
  await resolveAppleSongIds(byLabel['Christian Songs'], notes);

  await eachRow(byLabel['Steam'], 'Steam', notes, (g) => (g.id ? steamRating(g.id) : null));

  for (const label of ['TMDB Movies', 'TMDB TV', 'YouTube', 'Apple Music', 'Christian Songs', 'Steam', 'Apple Games', 'Apple All Apps']) {
    for (const row of byLabel[label] || []) {
      const name = row.title || row.name;
      if (hasCrudeTitle(name)) row.crudeTitle = true;
      // Charts show as published (2026-10-19). Political rows are only flagged
      // so the editor does not pick them for the lead or Heads Up.
      if (isPolitical(`${name} ${row.developer || ''} ${row.channel || ''}`)) {
        row.political = true;
        notes.push(`Politics rule: "${name}" (${label} #${row.rank}) is political. Shown as published; do not pick it for editorial copy.`);
      }
    }
  }

  return notes;
}
