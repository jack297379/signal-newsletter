// template/build-html.js
// Renders the branded, distribution-ready Signal HTML. Visual system revised
// 2026-10-19 against the WOL Design System (design_handoff_the_signal_email/):
// numbered section badges, sans subheads, a "The Charts" group legend,
// light-blue cards, dark-blue "Worth Naming Out Loud" callout),
// rebuilt as a real template instead of a one-off generation.
//
// Why this exists instead of re-prompting Claude Design each week: a
// generative design pass can silently drop, reorder, or invent chart items
// (confirmed on 2026-07-22 — it fabricated app/game names that were never
// in the real pull, and re-sorted TV/YouTube rankings by score instead of
// preserving the source chart order). A template that loops over the same
// data already flowing through this pipeline's QA pass structurally cannot
// do that — it can only render what's actually there.
//
// Editorial content (the Talk About It feature, Heads Up notes, the ministry
// angle sentence, an optional Trend Watch write-up; v2 format 2026-10-09) still has to be authored by a human/AI each week —
// that judgment call isn't something to automate away. This module just
// takes that finished copy as input alongside the raw data.

import { readFileSync } from 'fs';
import { SHOW_CYA_ATTRIBUTION, CYA_ATTRIBUTION_TEXT } from './attribution.js';

const WOL_LOGO_PATH =
  "/Users/JohnYaroshwol.org/Library/CloudStorage/OneDrive-WordofLifeFellowshipInc/WOL NY Marketing Team - WOL_SecondBrain/resources/assets/logos/wol-fellowship/WOL logo_horizontal_white_(R).png";

// Hero waveform watermark (Claude Design direction 2b, 2026-11-02): 1200x800
// retina PNG with solid #004f68 baked in, shown at 600x400.
const HERO_WAVE_PATH = new URL('./assets/signal-bg-wave.png', import.meta.url);

const COLORS = {
  darkBlue: '#004f68',
  darkerBlue: '#003d51',   // tint of darkBlue: attribution strip (hero 2026-11-02)
  hairlineOnDark: '#2f7189', // tint of darkBlue: rule inside the hero band
  lightBlue: '#73d1f5',
  ink: '#414042',
  inkSecondary: '#6d6e71', // was #939598 (2.9:1 on white, fails AA); design review 2026-10-19
  hairline: '#e6e7e8',
  pageBg: '#e6e7e8',
  pickCardBg: '#eaf7fc',
};

function formatWeek(week) {
  const d = new Date(`${week}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// The masthead shows the send date, not the pull date (John Yarosh,
// 2026-11-02): `week` is the Monday the data is pulled, and the issue goes
// out the next day, Tuesday 8:00 AM.
function formatSendDate(week) {
  const d = new Date(`${week}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Converts every non-ASCII character (curly quotes, en/em dashes, accented
// names, etc.) into a numeric HTML character reference. Applied once to the
// fully assembled output, not at individual call sites — this makes the
// final file pure ASCII, which is immune to charset misinterpretation at
// any downstream hop (clipboard copy, pasting into Pardot's editor, a
// re-save through some other tool). Named characters still render exactly
// the same once any browser/email client parses the HTML; only the raw
// bytes on disk change.
function toAsciiHtml(str) {
  return str.replace(/[^\x00-\x7F]/gu, (ch) => `&#${ch.codePointAt(0)};`);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Brand condensed display cut (masthead, CTA); falls back to Helvetica Neue.
const CONDENSED = `font-family:'Helvetica Neue LT Std Cn', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-stretch:condensed;`;

// Data normalization for display (design review 2026-10-19): add a missing
// space before "(" ("Tarugana(ft." -> "Tarugana (ft.") and collapse repeated
// whitespace ("Johnny slime  "). Matching for editor picks still uses raw text.
function cleanText(str) {
  return String(str ?? '').replace(/(\S)\(/g, '$1 (').replace(/\s+/g, ' ').trim();
}

// Smart-quote pass for editor copy: the brand never uses straight quotes.
function smartQuotes(str) {
  return String(str ?? '')
    .replace(/(^|[\s(\[{])"/g, '$1\u201C')
    .replace(/"/g, '\u201D')
    .replace(/(^|[\s(\[{])'/g, '$1\u2018')
    .replace(/'/g, '\u2019');
}
function copy(str) {
  return escapeHtml(smartQuotes(str));
}

function sectionBadge(number, label) {
  return `
    <tr>
      <td style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:${COLORS.darkBlue}; padding:12px 32px;">
              <span style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:13px; letter-spacing:2px; color:${COLORS.lightBlue};">${number}</span>
              <span style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:13px; letter-spacing:2px; color:#ffffff; text-transform:uppercase;">&nbsp;&nbsp;${escapeHtml(label)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function subhead(text) {
  return `
    <tr>
      <td style="padding:16px 32px 4px 32px;">
        <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:18px; color:${COLORS.darkBlue};">${escapeHtml(text)}</div>
      </td>
    </tr>`;
}

// Listen links (added 2026-10-14 from pilot feedback): readers wanted a quick
// way to check a song or podcast for explicit content. Apple Music tracks have
// an id, so they link straight to the song; Billboard rows and older podcast
// rows have none, so they fall back to an Apple search for title + artist.
function appleMusicUrl(song) {
  if (song.id) return `https://music.apple.com/us/song/${encodeURIComponent(song.id)}`;
  return `https://music.apple.com/us/search?term=${encodeURIComponent(`${song.title} ${song.artist || ''}`.trim())}`;
}
function applePodcastUrl(show) {
  if (show.url) return show.url;
  if (show.id) return `https://podcasts.apple.com/us/podcast/id${encodeURIComponent(show.id)}`;
  return `https://podcasts.apple.com/us/search?term=${encodeURIComponent(show.name)}`;
}
// Store links for games and apps (added 2026-10-19 so every chart section links).
function appStoreUrl(app) {
  return app.id ? `https://apps.apple.com/us/app/id${encodeURIComponent(app.id)}` : null;
}
function steamUrl(game) {
  return game.id ? `https://store.steampowered.com/app/${encodeURIComponent(game.id)}/` : null;
}
// TMDB title pages for movie and TV rows (added 2026-10-19 for issue 3): a
// linked title reads as a show, not a button ("Link Click" feedback).
function tmdbUrl(item, kind) {
  return item.id ? `https://www.themoviedb.org/${kind}/${encodeURIComponent(item.id)}` : null;
}
function maybeLink(href, text) {
  return href ? listenLink(href, text) : text;
}
// Spotify (added 2026-10-19, John Yarosh: most of the office uses Spotify).
// No Spotify API key yet, so this opens a Spotify search for title + artist,
// which lands in the Spotify app on a phone. Swap for direct track/show
// links once a Spotify developer app exists.
function spotifySearchUrl(query) {
  return `https://open.spotify.com/search/${encodeURIComponent(String(query).trim())}`;
}
// Second line under a song or podcast: "Apple Music · Spotify".
function listenLine(appleHref, appleLabel, spotifyQuery) {
  const small = (href, text) => `<a href="${escapeHtml(href)}" style="color:${COLORS.darkBlue}; text-decoration:underline;">${text}</a>`;
  return `<span style="font-size:12px; color:${COLORS.inkSecondary};">${small(appleHref, appleLabel)} &middot; ${small(spotifySearchUrl(spotifyQuery), 'Spotify')}</span>`;
}
function listenLink(href, text) {
  return `<a href="${escapeHtml(href)}" style="color:${COLORS.darkBlue}; text-decoration:underline;">${text}</a>`;
}

// Display-only title tidy (added 2026-10-14): TMDB lists some shows in all
// caps (e.g. "LINK CLICK"), which a pilot reader took for a broken link.
// Multi-word all-caps titles whose words are all 4+ letters become title case;
// single words and anything with a short word or acronym (FBI, WWE RAW) stay. Matching
// for editor picks still uses the raw chart title.
function tidyTitle(title) {
  const t = String(title || '');
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || t !== t.toUpperCase() || !/[A-Z]/.test(t)) return t;
  if (!words.every((w) => w.replace(/[^A-Z]/g, '').length >= 4)) return t;
  return words.map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

// Renders a scored list (movies/TV): rank + title, score right-aligned, under
// a column header. Release year dropped 2026-10-19 (redundant in a "trending
// this week" list). Score is TMDB's user vote average (sources/tmdb.js).
const SCORE_HEADER = `<tr><td style="padding:0 0 6px 0; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:${COLORS.inkSecondary};">Title</td><td style="padding:0 0 6px 0; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:${COLORS.inkSecondary}; text-align:right;">TMDB Score / 10</td></tr>`;
function scoredList(items, kind) {
  if (!items || items.length === 0) {
    return `<tr><td style="padding:8px 0; color:${COLORS.inkSecondary}; font-style:italic;">Source unavailable this week.</td></tr>`;
  }
  return SCORE_HEADER + '\n' + items
    .map((item) => {
      const score = item.score === 'n/a'
        ? `<span style="color:${COLORS.inkSecondary};">n/a</span>`
        : `<span style="color:${COLORS.darkBlue};">${escapeHtml(item.score)}</span>`;
      return `<tr><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline};"><strong>${item.rank}.</strong> ${maybeLink(tmdbUrl(item, kind), escapeHtml(cleanText(tidyTitle(item.title))))}${ratingChip(item, { rated: true })}</td><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline}; text-align:right; font-weight:bold;">${score}</td></tr>`;
    })
    .join('\n');
}

// Renders a plain list: "N. Title – meta", plus an optional second line.
function plainList(items, formatter, secondLine = null, { rated = false } = {}) {
  if (!items || items.length === 0) {
    return `<tr><td style="padding:8px 0; color:${COLORS.inkSecondary}; font-style:italic;">Source unavailable this week.</td></tr>`;
  }
  return items
    .map((item) => `<tr><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline};">${item.rank}. ${formatter(item)}${ratingChip(item, { rated })}${secondLine ? `<br>${secondLine(item)}` : ''}</td></tr>`)
    .join('\n');
}

// Renders the two-line YouTube-style list: bold title, secondary meta line.
function twoLineList(items, formatter) {
  if (!items || items.length === 0) {
    return `<tr><td style="padding:5px 0; color:${COLORS.inkSecondary}; font-style:italic;">Source unavailable this week.</td></tr>`;
  }
  return items
    .map((item, i) => {
      const { title, meta } = formatter(item);
      const isLast = i === items.length - 1;
      return `<tr><td style="padding:5px 0${isLast ? ' 0 0' : ''}; border-top:1px solid ${COLORS.hairline};"><strong>${item.rank}. ${escapeHtml(cleanText(title))}</strong>${ratingChip(item)}<br><span style="color:${COLORS.inkSecondary};">${escapeHtml(meta)}</span></td></tr>`;
    })
    .join('\n');
}


// v2 format (2026-10-09, John Yarosh): one shared email for youth leaders
// AND parents. Charts stay, cut to CHART_DEPTH rows, each row carrying the
// publisher's own content rating (sources/ratings.js) and shown as is with a
// flag. The lead is a "Talk About It" feature built on one real chart item,
// with questions for home and for youth group. Word of Life owns the voice;
// no individual byline.
const CHART_DEPTH = 5;

// Ratings that get the dark-blue mature chip instead of the neutral one
// (was amber #fde7c8/#8a4b00, off-palette; design review 2026-10-19).
// 16+ and 18+ are Apple's current top tiers (17+ kept for older pulls).
const MATURE_RATINGS = new Set(['R', 'NC-17', 'TV-MA', 'Explicit', '16+', '17+', '18+', 'ESRB M', 'ESRB AO']);

// `rated` marks chart types that normally carry a rating (movies, TV, games,
// apps). A row there with no rating gets an outlined "Not rated" chip so the
// gap reads as intentional, not a glitch (John Yarosh, 2026-10-19: "Link
// Click" had no US rating and looked like an error). Songs are only tagged
// when Apple marks them Explicit, so they never get this chip.
const NOT_RATED_CHIP = `<span style="display:inline-block; margin-left:6px; padding:0 5px; border-radius:3px; font-family:Arial, sans-serif; font-size:10px; font-weight:bold; letter-spacing:0.5px; vertical-align:1px; background:#ffffff; color:${COLORS.inkSecondary}; border:1px solid ${COLORS.hairline};">Not rated</span>`;

function ratingChip(item, { rated = false } = {}) {
  const chips = [];
  if (!item.rating && rated) chips.push(NOT_RATED_CHIP);
  if (item.rating) {
    const mature = MATURE_RATINGS.has(item.rating);
    chips.push(`<span style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:3px; font-family:Arial, sans-serif; font-size:10px; font-weight:bold; letter-spacing:0.5px; vertical-align:1px; ${mature ? `background:${COLORS.darkBlue}; color:#ffffff;` : `background:${COLORS.hairline}; color:${COLORS.ink};`}">${escapeHtml(item.rating)}</span>`);
  }
  if (item.crudeTitle) {
    chips.push(`<span style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:3px; font-family:Arial, sans-serif; font-size:10px; font-weight:bold; letter-spacing:0.5px; vertical-align:1px; background:${COLORS.darkBlue}; color:#ffffff;">Crude title</span>`);
  }
  return chips.join('');
}

// Charts show exactly as published, political titles included (John Yarosh,
// 2026-10-19). The no-politics rule covers editorial picks (lead, Heads Up,
// podcast picks, Trend Watch/Reddit), not chart data. `political` is still
// set by sources/ratings.js as a note for the editor.
function top(items) {
  return (items || []).slice(0, CHART_DEPTH);
}

const songLine = (s) => `${escapeHtml(cleanText(s.title))} – ${escapeHtml(cleanText(s.artist))}`;
const songListen = (s) => listenLine(appleMusicUrl(s), 'Apple Music', `${cleanText(s.title)} ${cleanText(s.artist)}`);

function chartBlock(label, rowsHtml, { last = false } = {}) {
  return `
  ${subhead(label)}
  <tr><td style="padding:4px 32px ${last ? 24 : 12}px 32px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${rowsHtml}
    </table>
  </td></tr>`;
}

function questionList(label, questions) {
  if (!questions || !questions.length) return '';
  return `
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.darkBlue}; text-transform:uppercase; margin:16px 0 6px 0;">${escapeHtml(label)}</div>
          ${questions.map((q) => `<div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6; margin:0 0 6px 0; padding-left:14px; text-indent:-14px;">&bull;&nbsp; ${copy(q)}</div>`).join('\n          ')}`;
}

// The three chart sections share one un-numbered group header and legend
// (design review 2026-10-19), placed before the first chart section bar.
const CHART_SECTIONS = ['03', '04', '05'];

function legendChip(label, style) {
  return `<span style="display:inline-block; padding:1px 6px; border-radius:3px; font-family:Arial, sans-serif; font-size:10px; font-weight:bold; letter-spacing:0.5px; ${style}">${label}</span>`;
}

function chartsGroupHeader(first, last) {
  const range = `${first}&ndash;${last}`;
  return `
    <tr>
      <td style="background:${COLORS.lightBlue}; padding:10px 32px;">
        <span style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:13px; letter-spacing:2px; color:${COLORS.darkBlue}; text-transform:uppercase;">The Charts</span>
        <span style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:13px; letter-spacing:2px; color:${COLORS.darkBlue};">&nbsp;&nbsp;${range}</span>
      </td>
    </tr>
    <tr><td style="padding:0; background:${COLORS.pickCardBg};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:16px 32px 18px 32px;">
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.darkBlue}; text-transform:uppercase; margin-bottom:6px;">How to Read the Charts</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6; margin-bottom:12px;">Sections ${range} show what is actually popular this week, as is. Tags are the publisher's own ratings: movie and TV ratings, Apple's explicit and age ratings, and ESRB.</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 6px 6px 0; vertical-align:middle;">${legendChip('PG-13', `background:#ffffff; color:${COLORS.ink}; border:1px solid #c9e9f6;`)}</td>
              <td style="padding:0 20px 6px 0; vertical-align:middle; font-family:Arial, sans-serif; font-size:13px; color:${COLORS.ink};">General to teen</td>
              <td style="padding:0 6px 6px 0; vertical-align:middle;">${legendChip('R', `background:${COLORS.darkBlue}; color:#ffffff;`)}</td>
              <td style="padding:0 0 6px 0; vertical-align:middle; font-family:Arial, sans-serif; font-size:13px; color:${COLORS.ink};">Mature (R, TV-MA, M, 16+)</td>
            </tr>
          </table>
          <div style="font-family:Arial, sans-serif; font-size:13px; color:${COLORS.ink}; line-height:1.5; margin-top:4px;">${NOT_RATED_CHIP.replace('margin-left:6px; ', '')} means no rating was available, not that a title is clean. Songs are tagged only when Apple marks them Explicit.</div>
        </td></tr>
      </table>
    </td></tr>`;
}

// Every chart row and Social Pulse candidate, for the "based on a real
// item" guardrails below.
function realItemIndex(data) {
  const rows = [];
  const add = (list, key, where) => (list || []).forEach((r) => rows.push({ name: String(r[key] || ''), row: r, where }));
  add(data.movies, 'title', 'TMDB Movies');
  add(data.tv, 'title', 'TMDB TV');
  add(data.youtube, 'title', 'YouTube Trending');
  add(data.appleMusic, 'title', 'Apple Music');
  add(data.christian, 'title', 'Christian Songs');
  add(data.steam, 'title', 'Steam');
  add(data.appleGames, 'name', 'App Store Games');
  add(data.appleApps, 'name', 'App Store Apps');
  add(data.podcasts, 'name', 'Podcasts');
  add(data.socialPulse, 'text', 'Social Pulse');
  return rows;
}

function findReal(index, name) {
  const n = String(name || '').trim().toLowerCase();
  return index.find((r) => r.name.trim().toLowerCase() === n);
}

/**
 * @param {object} data - raw pulled fields (week, movies, tv, youtube,
 *   appleMusic, christian, steam, appleGames, appleApps, podcasts,
 *   socialPulse) plus the editor's copy:
 * @param {object|null} data.talkAboutIt - { basedOn, headline, whatItIs,
 *   whyItMatters, atHome: [..], inYouthGroup: [..], scripture: { reference,
 *   text? } }. `basedOn` MUST exactly match (case-insensitive) a chart row or
 *   Social Pulse candidate from this week's pull - throws if not.
 * @param {Array<{basedOn: string, note: string}>} data.headsUp - 0 to 2 items
 *   for parents. Each `basedOn` must match a real chart row (throws if not);
 *   the rating chip comes from the data, never from the editor.
 * @param {{title: string, blurb: string, source?: string}|null} data.socialPick
 * @param {string} data.ministryAngle - the closing one-sentence tie-in.
 * @param {string|null} data.surveyUrl - pilot feedback survey link.
 * @param {string|null} data.logoUrl - hosted logo URL; REQUIRED for a real
 *   send (Outlook blocks base64 images). Omitted = base64 preview only.
 * @param {string|null} data.heroBgUrl - hosted waveform URL for the hero
 *   band; same rule as logoUrl. Clients that drop it show solid darkBlue.
 * @param {number|null} data.issue - issue number for the masthead; omitted =
 *   the masthead shows the date alone.
 * @param {string|null} data.teaser - "This Week" hook in the hero, a short
 *   condensed take on the Talk About It headline so it does not repeat word
 *   for word. Falls back to talkAboutIt.headline.
 */
// Footer merge tags use Pardot's Handlebars Merge Language ({{Unsubscribe}},
// {{View_Online}}). Verified 2026-09-08 in WOL's own account: the classic
// editor's default email body there uses {{Recipient.FirstName}} and
// {{Unsubscribe}}, i.e. HML is enabled account-wide, so the legacy
// %%unsubscribe%% syntax is NOT what this account expects.
// {{EmailPreferenceCenter}} opens the Default Email Preferences Page, where the
// public "The Signal" list (Pardot list 212761) can be unticked on its own;
// {{Unsubscribe}} is a global opt-out from all WOL email (2026-10-09, Tim Hunt).
// "Why We Share This" statement on every issue, Scott Foreman's wording from
// his issue 2 survey response (2026-10-22), added from issue 3 (2026-10-27).
const WHY_WE_SHARE_THIS = 'The Signal is intended to help parents, youth leaders, and ministry workers understand the media and cultural influences shaping today&rsquo;s teenagers. References to specific apps, games, movies, television programs, music, podcasts, websites, creators, or other content are provided for informational and awareness purposes only. Their inclusion does not constitute an endorsement, recommendation, or approval by Word of Life Fellowship. Readers are encouraged to exercise biblical discernment and make informed decisions consistent with their personal convictions and family values.';

export function buildBrandedHtml(data) {
  const {
    week, movies, tv, youtube, appleMusic, christian,
    steam, appleGames, appleApps, podcasts,
    talkAboutIt = null, headsUp = [], podcastPicks = [], ministryAngle, socialPick = null,
    surveyUrl = null, logoUrl = null, preheader = null, headsUpIntro = null, pilotNote = null,
    heroBgUrl = null, issue = null, teaser = null,
  } = data;

  // Structural guardrails: the feature and the heads-up items must point at
  // something actually in this week's pull, so nothing can be invented.
  const index = realItemIndex(data);
  if (talkAboutIt && !talkAboutIt.placeholder && !findReal(index, talkAboutIt.basedOn)) {
    throw new Error(`buildBrandedHtml: Talk About It is based on "${talkAboutIt.basedOn}", which is not in this week's charts or Social Pulse. Refusing to render.`);
  }
  const headsUpRows = (headsUp || []).map((h) => {
    if (h.placeholder) return { ...h, row: {} };
    const hit = findReal(index, h.basedOn);
    if (!hit || hit.where === 'Social Pulse') {
      throw new Error(`buildBrandedHtml: Heads Up item "${h.basedOn}" is not a row in this week's charts. Refusing to render.`);
    }
    return { ...h, row: hit.row, where: hit.where };
  });

  // Podcasts stay editor-picked (names only in v2): the raw top 5 is news and
  // political talk most weeks, which the no-politics rule rules out. Each pick
  // MUST match a real chart entry - throws if not, as before.
  const podcastByName = new Map((podcasts || []).map((p) => [p.name.toLowerCase(), p]));
  const podcastRows = (podcastPicks || []).map((pick) => {
    const name = typeof pick === 'string' ? pick : pick.name;
    const row = podcastByName.get(String(name).toLowerCase());
    if (!row) {
      throw new Error(`buildBrandedHtml: podcast pick "${name}" does not match any entry in this week's real podcast chart. Refusing to render a fabricated pick.`);
    }
    return row;
  }).sort((a, b) => a.rank - b.rank); // list in chart order, not pick order

  let logoSrc = logoUrl;
  if (!logoSrc) {
    console.warn(
      'buildBrandedHtml: no logoUrl provided — embedding the logo as a base64 data URI for preview purposes only. ' +
      'This will NOT display in most email clients (Outlook desktop blocks data-URI images). ' +
      'Upload the logo to Pardot\'s image library and pass the resulting URL as logoUrl before sending.'
    );
    logoSrc = `data:image/png;base64,${readFileSync(WOL_LOGO_PATH).toString('base64')}`;
  }

  let heroBgSrc = heroBgUrl;
  if (!heroBgSrc) {
    console.warn(
      'buildBrandedHtml: no heroBgUrl provided, embedding the hero waveform as a base64 data URI for preview purposes only. ' +
      'Upload template/assets/signal-bg-wave.png to Pardot Files and pass the hi.wol.org URL as heroBgUrl before sending.'
    );
    heroBgSrc = `data:image/png;base64,${readFileSync(HERO_WAVE_PATH).toString('base64')}`;
  }

  const t = talkAboutIt || {};
  const talkHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.pickCardBg}; border-radius:8px;">
        <tr><td style="padding:22px 24px;">
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.inkSecondary}; text-transform:uppercase; margin-bottom:6px;">From this week's charts</div>
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:19px; color:${COLORS.darkBlue}; line-height:1.3; margin-bottom:12px;">${copy(t.headline || '[EDITOR: headline]')}</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6; margin-bottom:10px;"><strong>What it is.</strong> ${copy(t.whatItIs || '[EDITOR: two or three sentences, only what the data shows]')}</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;"><strong>Why it matters.</strong> ${copy(t.whyItMatters || '[EDITOR: why it matters for teens]')}</div>
          ${questionList('At home', t.atHome || ['[EDITOR: question for parents]', '[EDITOR: question for parents]'])}
          ${questionList('In youth group', t.inYouthGroup || ['[EDITOR: question for leaders]', '[EDITOR: question for leaders]'])}
          ${t.scripture?.reference ? `<div style="margin-top:16px; padding-top:14px; border-top:1px solid #c9e9f6; font-family:Georgia, 'Noto Serif', serif; font-style:italic; font-size:14px; color:${COLORS.darkBlue}; line-height:1.6;">${t.scripture.text ? `&ldquo;${copy(t.scripture.text)}&rdquo; ` : ''}<span style="font-style:normal; font-weight:bold;">${escapeHtml(t.scripture.reference)}</span></div>` : ''}
        </td></tr>
      </table>`;

  const headsUpHtml = headsUpRows.length
    ? headsUpRows.map((h) => `
        <tr><td style="padding:10px 0; border-top:1px solid ${COLORS.hairline}; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;">
          <strong>${maybeLink(h.where === 'App Store Apps' || h.where === 'App Store Games' ? appStoreUrl(h.row) : h.where === 'Steam' ? steamUrl(h.row) : null, escapeHtml(h.basedOn))}</strong>${ratingChip(h.row)}${h.where ? ` <span style="color:${COLORS.inkSecondary}; font-size:12px;">(${escapeHtml(h.where)})</span>` : ''}<br>
          ${copy(h.note)}
        </td></tr>`).join('\n')
    : `<tr><td style="padding:10px 0; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.inkSecondary}; font-style:italic;">Nothing flagged this week.</td></tr>`;

  const socialSectionHtml = socialPick
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.pickCardBg}; border-radius:8px;">
        <tr><td style="padding:20px 24px;">
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.darkBlue}; text-transform:uppercase; margin-bottom:6px;">Trend Watch${socialPick.source ? ` &middot; <span style="font-weight:400; letter-spacing:0; text-transform:none;">Spotted on ${escapeHtml(socialPick.source)}</span>` : ''}</div>
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:15px; color:${COLORS.darkBlue}; margin-bottom:6px;">${copy(socialPick.title)}</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;">${copy(socialPick.blurb)}</div>
        </td></tr>
      </table>`
    : '';

  // Pilot-only "what changed" note (John Yarosh, 2026-10-19): tells the
  // feedback group what was changed so they can react to it. Editor field
  // pilotNote = { heading, items: [...] }; omit it once the pilot ends.
  const pilotNoteHtml = pilotNote?.items?.length
    ? `
  <tr><td style="padding:0 32px 20px 32px;">
    <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.darkBlue}; text-transform:uppercase; margin:0 0 6px 0;">${copy(pilotNote.heading || 'What changed this week')}</div>
    ${pilotNote.items.map((i) => `<div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6; margin:0 0 4px 0; padding-left:14px; text-indent:-14px;">&bull;&nbsp; ${copy(i)}</div>`).join('\n    ')}
  </td></tr>`
    : '';

  const surveyHtml = surveyUrl
    ? `
  <tr><td style="padding:0 32px 28px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${COLORS.lightBlue}; border-radius:8px;">
      <tr><td style="padding:18px 22px; text-align:center; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;">
        <strong style="color:${COLORS.darkBlue};">The Signal is new and still taking shape.</strong><br>Tell us what helped and what to change. It takes about a minute.<br>
        <a href="${escapeHtml(surveyUrl)}" style="display:inline-block; margin-top:10px; padding:12px 24px; background:${COLORS.darkBlue}; color:#ffffff; text-decoration:none; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.12); ${CONDENSED} font-weight:700; font-size:14px; letter-spacing:1px; text-transform:uppercase;">Share Your Feedback</a>
      </td></tr>
    </table>
  </td></tr>`
    : '';

  // Hero hook (direction 2b, 2026-11-02): the editor's condensed teaser, else
  // the Talk About It headline.
  const heroTeaser = teaser
    ? copy(teaser)
    : (t.placeholder || !t.headline ? '[EDITOR: teaser, a condensed take on the Talk About It headline]' : copy(t.headline));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Signal: ${issue ? `Issue ${escapeHtml(issue)}, ${formatSendDate(week)}` : `Week of ${formatWeek(week)}`}</title>
</head>
<body style="margin:0; padding:0; background:${COLORS.pageBg};">
${preheader ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${copy(preheader)}</div>\n` : ''}<div style="background:${COLORS.pageBg}; padding:32px 0; font-family:Arial, Helvetica, sans-serif;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="width:600px; max-width:600px; margin:0 auto; background:#ffffff;">

  <tr>
    <td background="${heroBgSrc}" bgcolor="${COLORS.darkBlue}" valign="top" style="background-color:${COLORS.darkBlue}; background-image:url('${heroBgSrc}'); background-repeat:no-repeat; background-position:right top; background-size:600px 400px; padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:24px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding:0;">
                  <img src="${logoSrc}" alt="Word of Life" width="120" height="22" style="display:block; width:120px; height:auto; border:0; font-family:Arial, sans-serif; font-size:13px; font-weight:bold; color:#ffffff;">
                </td>
                <td valign="middle" align="right" style="padding:0; font-family:Arial, sans-serif; font-size:12px; font-weight:bold; letter-spacing:1.5px; color:#ffffff; text-transform:uppercase; white-space:nowrap;">
                  ${issue ? `Issue ${escapeHtml(issue)}&nbsp;&nbsp;<span style="color:${COLORS.lightBlue};">/</span>&nbsp;&nbsp;` : ''}${formatSendDate(week)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid ${COLORS.lightBlue}; font-size:0; line-height:0; height:1px;">&nbsp;</td></tr>
            </table>
            <div style="padding-top:18px; ${CONDENSED} font-weight:700; font-size:60px; line-height:60px; letter-spacing:2px; color:#ffffff; text-transform:uppercase;">The Signal</div>
            <div style="padding-top:8px; font-family:Arial, sans-serif; font-size:15px; line-height:22px; color:${COLORS.lightBlue};">A weekly culture briefing for youth leaders and parents</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 28px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid ${COLORS.hairlineOnDark}; font-size:0; line-height:0; height:1px;">&nbsp;</td></tr>
              <tr>
                <td style="padding-top:16px; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:12px; letter-spacing:2px; color:${COLORS.lightBlue}; text-transform:uppercase;">This Week</td>
              </tr>
              <tr>
                <td style="padding-top:6px; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:22px; line-height:29px; color:#ffffff;">${heroTeaser}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
${SHOW_CYA_ATTRIBUTION ? `
  <tr>
    <td style="background:${COLORS.darkerBlue}; padding:10px 32px; font-family:Arial, sans-serif; font-size:12px; line-height:18px; color:#ffffff;">${CYA_ATTRIBUTION_TEXT}</td>
  </tr>
` : ''}
  <tr>
    <td style="padding:24px 32px 24px 32px;">
      <p style="margin:0; font-family:Arial, sans-serif; font-size:15px; line-height:24px; color:${COLORS.ink};">Five minutes on what teens are watching, hearing, and playing this week, plus one thing worth talking about at home or in youth group.</p>
    </td>
  </tr>

  ${sectionBadge('01', 'Talk About It')}
  <tr><td style="padding:20px 32px 24px 32px;">
    ${talkHtml}
  </td></tr>

  ${sectionBadge('02', 'Heads Up')}
  <tr><td style="padding:16px 32px 24px 32px;">
    ${headsUpIntro ? `<div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6; margin-bottom:10px;">${copy(headsUpIntro)}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${headsUpHtml}
    </table>
  </td></tr>

  ${chartsGroupHeader(CHART_SECTIONS[0], CHART_SECTIONS[CHART_SECTIONS.length - 1])}

  ${sectionBadge(CHART_SECTIONS[0], 'What Teens Are Watching')}
  ${chartBlock('Movies – Trending This Week', scoredList(top(movies), 'movie'))}
  ${chartBlock('TV – Trending This Week', scoredList(top(tv), 'tv'))}
  ${chartBlock('YouTube – Trending (US)', twoLineList(top(youtube), (v) => ({ title: v.title, meta: `${cleanText(v.channel)} – ${v.views} views` })), { last: true })}

  ${sectionBadge(CHART_SECTIONS[1], 'What Teens Are Hearing')}
  ${chartBlock('Apple Music – Top Songs', plainList(top(appleMusic), songLine, songListen))}
  ${chartBlock('Christian Songs', plainList(top(christian), songLine, songListen))}
  ${chartBlock(`Apple Podcasts – Picks From This Week's Top ${podcasts?.length || 20}`, podcastRows.length ? plainList(podcastRows, (p) => escapeHtml(cleanText(p.name)), (p) => listenLine(applePodcastUrl(p), 'Apple Podcasts', cleanText(p.name))) : `<tr><td style="padding:8px 0; color:${COLORS.inkSecondary}; font-style:italic;">[EDITOR: pick up to 5 shows from the Top 20 (names only), skipping news and political talk]</td></tr>`, { last: true })}

  ${sectionBadge(CHART_SECTIONS[2], 'What Teens Are Playing')}
  ${chartBlock('Steam – Top Sellers', plainList(top(steam), (g) => maybeLink(steamUrl(g), escapeHtml(cleanText(g.title))), null, { rated: true }))}
  ${chartBlock('App Store – Top Free Games', plainList(top(appleGames), (a) => `${maybeLink(appStoreUrl(a), escapeHtml(cleanText(a.name)))} <span style="color:${COLORS.inkSecondary};">– ${escapeHtml(cleanText(a.developer))}</span>`, null, { rated: true }))}
  ${chartBlock('App Store – Top Free Apps', plainList(top(appleApps), (a) => `${maybeLink(appStoreUrl(a), escapeHtml(cleanText(a.name)))} <span style="color:${COLORS.inkSecondary};">– ${escapeHtml(a.category)}</span>`, null, { rated: true }), { last: true })}

  ${socialPick ? `${sectionBadge('06', 'Trend Watch')}
  <tr><td style="padding:20px 32px 24px 32px;">
    ${socialSectionHtml}
  </td></tr>` : ''}

  ${sectionBadge(socialPick ? '07' : '06', 'Ministry Angle')}
  <tr><td style="padding:24px 32px 28px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.darkBlue}; border-radius:8px;">
      <tr><td style="padding:24px 26px;">
        <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.lightBlue}; text-transform:uppercase; margin-bottom:10px;">Worth Naming Out Loud</div>
        <div style="font-family:Georgia, 'Noto Serif', serif; font-style:italic; font-size:16px; color:#ffffff; line-height:1.6;">${copy(ministryAngle)}</div>
      </td></tr>
    </table>
  </td></tr>
${pilotNoteHtml}
${surveyHtml}

  <tr>
    <td style="padding:20px 32px 24px 32px; border-top:1px solid ${COLORS.hairline};">
      <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.darkBlue}; text-transform:uppercase; margin:0 0 6px 0;">Why We Share This</div>
      <div style="font-family:Arial, sans-serif; font-size:12px; color:${COLORS.inkSecondary}; line-height:1.6;">${WHY_WE_SHARE_THIS}</div>
    </td>
  </tr>

  <tr>
    <td style="background:#414042; padding:24px 32px; text-align:center;">
      <div style="font-family:Arial, sans-serif; font-size:12px; color:${COLORS.pageBg}; line-height:1.6;">
        <p style="margin:0 0 8px 0;">You are receiving this email because you have a connection with Word of Life Fellowship.</p>
        <p style="margin:0 0 8px 0;"><a href="{{View_Online}}" rel="nofollow" style="color:${COLORS.pageBg}; text-decoration:underline;">View this email online</a></p>
        <p style="margin:0 0 8px 0;"><a href="{{EmailPreferenceCenter}}" rel="nofollow" style="color:${COLORS.pageBg}; text-decoration:underline;">Manage your Signal subscription</a></p>
        <p style="margin:0 0 8px 0;"><a href="{{Unsubscribe}}" rel="nofollow" style="color:${COLORS.pageBg}; text-decoration:underline;">Unsubscribe from all Word of Life email</a></p>
        <p style="margin:0;">Word of Life Fellowship<br>4230 Glendale Road, Pottersville, NY 12860</p>
      </div>
    </td>
  </tr>

</table>
</div>
</body>
</html>
`;

  return toAsciiHtml(html);
}
