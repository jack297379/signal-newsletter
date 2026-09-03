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
import { fetchTextMinimal } from './http.js';

const USER_AGENT = 'SignalNewsletterBot/1.0 (by WordOfLifeFellowship)';
const SUBS = ['teenagers', 'GenZ', 'TikTokCringe'];
const FETCH_DELAY_MS = 2000;
// Reddit's RSS rate limit is per-IP and trips fast: on 2026-09-03 the very
// first request of the day came back 403 "Blocked" and the next two 429,
// while a plain curl to the same URL succeeded ~60s later. The workspace
// notes already recorded "recovers within roughly a minute", so one retry
// pass after a backoff turns a transient trip into a normal successful run
// instead of a fallback week. Only the subreddits that failed are retried.
const RETRY_BACKOFF_MS = 65000;
const MAX_RETRY_PASSES = 1;

// Stickied/mod-announcement posts (e.g. "[mod] new rule", "looking for new
// moderators") sit permanently at the top of "hot" regardless of actual
// recent activity — confirmed 2026-07-27: two such posts were dated
// 2026-01-08 and 2020-12-20 while every genuinely current post was 1-2 days
// old. RSS has no "stickied" flag to check directly (the JSON API did), so
// post age is used as a structural proxy instead of guessing announcement
// phrasing — far more general than pattern-matching every possible way a
// mod team phrases a pinned post.
const MAX_POST_AGE_DAYS = 3;

// Age alone isn't enough: on 2026-09-03 a fresh "[mod] Tightening
// requirements for political submissions" post was 1 day old and sailed
// through. Explicit mod/meta tags are unambiguous, so drop those too.
const MOD_POST_PATTERNS = [
  /^\s*\[(mod|mods|meta|announcement|megathread|pinned)\]/i,
  /^\s*(mod|moderator|meta) (post|announcement|update)\b/i,
  /\bmegathread\b/i,
];

// Emoji-only or two-word titles ("🙄", "DAWG WHAT 😭") carry no trend
// information for the editor. Same idea as MIN_COMMENT_LENGTH in the
// YouTube fallback, scaled down because post titles run shorter ("microcheating"
// alone is 13 letters and is a real trend term, so the bar stays low).
const MIN_TITLE_LENGTH = 10;

function isModPost(title) {
  return MOD_POST_PATTERNS.some((re) => re.test(title));
}

function isTooShort(title) {
  // Count letters/digits only so emoji and punctuation don't inflate length.
  return title.replace(/[^\p{L}\p{N}]/gu, '').length < MIN_TITLE_LENGTH;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSubredditRss(sub) {
  // Deliberately NOT fetch(): Reddit blocks undici's default header set
  // (429 / 403 "Blocked") while accepting the identical request from curl or
  // Node's https module - see fetchTextMinimal in ./http.js for the evidence.
  const res = await fetchTextMinimal(`https://www.reddit.com/r/${sub}/.rss`, {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
  });
  if (!res.ok) {
    throw new Error(`Reddit r/${sub} RSS request failed: ${res.status} ${res.statusText}`);
  }
  const xml = res.body;
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
    .filter(({ title }) => !isModPost(title) && !isTooShort(title))
    .filter(({ title }) => !isBlocked(title))
    .slice(0, 5)
    .map(({ title }) => ({ subreddit: sub, title }));
}

export async function getRedditTrends() {
  const results = [];
  let pending = [...SUBS];
  let failures = [];

  for (let pass = 0; pass <= MAX_RETRY_PASSES && pending.length; pass++) {
    if (pass > 0) {
      console.warn(`Reddit: ${pending.length} subreddit(s) rate-limited/blocked - waiting ${RETRY_BACKOFF_MS / 1000}s and retrying once...`);
      await sleep(RETRY_BACKOFF_MS);
    }
    failures = [];
    const stillPending = [];
    for (let i = 0; i < pending.length; i++) {
      if (i > 0) await sleep(FETCH_DELAY_MS);
      try {
        results.push(...(await fetchSubredditRss(pending[i])));
      } catch (err) {
        // One subreddit hitting Reddit's rate limit shouldn't discard the
        // other two that succeeded - that's strictly worse than partial data.
        failures.push(`r/${pending[i]}: ${err.message}`);
        stillPending.push(pending[i]);
      }
    }
    pending = stillPending;
  }

  if (failures.length) {
    console.warn(`Reddit: ${failures.length}/${SUBS.length} subreddit(s) failed after retry:\n  ${failures.join('\n  ')}`);
  }
  return results;
}
