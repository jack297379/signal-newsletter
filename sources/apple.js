// sources/apple.js
// Apple's iTunes RSS feeds are native, structured JSON — no scraping needed.
// This has been the most reliable source in every pilot run so far.
// Fetches go through fetchJsonWithRetry so a one-off 5xx from Apple's CDN
// is retried instead of blanking the section (see sources/http.js).

import { fetchJsonWithRetry } from './http.js';

export async function getAppleTopFreeGames() {
  const url = 'https://itunes.apple.com/us/rss/topfreeapplications/limit=10/genre=6014/json';
  const data = await fetchJsonWithRetry(url, { label: 'Apple games feed' });
  const entries = data.feed.entry || [];
  return entries.map((app, i) => ({
    rank: i + 1,
    name: app['im:name']?.label || 'unknown',
    developer: app['im:artist']?.label || 'unknown',
  }));
}

export async function getAppleTopSongs() {
  const url = 'https://itunes.apple.com/us/rss/topsongs/limit=10/json';
  const data = await fetchJsonWithRetry(url, { label: 'Apple top songs feed' });
  const entries = data.feed.entry || [];
  return entries.map((track, i) => ({
    rank: i + 1,
    title: track['im:name']?.label || 'unknown',
    artist: track['im:artist']?.label || 'unknown',
  }));
}

export async function getAppleTopFreeApps() {
  const url = 'https://itunes.apple.com/us/rss/topfreeapplications/limit=20/json';
  const data = await fetchJsonWithRetry(url, { label: 'Apple all-apps feed' });
  const entries = data.feed.entry || [];
  return entries.map((app, i) => ({
    rank: i + 1,
    name: app['im:name']?.label || 'unknown',
    category: app.category?.attributes?.label || 'unknown',
    developer: app['im:artist']?.label || 'unknown',
  }));
}
