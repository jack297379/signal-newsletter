// sources/reddit.js
// Reddit blocks unauthenticated requests to its public .json endpoints, and
// getting OAuth Client Credentials requires an app-creation step that Reddit
// silently blocks for zero-karma accounts (see workspace notes) — a blocker
// outside our control. Reddit's legacy Atom RSS feeds (/r/<sub>/.rss) are
// NOT blocked the same way: they're public, need no auth, no app, no karma
// requirement. They do rate-limit aggressively on rapid repeated requests
// (429), but recover within roughly a minute and are entirely fine for the
// once-a-week cadence this script actually needs — hence the deliberate
// delay between subreddit fetches below, and sequential (not parallel)
// requests.
//
// Tradeoff vs the old JSON/OAuth approach: this feed has no explicit NSFW
// flag or upvote count, and no "stickied" flag either — Reddit's JSON API
// exposed both directly. The keyword safety screen below is a first-pass
// net, not a substitute for the editor's judgment — the editor reviews
// every pick before publishing regardless, and always will, because no
// keyword list can reliably catch every category of "not okay for this
// newsletter" (a disturbing personal anecdote reads nothing like a banned
// word — see the family/intimate-contact pattern below for a narrow,
// best-effort attempt at that specific case, confirmed real 2026-07-27).

import * as cheerio from 'cheerio';
import { isBlocked } from './content-safety.js';

const USER_AGENT = 'SignalNewsletterBot/1.0 (by WordOfLifeFellowship)';
const SUBS = ['teenagers', 'GenZ', 'TikTokCringe'];
const FETCH_DELAY_MS = 2000;

// Stickied/mod-announcement posts (e.g. "[mod] new rule", "looking for new
// moderators") sit permanently at the top of "hot" regardless of actual
// recent activity — confirmed 2026-07-27: two such posts were dated
// 2026-01-08 and 2020-12-20 while every genuinely current post was 1-2 days
// old. RSS has no "stickied" flag to check directly (the JSON API did), so
// post age is used as a structural proxy instead of guessing announcement
// phrasing — far more general than pattern-matching every possible way a
// mod team phrases a pinned post.
const MAX_POST_AGE_DAYS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSubredditRss(sub) {
  const res = await fetch(`https://www.reddit.com/r/${sub}/.rss`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Reddit r/${sub} RSS request failed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const cutoff = Date.now() - MAX_POST_AGE_DAYS * 24 * 60 * 60 * 1000;

  return $('entry')
    .map((_, el) => {
      const title = $(el).find('title').first().text().trim();
      const published = $(el).find('published').first().text().trim();
      return { title, publishedAt: published ? new Date(published).getTime() : 0 };
    })
    .get()
    .filter(({ title, publishedAt }) => title && publishedAt >= cutoff)
    .filter(({ title }) => !isBlocked(title))
    .slice(0, 5)
    .map(({ title }) => ({ subreddit: sub, title }));
}

export async function getRedditTrends() {
  const results = [];
  const failures = [];
  for (let i = 0; i < SUBS.length; i++) {
    if (i > 0) await sleep(FETCH_DELAY_MS);
    try {
      results.push(...(await fetchSubredditRss(SUBS[i])));
    } catch (err) {
      // One subreddit hitting Reddit's rate limit shouldn't discard the
      // other two that succeeded — that's strictly worse than partial data.
      failures.push(`r/${SUBS[i]}: ${err.message}`);
    }
  }
  if (failures.length) {
    console.warn(`Reddit: ${failures.length}/${SUBS.length} subreddit(s) failed:\n  ${failures.join('\n  ')}`);
  }
  return results;
}
