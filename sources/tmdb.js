// sources/tmdb.js
// Uses TMDB's real trending API — NOT the public website's "Popular" pages.
// This is the actual fix for the Popular-vs-Trending problem we hit with Gemini.
// Free API key: themoviedb.org → Settings → API

import 'dotenv/config';

const BASE = 'https://api.themoviedb.org/3';
const KEY = process.env.TMDB_API_KEY;

function assertKey() {
  if (!KEY) {
    throw new Error('TMDB_API_KEY is missing. Add it to your .env file.');
  }
}

export async function getTrendingMovies() {
  assertKey();
  const res = await fetch(`${BASE}/trending/movie/week?api_key=${KEY}`);
  if (!res.ok) {
    throw new Error(`TMDB movies request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.results.slice(0, 10).map((m, i) => ({
    rank: i + 1,
    id: m.id,
    title: m.title,
    releaseYear: (m.release_date || '').slice(0, 4) || 'unknown',
    score: m.vote_average ? m.vote_average.toFixed(1) : 'n/a',
  }));
}

export async function getTrendingTV() {
  assertKey();
  const res = await fetch(`${BASE}/trending/tv/week?api_key=${KEY}`);
  if (!res.ok) {
    throw new Error(`TMDB TV request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.results.slice(0, 10).map((s, i) => ({
    rank: i + 1,
    id: s.id,
    title: s.name,
    firstAirYear: (s.first_air_date || '').slice(0, 4) || 'unknown',
    score: s.vote_average ? s.vote_average.toFixed(1) : 'n/a',
  }));
}
