// sources/steam.js
// Primary: Steam's official weekly "Top Sellers" chart service - the same
// JSON endpoint the public chart page (store.steampowered.com/charts/topselling)
// is rendered from. Returns 20 ranked games with an item type, so DLC and
// bundles can be filtered structurally. No auth required.
//
// Fallback: the storefront `featuredcategories` top_sellers feed used since
// the first build. It works, but it is a storefront merchandising feed rather
// than a chart: it mixes in Valve hardware SKUs (Steam Deck, Steam Machine,
// Steam Controller), DLC / "Supporter Edition" rows, and literal duplicate
// ids, and only returns ~10 rows - so after filtering it can leave as few as
// 6 games (observed 2026-09-03). Both paths run through the same filter.
//
// Either way this is JSON from Steam itself, never the topsellers HTML page
// (the original design decision - HTML there changes shape without notice).

import { fetchJsonWithRetry } from './http.js';

const WEEKLY_CHART_INPUT = {
  context: { language: 'english', country_code: 'US', steam_realm: 1 },
  data_request: { include_basic_info: true },
  page_count: 20,
};
const WEEKLY_CHART_URL =
  'https://api.steampowered.com/IStoreTopSellersService/GetWeeklyTopSellers/v1/' +
  `?origin=https://store.steampowered.com&input_json=${encodeURIComponent(JSON.stringify(WEEKLY_CHART_INPUT))}`;
const STOREFRONT_URL = 'https://store.steampowered.com/api/featuredcategories?cc=us&l=en';

const WEEKLY_SOURCE = 'Steam weekly Top Sellers chart';
const STOREFRONT_SOURCE = 'Steam storefront top sellers (fallback)';

// Valve hardware products that show up in the storefront feed (and can
// appear in the weekly chart around launches). Matched on name because both
// endpoints report them with the same `type` as a game.
const HARDWARE_PATTERNS = [
  /^steam\s+(deck|machine|controller|frame|link)\b/i,
  /^valve\s+index\b/i,
  /\bdocking station\b/i,
];

// Steam item `type`: 0 = game/app, 1 = DLC (editions, supporter packs,
// soundtracks), 2 = package/bundle. Only 0 belongs in a games list.
const GAME_TYPE = 0;

export function isHardware(name) {
  return HARDWARE_PATTERNS.some((re) => re.test((name || '').trim()));
}

// items: [{ id, type, name }]
export function filterSteamItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.name) return false;
    if (seen.has(item.id)) return false; // storefront feed returns duplicate ids
    seen.add(item.id);
    if (item.type !== undefined && item.type !== GAME_TYPE) return false; // DLC/editions/bundles
    if (isHardware(item.name)) return false;
    return true;
  });
}

function toRanked(items, source) {
  return filterSteamItems(items)
    .slice(0, 10)
    .map((item, i) => ({ rank: i + 1, title: item.name, source }));
}

async function tryWeeklyChart() {
  const data = await fetchJsonWithRetry(WEEKLY_CHART_URL, { label: 'Steam weekly chart request' });
  const ranks = data?.response?.ranks || [];
  const items = ranks.map((r) => ({ id: r.item?.appid, type: r.item?.type, name: r.item?.name }));
  return toRanked(items, WEEKLY_SOURCE);
}

async function fallbackStorefront() {
  const data = await fetchJsonWithRetry(STOREFRONT_URL, { label: 'Steam storefront request' });
  return toRanked(data?.top_sellers?.items || [], STOREFRONT_SOURCE);
}

export async function getSteamTopSellers() {
  try {
    const primary = await tryWeeklyChart();
    if (primary.length >= 5) return primary;
    console.warn(`Steam: weekly chart returned only ${primary.length} usable rows - falling back to storefront feed`);
  } catch (err) {
    console.warn(`Steam: weekly chart failed (${err.message}) - falling back to storefront feed`);
  }
  return fallbackStorefront();
}
