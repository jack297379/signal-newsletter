// template/build-html.js
// Renders the branded, distribution-ready Signal HTML — same visual system
// Claude Design produced (numbered section badges, italic Georgia subheads,
// light-blue podcast-pick cards, dark-blue "Worth Naming Out Loud" callout),
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
// Editorial content (podcast pick blurbs, the ministry angle sentence, a
// social trend write-up) still has to be authored by a human/AI each week —
// that judgment call isn't something to automate away. This module just
// takes that finished copy as input alongside the raw data.

import { readFileSync } from 'fs';

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
        ? `<span style="color:${COLORS.inkSecondary};">&mdash;</span>`
        : `<span style="color:${COLORS.darkBlue};">${escapeHtml(item.score)}</span>`;
      return `<tr><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline};"><strong>${item.rank}.</strong> ${escapeHtml(item.title)}${year}</td><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline}; text-align:right; font-weight:bold;">${score}</td></tr>`;
    })
    .join('\n');
}

// Renders a plain single-line list: "N. Title – meta"
function plainList(items, formatter) {
  if (!items || items.length === 0) {
    return `<tr><td style="padding:8px 0; color:${COLORS.inkSecondary}; font-style:italic;">Source unavailable this week.</td></tr>`;
  }
  return items
    .map((item) => `<tr><td style="padding:8px 0; border-top:1px solid ${COLORS.hairline};">${item.rank}. ${formatter(item)}</td></tr>`)
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
      return `<tr><td style="padding:5px 0${isLast ? ' 0 0' : ''}; border-top:1px solid ${COLORS.hairline};"><strong>${item.rank}. ${escapeHtml(title)}</strong><br><span style="color:${COLORS.inkSecondary};">${escapeHtml(meta)}</span></td></tr>`;
    })
    .join('\n');
}

function podcastPickCard(name, blurb, isLast) {
  return `
        <tr><td style="padding-bottom:${isLast ? 20 : 12}px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.pickCardBg}; border-radius:8px;"><tr><td style="padding:16px 20px;">
            <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:15px; color:${COLORS.darkBlue};">${escapeHtml(name)}</div>
            <div style="font-family:Arial, sans-serif; font-size:13px; color:${COLORS.ink}; margin-top:4px; line-height:1.5;">${escapeHtml(blurb)}</div>
          </td></tr></table>
        </td></tr>`;
}

/**
 * @param {object} data - same raw fields the markdown template receives
 *   (week, movies, tv, youtube, appleMusic, christian, steam, appleGames,
 *   appleApps, podcasts) plus editorial additions:
 * @param {Array<{name: string, blurb: string}>} data.podcastPicks - curated
 *   picks. Each `name` MUST exactly match (case-insensitive) an entry in
 *   `data.podcasts` — throws if not, to make fabricated picks structurally
 *   impossible rather than relying on a prompt asking nicely.
 * @param {string} data.ministryAngle - the editor's one-sentence tie-in.
 * @param {{title: string, blurb: string}|null} data.socialPick - null while
 *   Reddit is down / no real trend chosen; an object once there's a real one.
 * @param {string|null} data.logoUrl - a real, publicly hosted image URL (e.g.
 *   Pardot's image library) for the WOL logo. REQUIRED for an actual email
 *   send — many clients (notably Outlook desktop) block or strip base64
 *   data-URI images outright. When omitted, falls back to an embedded
 *   base64 copy for quick previews/screenshots only; that fallback will
 *   render fine in a browser but should never be pasted into Pardot as-is.
 */
export function buildBrandedHtml(data) {
  const {
    week, movies, tv, youtube, appleMusic, christian,
    steam, appleGames, appleApps, podcasts,
    podcastPicks = [], ministryAngle, socialPick = null, logoUrl = null,
  } = data;

  // Structural guardrail: a pick that doesn't match real chart data is a
  // fabrication risk, not a typo to silently render anyway.
  const realPodcastNames = new Set((podcasts || []).map((p) => p.name.toLowerCase()));
  for (const pick of podcastPicks) {
    if (!realPodcastNames.has(pick.name.toLowerCase())) {
      throw new Error(
        `buildBrandedHtml: podcast pick "${pick.name}" does not match any entry in this week's real podcast chart. Refusing to render a fabricated pick.`
      );
    }
  }

  let logoSrc = logoUrl;
  if (!logoSrc) {
    console.warn(
      'buildBrandedHtml: no logoUrl provided — embedding the logo as a base64 data URI for preview purposes only. ' +
      'This will NOT display in most email clients (Outlook desktop blocks data-URI images). ' +
      'Upload the logo to Pardot\'s image library and pass the resulting URL as logoUrl before sending.'
    );
    logoSrc = `data:image/png;base64,${readFileSync(WOL_LOGO_PATH).toString('base64')}`;
  }

  const fullPodcastReference = (podcasts || [])
    .map((p) => `${p.rank}. ${escapeHtml(p.name)}`)
    .join(' &middot; ');

  const socialSectionHtml = socialPick
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.pickCardBg}; border-radius:8px;">
        <tr><td style="padding:20px 24px;">
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.darkBlue}; text-transform:uppercase; margin-bottom:6px;">Editor's Pick</div>
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:15px; color:${COLORS.darkBlue}; margin-bottom:6px;">${escapeHtml(socialPick.title)}</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; line-height:1.6;">${escapeHtml(socialPick.blurb)}</div>
        </td></tr>
      </table>`
    : `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed ${COLORS.inkSecondary}; border-radius:8px;">
        <tr><td style="padding:20px 24px;">
          <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.inkSecondary}; text-transform:uppercase; margin-bottom:6px;">Editor's Pick &ndash; Pending</div>
          <div style="font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink}; font-style:italic; line-height:1.6;">No trend made the cut this week &ndash; source one manually or drop this section for this issue.</div>
        </td></tr>
      </table>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>The Signal &mdash; Week of ${formatWeek(week)}</title>
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
      <div style="margin-top:4px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.lightBlue};">A weekly culture briefing for youth leaders &mdash; ${formatWeek(week)}</div>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 32px 8px 32px;">
      <p style="margin:0; font-family:Arial, sans-serif; font-size:15px; line-height:1.6; color:${COLORS.ink};">Five minutes on what your students are watching, hearing, and playing this week &ndash; plus one thing worth naming out loud in youth group.</p>
    </td>
  </tr>

  ${sectionBadge('01', 'What Teens Are Watching')}
  ${subhead('Movies – TMDB Top 10')}
  <tr><td style="padding:8px 32px 20px 32px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${scoredList(movies, { showYear: true })}
    </table>
  </td></tr>

  ${subhead('TV – TMDB Top 10')}
  <tr><td style="padding:8px 32px 20px 32px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${scoredList(tv)}
    </table>
  </td></tr>

  ${subhead('YouTube Trending – Top 10')}
  <tr><td style="padding:8px 32px 20px 32px; font-family:Arial, sans-serif; font-size:13.5px; color:${COLORS.ink}; line-height:1.7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${twoLineList(youtube, (v) => ({ title: v.title, meta: `${v.channel} – ${v.views} views` }))}
    </table>
  </td></tr>

  ${sectionBadge('02', 'Music This Week')}
  ${subhead('Apple Music – Top 10')}
  <tr><td style="padding:8px 32px 0 32px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${plainList(appleMusic, (t) => `${escapeHtml(t.title)} – ${escapeHtml(t.artist)}`)}
    </table>
  </td></tr>

  ${subhead('Christian Songs – Top 10')}
  <tr><td style="padding:8px 32px 20px 32px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${plainList(christian, (t) => `${escapeHtml(t.title)} – ${escapeHtml(t.artist)}`)}
    </table>
  </td></tr>

  ${sectionBadge('03', 'Social / TikTok Pulse')}
  <tr><td style="padding:20px 32px 24px 32px;">
    ${socialSectionHtml}
  </td></tr>

  ${sectionBadge('04', 'Gaming & Apps')}
  ${subhead('Steam – Top Sellers')}
  <tr><td style="padding:8px 32px 20px 32px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${plainList(steam, (g) => escapeHtml(g.title))}
    </table>
  </td></tr>

  ${subhead('App Store – Top Free Games (US)')}
  <tr><td style="padding:8px 32px 20px 32px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${plainList(appleGames, (a) => `${escapeHtml(a.name)} <span style="color:${COLORS.inkSecondary};">– ${escapeHtml(a.developer)}</span>`)}
    </table>
  </td></tr>

  ${subhead('App Store – Top Free Apps, All Categories (US)')}
  <tr><td style="padding:8px 32px 28px 32px; font-family:Arial, sans-serif; font-size:14px; color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${plainList(appleApps, (a) => `${escapeHtml(a.name)} <span style="color:${COLORS.inkSecondary};">– ${escapeHtml(a.category)} – ${escapeHtml(a.developer)}</span>`)}
    </table>
  </td></tr>

  ${sectionBadge('05', 'Podcast Charts')}
  <tr><td style="padding:20px 32px 4px 32px;">
    <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.inkSecondary}; text-transform:uppercase;">Editor's Picks</div>
  </td></tr>
  <tr><td style="padding:12px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${podcastPicks.map((p, i) => podcastPickCard(p.name, p.blurb, i === podcastPicks.length - 1)).join('\n')}
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 28px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.pageBg}; border-radius:8px;">
      <tr><td style="padding:18px 22px;">
        <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.inkSecondary}; text-transform:uppercase; margin-bottom:10px;">Full Top ${podcasts?.length || 0} (Reference)</div>
        <div style="font-family:Arial, sans-serif; font-size:12px; color:${COLORS.inkSecondary}; line-height:1.6;">${fullPodcastReference}</div>
      </td></tr>
    </table>
  </td></tr>

  ${sectionBadge('06', 'Ministry Angle')}
  <tr><td style="padding:24px 32px 32px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.darkBlue}; border-radius:8px;">
      <tr><td style="padding:24px 26px;">
        <div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:1.5px; color:${COLORS.lightBlue}; text-transform:uppercase; margin-bottom:10px;">Worth Naming Out Loud</div>
        <div style="font-family:Georgia, 'Noto Serif', serif; font-style:italic; font-size:16px; color:#ffffff; line-height:1.6;">"${escapeHtml(ministryAngle)}"</div>
      </td></tr>
    </table>
  </td></tr>

  <tr>
    <td style="background:#414042; padding:24px 32px; text-align:center;">
      <div style="font-family:Arial, sans-serif; font-size:12px; color:${COLORS.pageBg}; line-height:1.6;">
        <p style="margin:0 0 8px 0;">You are receiving this email because you have a connection with Word of Life Fellowship.</p>
        <p style="margin:0 0 8px 0;"><a href="{{Unsubscribe}}" rel="nofollow" style="color:${COLORS.pageBg}; text-decoration:underline;">Unsubscribe</a> from email communications</p>
        <p style="margin:0;">Word of Life Fellowship<br>4200 Route 9, PO Box 600, Schroon Lake, NY 12870</p>
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
