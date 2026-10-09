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

  await eachRow(byLabel['Steam'], 'Steam', notes, (g) => (g.id ? steamRating(g.id) : null));

  for (const label of ['TMDB Movies', 'TMDB TV', 'YouTube', 'Apple Music', 'Christian Songs', 'Steam', 'Apple Games', 'Apple All Apps']) {
    for (const row of byLabel[label] || []) {
      const name = row.title || row.name;
      if (hasCrudeTitle(name)) row.crudeTitle = true;
      // Hard rule: absolutely no politics. Political chart rows are hidden in
      // the email (rank numbers stay as published) and listed for the editor.
      if (isPolitical(`${name} ${row.developer || ''} ${row.channel || ''}`)) {
        row.political = true;
        notes.push(`Politics rule: "${name}" (${label} #${row.rank}) is hidden in the email. Editor: confirm.`);
      }
    }
  }

  return notes;
}
