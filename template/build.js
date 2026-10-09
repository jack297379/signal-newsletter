// template/build.js
import { SHOW_CYA_ATTRIBUTION, CYA_ATTRIBUTION_TEXT } from './attribution.js';
// Takes the raw results from every source and formats them into the
// standard Signal markdown draft, matching the format used in the manual
// Gemini pilot so the editor workflow doesn't have to change.

// TMDB has no vote average yet for titles that haven't released (e.g. a
// trailer-driven trending entry). That's expected, not an error, so render it
// as plain words instead of a bare "n/a" that reads like a broken field.
function scoreLabel(score) {
  return score === 'n/a' ? 'not yet rated' : `Score: ${score}`;
}

// Content flags from sources/ratings.js (v2, 2026-10-09). Publisher ratings
// only; no tag means no rating was found, not that the title is clean.
function flag(item) {
  const tags = [];
  if (item.rating) tags.push(item.rating);
  if (item.crudeTitle) tags.push('Crude title');
  if (item.political) tags.push('Political: hidden in email');
  const adv = item.advisories?.length ? ` _(${item.advisories.join('; ')})_` : '';
  return tags.length ? ` **[${tags.join(' | ')}]**${adv}` : adv;
}

function numberedList(items, formatter) {
  if (!items || items.length === 0) return '[Source unavailable — editor should check manually]';
  return items.map((item) => `${item.rank}. ${formatter(item)}${flag(item)}`).join('\n');
}

export function buildTemplate({
  week,
  movies,
  tv,
  appleMusic,
  christian,
  steam,
  appleGames,
  appleApps,
  youtube,
  socialPulse,
  socialPulseSource,
  podcasts,
  errors,
  qaWarnings,
}) {
  const flaggedPodcasts = (podcasts || []).filter((p) => p.flagged);

  return `# The Signal — Week of ${week}
*What teens are watching, playing, and listening to this week.*
*Prepared for Word of Life Fellowship Communications*
${SHOW_CYA_ATTRIBUTION ? `*${CYA_ATTRIBUTION_TEXT}*\n` : ''}
---

## Data QA

${qaWarnings && qaWarnings.length ? qaWarnings.map((w) => `- ${w}`).join('\n') : 'No anomalies detected — data looks clean.'}

---

## Talk About It (v2 lead feature)

> EDITOR: Pick ONE real item from the charts or Social Pulse below (exact title goes in editor.json "basedOn").
> Write: a headline; What it is (2 to 3 sentences, only what the data shows); Why it matters;
> 2 questions for parents ("At home"); 2 questions for leaders ("In youth group"); one Scripture reference.
> Audience is youth leaders AND parents on one list. Word of Life voice, no byline. No politics.

## Heads Up (parents)

> EDITOR: 0 to 2 chart items worth a closer look (exact chart title), with one plain sentence each.
> Say only what the rating, the publisher's content notes, or the chart shows. Flagged rows are marked **[ ]** below.

---

## What Teens Are Watching

**Popular on TMDB — Movies** *(TMDB's real weekly trending API — not the scraped "Popular" page)*
${numberedList(movies, (m) => `${m.title} (${m.releaseYear}) — ${scoreLabel(m.score)}`)}

**Popular on TMDB — TV Shows**
${numberedList(tv, (s) => `${s.title} — ${scoreLabel(s.score)}`)}

**YouTube Trending (US)**
${numberedList(youtube, (v) => `${v.title} — ${v.channel} (${v.views} views)`)}

---

## Music This Week

**Apple Music Top 10** *(via Apple's public Top Songs chart)*
${numberedList(appleMusic, (t) => `${t.title} — ${t.artist}`)}

**Christian Songs Top 10** *(source: ${christian?.[0]?.source || 'unavailable'})*
${numberedList(christian, (t) => `${t.title} — ${t.artist}`)}

---

## Social / TikTok Pulse

> EDITOR (optional, "Trend Watch"): pick ONE trend or slang term only if it is safe and verified.
> Write 2 to 3 sentences: what it is and why teens care. Skip the section if nothing qualifies.

${socialPulseSource === 'youtube-fallback' ? '*(Reddit was unavailable this week — these candidates are from YouTube comments on trending videos instead. See Agent Notes.)*\n' : ''}${socialPulse && socialPulse.length ? socialPulse.map((c, i) => `${i + 1}. **[${c.label}]** ${c.text}`).join('\n') : '[unavailable — both Reddit and the YouTube fallback came back empty this week]'}

---

## Gaming & Apps

**Steam Top Sellers** *(source: ${steam?.[0]?.source || 'unavailable'})*
${numberedList(steam, (g) => g.title)}

**App Store Top Free Games (US)**
${numberedList(appleGames, (a) => `${a.name} — ${a.developer}`)}

**App Store Top Free Apps — All Categories (US)**
${numberedList(appleApps, (a) => `${a.name} — ${a.category} — ${a.developer}`)}

---

## Podcast Charts

> EDITOR: pick up to 5 youth-relevant shows from the Top 20 (exact names, no blurbs needed in v2). Skip news and political talk (e.g. Rogan-style shows).

**Flagged as potentially youth-relevant:**
${flaggedPodcasts.length ? flaggedPodcasts.map((p) => `${p.rank}. ${p.name}`).join('\n') : '[none flagged — review full list manually]'}

**Full Top 20:**
${numberedList(podcasts, (p) => p.name)}

---

## Ministry Angle

> EDITOR: One closing sentence connecting a cultural moment above to youth ministry ("Worth Naming Out Loud").

---

## Agent Notes

${errors && errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'All sources retrieved successfully.'}

---

*Signal is published weekly by Word of Life Fellowship.*
*Editor completes Talk About It, Heads Up, Ministry Angle (and optional Trend Watch) before scheduling. The email shows the top 5 of each chart.*
`;
}
