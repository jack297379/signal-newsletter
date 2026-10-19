// scripts/refresh-app-ratings.js
// Re-reads App Store age ratings from the storefront for an already-pulled
// week and updates output/YYYY-MM-DD.json in place. Ranks, names and every
// other field are untouched. Added 2026-10-19 when Apple's lookup API was
// found to still return the retired 12+/17+ tiers.
//
// Usage: node scripts/refresh-app-ratings.js 2026-10-19
import { readFileSync, writeFileSync } from 'fs';
import { refreshAppRatings } from '../sources/ratings.js';

const week = process.argv[2];
if (!week) { console.error('Usage: node scripts/refresh-app-ratings.js YYYY-MM-DD'); process.exit(1); }
const path = `./output/${week}.json`;
const data = JSON.parse(readFileSync(path, 'utf8'));
const notes = [];
const before = new Map([...data.appleGames, ...data.appleApps].map((r) => [r.id, r.rating]));
await refreshAppRatings(data.appleGames, notes);
await refreshAppRatings(data.appleApps, notes);
for (const r of [...data.appleGames, ...data.appleApps]) {
  if (before.get(r.id) !== r.rating) console.log(`#${r.rank} ${r.name}: ${before.get(r.id) ?? 'none'} -> ${r.rating}`);
}
notes.forEach((n) => console.warn(n));
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log(`Updated ${path}`);
