// sources/youtube-comments.js
// Fallback for Social/TikTok Pulse when Reddit is unavailable (down,
// rate-limited, or blocked). Pulls top comments from videos already
// confirmed trending by sources/youtube.js — reuses the same
// YOUTUBE_API_KEY that's been reliable all along, so this adds zero new
// credentials and zero new failure points. Not a like-for-like replacement
// for Reddit's threaded community discussion, but a genuine "what are real
// people saying" signal tied directly to content already in the newsletter.
//
// Same content-safety caveat as Reddit: the keyword filter is a first-pass
// net, not a substitute for editor judgment.

import 'dotenv/config';
import { isBlocked } from './content-safety.js';

const KEY = process.env.YOUTUBE_API_KEY;
const VIDEOS_TO_CHECK = 5;
const COMMENTS_PER_VIDEO = 3;
const MIN_COMMENT_LENGTH = 25; // skip low-effort one-word/emoji-only comments

// Structural quality problems, not editorial judgment calls — confirmed real
// 2026-07-27: a "spoiler warning" comment padded with 40+ blank lines, and a
// sponsor-read comment with a promo link, both slipped through the basic
// length + keyword filter on the first live run.
const SPAM_PATTERNS = [
  /https?:\/\//i,
  /\bmy sponsor\b/i,
  /\buse code\b/i,
  /\bdiscount code\b/i,
  /\bsponsored by\b/i,
  /\bcheck out my\b/i,
];

function isLowQuality(text) {
  if (SPAM_PATTERNS.some((re) => re.test(text))) return true;
  if (/\n{3,}/.test(text)) return true; // excessive blank-line padding
  return false;
}

/**
 * @param {Array<{videoId: string, title: string}>} trendingVideos - output
 *   of getYouTubeTrending(). Takes the top VIDEOS_TO_CHECK of these rather
 *   than re-fetching the trending list itself.
 */
export async function getYouTubeCommentTrends(trendingVideos) {
  if (!KEY) {
    throw new Error('YOUTUBE_API_KEY is missing. Add it to your .env file.');
  }
  const videos = (trendingVideos || []).slice(0, VIDEOS_TO_CHECK);
  const results = [];
  const failures = [];

  for (const video of videos) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${video.videoId}&maxResults=${COMMENTS_PER_VIDEO}&order=relevance&textFormat=plainText&key=${KEY}`;
      const res = await fetch(url);
      if (!res.ok) {
        // Comments disabled on a video is common and not a real failure —
        // just means no candidates from this one video.
        if (res.status === 403) continue;
        throw new Error(`${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const comments = (data.items || [])
        .map((item) => item.snippet?.topLevelComment?.snippet?.textOriginal?.trim())
        .filter((text) => text && text.length >= MIN_COMMENT_LENGTH && !isBlocked(text) && !isLowQuality(text));

      comments.forEach((text) => {
        results.push({ videoTitle: video.title, text });
      });
    } catch (err) {
      failures.push(`"${video.title}": ${err.message}`);
    }
  }

  if (failures.length) {
    console.warn(`YouTube comment fallback: ${failures.length} video(s) failed:\n  ${failures.join('\n  ')}`);
  }

  return results;
}
