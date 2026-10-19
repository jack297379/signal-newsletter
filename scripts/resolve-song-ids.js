// scripts/resolve-song-ids.js
// Adds Apple Music ids to an already-pulled week's Christian Songs rows
// (Billboard has none) and updates output/YYYY-MM-DD.json in place. Exact
// title + artist matches only; nothing else changes. Added 2026-10-19.
//
// Usage: node scripts/resolve-song-ids.js 2026-10-19
import { readFileSync, writeFileSync } from 'fs';
import { resolveAppleSongIds } from '../sources/ratings.js';

const week = process.argv[2];
if (!week) { console.error('Usage: node scripts/resolve-song-ids.js YYYY-MM-DD'); process.exit(1); }
const path = `./output/${week}.json`;
const data = JSON.parse(readFileSync(path, 'utf8'));
const notes = [];
await resolveAppleSongIds(data.christian, notes);
for (const r of data.christian) console.log(`#${r.rank} ${r.title} - ${r.artist}: ${r.id || 'no match'}${r.rating ? ` (${r.rating})` : ''}`);
notes.forEach((n) => console.warn(n));
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log(`Updated ${path}`);
