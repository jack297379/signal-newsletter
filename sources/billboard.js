// sources/billboard.js
// Billboard's Christian Songs chart is frequently paywalled behind "Billboard Pro."
// Primary attempt scrapes Billboard directly; if that fails, falls back to
// PopVortex's iTunes Christian & Gospel chart, which is a legitimate, free,
// static-HTML source (confirmed working during the Gemini pilot).

import * as cheerio from 'cheerio';

async function tryBillboard() {
  const res = await fetch('https://www.billboard.com/charts/christian-songs/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalNewsletterBot/1.0)' },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows = $('.o-chart-results-list-row');
  if (rows.length === 0) return null; // likely paywalled or structure changed

  const results = [];
  rows.slice(0, 10).each((i, el) => {
    const title = $(el).find('.c-title').first().text().trim();
    // Rows carry multiple .c-label spans: the rank-number badge, and (for
    // songs marked "NEW" or "RE-ENTRY") one or two chart-movement badges —
    // all before the real artist label. Position-based indexing breaks
    // whenever a movement badge is present. The artist span is the only
    // .c-label with the "a-no-trucate" class, so match on that instead.
    const artist = $(el).find('.c-label.a-no-trucate').first().text().trim();
    if (title) results.push({ rank: i + 1, title, artist, source: 'Billboard' });
  });
  return results.length ? results : null;
}

async function fallbackPopVortex() {
  const res = await fetch('https://www.popvortex.com/music/charts/top-christian-gospel-songs.php', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalNewsletterBot/1.0)' },
  });
  if (!res.ok) {
    throw new Error(`PopVortex fallback failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];
  $('.chart-item').slice(0, 10).each((i, el) => {
    const title = $(el).find('.title').first().text().trim();
    const artist = $(el).find('.artist').first().text().trim();
    if (title) results.push({ rank: i + 1, title, artist, source: 'PopVortex (iTunes Christian & Gospel)' });
  });
  return results;
}

export async function getChristianTop10() {
  const primary = await tryBillboard();
  if (primary) return primary;
  return fallbackPopVortex();
}
