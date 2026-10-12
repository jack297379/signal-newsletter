// template/build-html.js
// Renders the branded, distribution-ready Signal HTML — same visual system
// Claude Design produced (numbered section badges, italic Georgia subheads,
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
  "/Users/JohnYarosh/Library/CloudStorage/OneDrive-WordofLifeFellowshipInc/WOL NY Marketing Team - WOL_SecondBrain/resources/assets/logos/wol-fellowship/WOL logo_horizontal_white_(R).png";

const COLORS = {
  darkBlue: '#004f68',
  lightBlue: '#73d1f5',
  ink: '#414042',
  inkSecondary: '#939598',
  hairline: '#e6e7e8',
  pageBg: '#e6e7e8',
  pickCardBg: '#eaf7fc',
};

function formatWeek(week) {
  const d = new Date(`${week}T00:00:00`);
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
        <div style="font-family:Georgia, 'Noto Serif', serif; font-style:italic; font-size:20px; color:#0a7ea4;">${escapeHtml(text)}</div>
      </td>
    </tr>`;
}

// Renders a scored list (movies/TV): rank + title (+ optional year), score right-aligned.
function scoredList(items, { showYear = false } = {}) {
  if (!items || items.length === 0) {
    return `<tr><td style="padding:8px 0; color:${COLORS.inkSecondary}; font-style:italic;">Source unavailable this week.</td></tr>`;
  }
  return items
    .map((item) => {
      const year = showYear && item.releaseYear ? ` <span style="color:${COLORS.inkSecondary};">(${escapeHtml(item.releaseYear)})</span>` : '';
      const score = item.score === 'n/a'
        ? `<span style="color:${COLORS.inkSecondary};">n/a</span>`
        : `<span style="color:${COLORS.darkBlue};">${escapeHtml(item.score)}</span>`;
      return `<tr><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline};"><strong>${item.rank}.</strong> ${escapeHtml(item.title)}${year}${ratingChip(item)}</td><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline}; text-align:right; font-weight:bold;">${score}</td></tr>`;
    })
    .join('\n');
}

// Renders a plain single-line list: "N. Title – meta"
function plainList(items, formatter) {
  if (!items || items.length === 0) {
    return `<tr><td style="padding:8px 0; color:${COLORS.inkSecondary}; font-style:italic;">Source unavailable this week.</td></tr>`;
  }
  return items
    .map((item) => `<tr><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline};">${item.rank}. ${formatter(item)}${ratingChip(item)}</td></tr>`)
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
      return `<tr><td style="padding:5px 0${isLast ? ' 0 0' : ''}; border-top:1px solid ${COLORS.hairline};"><strong>${item.rank}. ${escapeHtml(title)}</strong>${ratingChip(item)}<br><span style="color:${COLORS.inkSecondary};">${escapeHtml(meta)}</span></td></tr>`;
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

// Ratings that get the amber "heads up" chip instead of the neutral one.
const MATURE_RATINGS = new Set(['R', 'NC-17', 'TV-MA', 'Explicit', '17+', '18+', 'ESRB M', 'ESRB AO']);

function ratingChip(item) {
  const chips = [];
  if (item.rating) {
    const mature = MATURE_RATINGS.has(item.rating);
    chips.push(`<span style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:3px; font-family:Arial, sans-serif; font-size:10px; font-weight:bold; letter-spacing:0.5px; vertical-align:1px; ${mature ? 'background:#fde7c8; color:#8a4b00;' : `background:${COLORS.hairline}; color:${COLORS.ink};`}">${escapeHtml(item.rating)}</span>`);
  }
  if (item.crudeTitle) {
    chips.push(`<span style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:3px; font-family:Arial, sans-serif; font-size:10px; font-weight:bold; letter-spacing:0.5px; vertical-align:1px; background:#fde7c8; color:#8a4b00;">Crude title</span>`);
  }
  return chips.join('');
}

// Political rows are hidden (hard rule, no politics); the published rank
// numbers are kept so the chart is never silently renumbered.
function top(items) {
  return (items || []).filter((r) => !r.political).slice(0, CHART_DEPTH);
}

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
          ${questions.map((q) => `<div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6; margin:0 0 6px 0; padding-left:14px; text-indent:-14px;">&bull;&nbsp; ${escapeHtml(q)}</div>`).join('\n          ')}`;
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
 */
// Footer merge tags use Pardot's Handlebars Merge Language ({{Unsubscribe}},
// {{View_Online}}). Verified 2026-09-08 in WOL's own account: the classic
// editor's default email body there uses {{Recipient.FirstName}} and
// {{Unsubscribe}}, i.e. HML is enabled account-wide, so the legacy
// %%unsubscribe%% syntax is NOT what this account expects.
// {{EmailPreferenceCenter}} opens the Default Email Preferences Page, where the
// public "The Signal" list (Pardot list 212761) can be unticked on its own;
// {{Unsubscribe}} is a global opt-out from all WOL email (2026-10-09, Tim Hunt).
export function buildBrandedHtml(data) {
  const {
    week, movies, tv, youtube, appleMusic, christian,
    steam, appleGames, appleApps, podcasts,
    talkAboutIt = null, headsUp = [], podcastPicks = [], ministryAngle, socialPick = null,
    surveyUrl = null, logoUrl = null,
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
  });

  let logoSrc = logoUrl;
  if (!logoSrc) {
    console.warn(
      'buildBrandedHtml: no logoUrl provided — embedding the logo as a base64 data URI for preview purposes only. ' +
      'This will NOT display in most email clients (Outlook desktop blocks data-URI images). ' +
      'Upload the logo to Pardot\'s image library and pass the resulting URL as logoUrl before sending.'
    );
    logoSrc = `data:image/png;base64,${readFileSync(WOL_LOGO_PATH).toString('base64')}`;
  }

  const t = talkAboutIt || {};
  const talkHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.pickCardBg}; border-radius:8px;">
        <tr><td style="padding:22px 24px;">
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.inkSecondary}; text-transform:uppercase; margin-bottom:6px;">From this week's charts</div>
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:19px; color:${COLORS.darkBlue}; line-height:1.3; margin-bottom:12px;">${escapeHtml(t.headline || '[EDITOR: headline]')}</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6; margin-bottom:10px;"><strong>What it is.</strong> ${escapeHtml(t.whatItIs || '[EDITOR: two or three sentences, only what the data shows]')}</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;"><strong>Why it matters.</strong> ${escapeHtml(t.whyItMatters || '[EDITOR: why it matters for teens]')}</div>
          ${questionList('At home', t.atHome || ['[EDITOR: question for parents]', '[EDITOR: question for parents]'])}
          ${questionList('In youth group', t.inYouthGroup || ['[EDITOR: question for leaders]', '[EDITOR: question for leaders]'])}
          ${t.scripture?.reference ? `<div style="margin-top:16px; padding-top:14px; border-top:1px solid #c9e9f6; font-family:Georgia, 'Noto Serif', serif; font-style:italic; font-size:14px; color:${COLORS.darkBlue}; line-height:1.6;">${t.scripture.text ? `"${escapeHtml(t.scripture.text)}" ` : ''}<span style="font-style:normal; font-weight:bold;">${escapeHtml(t.scripture.reference)}</span></div>` : ''}
        </td></tr>
      </table>`;

  const headsUpHtml = headsUpRows.length
    ? headsUpRows.map((h) => `
        <tr><td style="padding:10px 0; border-top:1px solid ${COLORS.hairline}; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;">
          <strong>${escapeHtml(h.basedOn)}</strong>${ratingChip(h.row)}${h.where ? ` <span style="color:${COLORS.inkSecondary}; font-size:12px;">(${escapeHtml(h.where)})</span>` : ''}<br>
          ${escapeHtml(h.note)}${h.row.advisories?.length ? `<br><span style="color:${COLORS.inkSecondary}; font-size:12px;">Publisher's content notes: ${escapeHtml(h.row.advisories.join('; '))}</span>` : ''}
        </td></tr>`).join('\n')
    : `<tr><td style="padding:10px 0; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.inkSecondary}; font-style:italic;">Nothing flagged this week.</td></tr>`;

  const socialSectionHtml = socialPick
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.pickCardBg}; border-radius:8px;">
        <tr><td style="padding:20px 24px;">
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.darkBlue}; text-transform:uppercase; margin-bottom:6px;">Trend Watch${socialPick.source ? ` &middot; <span style="font-weight:400; letter-spacing:0; text-transform:none;">Spotted on ${escapeHtml(socialPick.source)}</span>` : ''}</div>
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:15px; color:${COLORS.darkBlue}; margin-bottom:6px;">${escapeHtml(socialPick.title)}</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;">${escapeHtml(socialPick.blurb)}</div>
        </td></tr>
      </table>`
    : '';

  const surveyHtml = surveyUrl
    ? `
  <tr><td style="padding:0 32px 28px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${COLORS.lightBlue}; border-radius:8px;">
      <tr><td style="padding:18px 22px; text-align:center; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;">
        <strong style="color:${COLORS.darkBlue};">The Signal is new and still taking shape.</strong><br>Tell us what helped and what to change. It takes about a minute.<br>
        <a href="${escapeHtml(surveyUrl)}" style="display:inline-block; margin-top:10px; padding:10px 20px; background:${COLORS.darkBlue}; color:#ffffff; text-decoration:none; border-radius:4px; font-weight:bold;">Share your feedback</a>
      </td></tr>
    </table>
  </td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>The Signal: Week of ${formatWeek(week)}</title>
</head>
<body style="margin:0; padding:0; background:${COLORS.pageBg};">
<div style="background:${COLORS.pageBg}; padding:32px 0; font-family:Arial, Helvetica, sans-serif;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="width:600px; max-width:600px; margin:0 auto; background:#ffffff;">

  <tr>
    <td style="background:${COLORS.darkBlue}; padding:28px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="width:150px; vertical-align:middle;">
            <img src="${logoSrc}" alt="Word of Life Fellowship" width="140" style="display:block; height:auto;">
          </td>
          <td style="text-align:right; vertical-align:middle;">
            <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:3px; color:${COLORS.lightBlue}; text-transform:uppercase;">Word of Life Fellowship</div>
          </td>
        </tr>
      </table>
      <div style="margin-top:20px; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:34px; letter-spacing:1px; color:#ffffff; text-transform:uppercase;">The Signal</div>
      <div style="margin-top:4px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.lightBlue};">A weekly culture briefing for youth leaders and parents &middot; ${formatWeek(week)}</div>
      ${SHOW_CYA_ATTRIBUTION ? `<div style="margin-top:8px; font-family:Arial, sans-serif; font-size:11px; font-style:italic; color:rgba(255,255,255,0.65);">${CYA_ATTRIBUTION_TEXT}</div>` : ''}
    </td>
  </tr>

  <tr>
    <td style="padding:24px 32px 8px 32px;">
      <p style="margin:0; font-family:Arial, sans-serif; font-size:15px; line-height:1.6; color:${COLORS.ink};">Five minutes on what teens are watching, hearing, and playing this week, plus one thing worth talking about at home or in youth group.</p>
    </td>
  </tr>

  ${sectionBadge('01', 'Talk About It')}
  <tr><td style="padding:20px 32px 24px 32px;">
    ${talkHtml}
  </td></tr>

  ${sectionBadge('02', 'Heads Up')}
  <tr><td style="padding:8px 32px 24px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${headsUpHtml}
    </table>
  </td></tr>

  <tr><td style="padding:4px 32px 0 32px; font-family:Arial, sans-serif; font-size:12px; color:${COLORS.inkSecondary}; line-height:1.5;">
    The charts below show what is actually popular this week, as is. Tags are the publisher's own ratings (movie and TV ratings, Apple's explicit and age ratings, ESRB). No tag means no rating was available, not that a title is clean.
  </td></tr>

  ${sectionBadge('03', 'What Teens Are Watching')}
  ${chartBlock('Movies – Trending This Week', scoredList(top(movies), { showYear: true }))}
  ${chartBlock('TV – Trending This Week', scoredList(top(tv)))}
  ${chartBlock('YouTube – Trending (US)', twoLineList(top(youtube), (v) => ({ title: v.title, meta: `${v.channel} – ${v.views} views` })), { last: true })}

  ${sectionBadge('04', 'What Teens Are Hearing')}
  ${chartBlock('Apple Music – Top Songs', plainList(top(appleMusic), (s) => `${escapeHtml(s.title)} – ${escapeHtml(s.artist)}`))}
  ${chartBlock('Christian Songs', plainList(top(christian), (s) => `${escapeHtml(s.title)} – ${escapeHtml(s.artist)}`))}
  ${chartBlock(`Apple Podcasts – Picks From This Week's Top ${podcasts?.length || 20}`, podcastRows.length ? plainList(podcastRows, (p) => escapeHtml(p.name)) : `<tr><td style="padding:8px 0; color:${COLORS.inkSecondary}; font-style:italic;">[EDITOR: pick up to 5 shows from the Top 20 (names only), skipping news and political talk]</td></tr>`, { last: true })}

  ${sectionBadge('05', 'What Teens Are Playing')}
  ${chartBlock('Steam – Top Sellers', plainList(top(steam), (g) => escapeHtml(g.title)))}
  ${chartBlock('App Store – Top Free Games', plainList(top(appleGames), (a) => `${escapeHtml(a.name)} <span style="color:${COLORS.inkSecondary};">– ${escapeHtml(a.developer)}</span>`))}
  ${chartBlock('App Store – Top Free Apps', plainList(top(appleApps), (a) => `${escapeHtml(a.name)} <span style="color:${COLORS.inkSecondary};">– ${escapeHtml(a.category)}</span>`), { last: true })}

  ${socialPick ? `${sectionBadge('06', 'Trend Watch')}
  <tr><td style="padding:20px 32px 24px 32px;">
    ${socialSectionHtml}
  </td></tr>` : ''}

  ${sectionBadge(socialPick ? '07' : '06', 'Ministry Angle')}
  <tr><td style="padding:24px 32px 28px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.darkBlue}; border-radius:8px;">
      <tr><td style="padding:24px 26px;">
        <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.lightBlue}; text-transform:uppercase; margin-bottom:10px;">Worth Naming Out Loud</div>
        <div style="font-family:Georgia, 'Noto Serif', serif; font-style:italic; font-size:16px; color:#ffffff; line-height:1.6;">"${escapeHtml(ministryAngle)}"</div>
      </td></tr>
    </table>
  </td></tr>
${surveyHtml}

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
