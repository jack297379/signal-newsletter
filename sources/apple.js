// sources/apple.js
// Apple's iTunes RSS feeds are native, structured JSON — no scraping needed.
// This has been the most reliable source in every pilot run so far.

export async function getAppleTopFreeGames() {
  const url = 'https://itunes.apple.com/us/rss/topfreeapplications/limit=10/genre=6014/json';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Apple games feed failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const entries = data.feed.entry || [];
  return entries.map((app, i) => ({
    rank: i + 1,
    name: app['im:name']?.label || 'unknown',
    developer: app['im:artist']?.label || 'unknown',
  }));
}

export async function getAppleTopSongs() {
  const url = 'https://itunes.apple.com/us/rss/topsongs/limit=10/json';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Apple top songs feed failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const entries = data.feed.entry || [];
  return entries.map((track, i) => ({
    rank: i + 1,
    title: track['im:name']?.label || 'unknown',
    artist: track['im:artist']?.label || 'unknown',
  }));
}

export async function getAppleTopFreeApps() {
  const url = 'https://itunes.apple.com/us/rss/topfreeapplications/limit=20/json';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Apple all-apps feed failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const entries = data.feed.entry || [];
  return entries.map((app, i) => ({
    rank: i + 1,
    name: app['im:name']?.label || 'unknown',
    category: app.category?.attributes?.label || 'unknown',
    developer: app['im:artist']?.label || 'unknown',
  }));
}
