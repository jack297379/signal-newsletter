// sources/podcasts.js
// Uses Apple's public "Top Podcasts" chart feed — same free, unauthenticated
// pattern as the Apple Music/Games/Apps sources. Replaces the earlier attempt
// to scrape Spotify's byspotify.com charts page: that page is a JS-rendered
// React app, so a plain fetch only returns the empty pre-render shell — cheerio
// could never find real chart rows there, which is why it always came back
// empty without ever throwing an error.

const YOUTH_KEYWORDS = [
  'teen', 'youth', 'parent', 'family', 'gen z', 'college', 'gaming',
  'comedy', 'pop culture', 'relationship', 'faith', 'christian', 'sports',
];

export async function getPodcastCandidates() {
  const url = 'https://rss.marketingtools.apple.com/api/v2/us/podcasts/top/20/podcasts.json';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Apple podcast charts feed failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const entries = data?.feed?.results || [];
  return entries.map((show, i) => {
    const genreNames = (show.genres || []).map((g) => g.name).join(' ');
    const description = `${show.name} ${show.artistName} ${genreNames}`.toLowerCase();
    const flagged = YOUTH_KEYWORDS.some((kw) => description.includes(kw));
    return { rank: i + 1, name: show.name, flagged };
  });
}
