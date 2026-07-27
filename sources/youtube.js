// sources/youtube.js
// Uses the official YouTube Data API v3 with an API key — stateless, no
// browser session, no personalization. This is the actual fix for the
// "identical results every week" problem we saw with browser-based scraping,
// since that was silently reflecting a logged-in personalized feed (or a
// non-live fallback) rather than genuine live public trending data.

import 'dotenv/config';

const KEY = process.env.YOUTUBE_API_KEY;

export async function getYouTubeTrending() {
  if (!KEY) {
    throw new Error('YOUTUBE_API_KEY is missing. Add it to your .env file.');
  }
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=10&key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.items || []).map((v, i) => ({
    rank: i + 1,
    videoId: v.id,
    title: v.snippet?.title || 'unknown',
    channel: v.snippet?.channelTitle || 'unknown',
    views: v.statistics?.viewCount
      ? parseInt(v.statistics.viewCount, 10).toLocaleString()
      : 'n/a',
  }));
}
