// run.js
// Main entry point. Pulls all sources in parallel, tolerates individual
// source failures without crashing the whole run, and writes a dated
// markdown draft to output/.

import { writeFileSync, mkdirSync } from 'fs';
import { getTrendingMovies, getTrendingTV } from './sources/tmdb.js';
import { getChristianTop10 } from './sources/billboard.js';
import { getSteamTopSellers } from './sources/steam.js';
import { getAppleTopFreeGames, getAppleTopFreeApps, getAppleTopSongs } from './sources/apple.js';
import { getYouTubeTrending } from './sources/youtube.js';
import { getRedditTrends } from './sources/reddit.js';
import { getYouTubeCommentTrends } from './sources/youtube-comments.js';
import { getPodcastCandidates } from './sources/podcasts.js';
import { buildTemplate } from './template/build.js';
import { runDataChecks } from './qa.js';
import { addContentFlags } from './sources/ratings.js';

// Wraps each source call so one failure doesn't take down the whole run.
// Failures are collected and surfaced in Agent Notes instead.
async function safeCall(label, fn) {
  try {
    const data = await fn();
    // A source can "succeed" (no thrown error) while returning zero results —
    // e.g. every selector silently matching nothing. Surface that as a failure
    // too, instead of letting it pass as a quiet OK with an empty section.
    if (Array.isArray(data) && data.length === 0) {
      return { label, data, error: `${label}: returned zero results — check selectors/source availability` };
    }
    return { label, data, error: null };
  } catch (err) {
    return { label, data: null, error: `${label}: ${err.message}` };
  }
}

async function run() {
  console.log('Signal — pulling this week\'s data sources...\n');

  const tasks = [
    safeCall('TMDB Movies', getTrendingMovies),
    safeCall('TMDB TV', getTrendingTV),
    safeCall('Apple Music', getAppleTopSongs),
    safeCall('Christian Songs', getChristianTop10),
    safeCall('Steam', getSteamTopSellers),
    safeCall('Apple Games', getAppleTopFreeGames),
    safeCall('Apple All Apps', getAppleTopFreeApps),
    safeCall('YouTube', getYouTubeTrending),
    safeCall('Reddit', getRedditTrends),
    safeCall('Podcasts', getPodcastCandidates),
  ];

  const results = await Promise.all(tasks);
  const byLabel = Object.fromEntries(results.map((r) => [r.label, r.data]));
  const errors = results.filter((r) => r.error).map((r) => r.error);

  results.forEach((r) => {
    console.log(r.error ? `✗ ${r.label} — FAILED: ${r.error}` : `✓ ${r.label} — OK`);
  });

  // Social Pulse fallback: if Reddit failed or came back empty, fall back to
  // mining comments on the YouTube trending videos we already pulled above —
  // reuses the same API key, adds no new credentials or failure points.
  // Normalize both sources into a common {label, text} shape so the template
  // doesn't need to know which one actually produced the candidates.
  const redditResult = results.find((r) => r.label === 'Reddit');
  let socialPulse = (byLabel['Reddit'] || []).map((p) => ({ label: `r/${p.subreddit}`, text: p.title }));
  let socialPulseSource = 'reddit';

  if (redditResult?.error) {
    console.log('\nReddit unavailable — trying YouTube comment fallback for Social Pulse...');
    const fallback = await safeCall('YouTube Comments (Reddit fallback)', () =>
      getYouTubeCommentTrends(byLabel['YouTube'])
    );
    console.log(fallback.error ? `✗ ${fallback.label} — FAILED: ${fallback.error}` : `✓ ${fallback.label} — OK`);
    if (fallback.data?.length) {
      socialPulse = fallback.data.map((c) => ({ label: `YouTube comment (on "${c.videoTitle}")`, text: c.text }));
      socialPulseSource = 'youtube-fallback';
    } else if (fallback.error) {
      errors.push(fallback.error);
    }
  }

  // Content flags (v2, 2026-10-09): publisher ratings added to chart rows in
  // place. Best-effort; lookup failures land in Agent Notes, never fail the run.
  console.log('\nLooking up content ratings...');
  const ratingNotes = await addContentFlags(byLabel);
  const sourceErrorCount = errors.length;
  ratingNotes.forEach((n) => errors.push(n));

  // Data QA pass — runs on whatever came back, even sources that reported OK.
  // Catches parsing artifacts and duplicate rows before the editor ever opens
  // the draft, instead of relying on someone spotting them by eye.
  const qaWarnings = runDataChecks(byLabel);
  if (qaWarnings.length) {
    console.log(`\n⚠️  ${qaWarnings.length} data quality warning(s):`);
    qaWarnings.forEach((w) => console.log(`  - ${w}`));
  } else {
    console.log('\nData QA: no anomalies detected.');
  }

  const week = new Date().toISOString().split('T')[0];

  const draft = buildTemplate({
    week,
    movies: byLabel['TMDB Movies'],
    tv: byLabel['TMDB TV'],
    appleMusic: byLabel['Apple Music'],
    christian: byLabel['Christian Songs'],
    steam: byLabel['Steam'],
    appleGames: byLabel['Apple Games'],
    appleApps: byLabel['Apple All Apps'],
    youtube: byLabel['YouTube'],
    socialPulse,
    socialPulseSource,
    podcasts: byLabel['Podcasts'],
    errors,
    qaWarnings,
  });

  mkdirSync('./output', { recursive: true });
  const outPath = `./output/${week}.md`;
  writeFileSync(outPath, draft);

  // Structured copy of the same pull, so build-branded.js can render the
  // branded HTML from real data without anyone retyping it (2026-09-03).
  const jsonPath = `./output/${week}.json`;
  writeFileSync(jsonPath, JSON.stringify({
    week,
    movies: byLabel['TMDB Movies'] || [],
    tv: byLabel['TMDB TV'] || [],
    youtube: byLabel['YouTube'] || [],
    appleMusic: byLabel['Apple Music'] || [],
    christian: byLabel['Christian Songs'] || [],
    steam: byLabel['Steam'] || [],
    appleGames: byLabel['Apple Games'] || [],
    appleApps: byLabel['Apple All Apps'] || [],
    podcasts: byLabel['Podcasts'] || [],
    socialPulse,
    socialPulseSource,
    errors,
    qaWarnings,
  }, null, 2));

  console.log(`\nDraft saved to ${outPath}`);
  console.log(`Structured data saved to ${jsonPath}`);
  if (sourceErrorCount) {
    console.log(`\n⚠️  ${sourceErrorCount} source(s) failed — check Agent Notes in the draft.`);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
