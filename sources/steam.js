// sources/steam.js
// Uses Steam's public featuredcategories JSON endpoint instead of scraping
// the topsellers HTML page. This is an undocumented but widely used and
// stable public endpoint — no auth required.

export async function getSteamTopSellers() {
  const res = await fetch('https://store.steampowered.com/api/featuredcategories?cc=us&l=en');
  if (!res.ok) {
    throw new Error(`Steam request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const items = data?.top_sellers?.items || [];
  // Steam's own endpoint returns duplicate entries (same id) for some items —
  // observed with Steam Machine and Steam Deck. Dedupe by id, preserving order.
  const seen = new Set();
  const deduped = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return deduped.slice(0, 10).map((item, i) => ({
    rank: i + 1,
    title: item.name,
  }));
}
