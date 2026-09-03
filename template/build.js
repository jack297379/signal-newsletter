// template/build.js
// Takes the raw results from every source and formats them into the
// standard Signal markdown draft, matching the format used in the manual
// Gemini pilot so the editor workflow doesn't have to change.

// TMDB has no vote average yet for titles that haven't released (e.g. a
// trailer-driven trending entry). That's expected, not an error, so render it
// as plain words instead of a bare "n/a" that reads like a broken field.
function scoreLabel(score) {
  return score === 'n/a' ? 'not yet rated' : `Score: ${score}`;
}

function numberedList(items, formatter) {
  if (!items || items.length === 0) return '[Source unavailable — editor should check manually]';
  return items.map((item) => `${item.rank}. ${formatter(item)}`).join('\n');
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
*Powered by The Center for Youth Apologetics*

---

## Data QA

${qaWarnings && qaWarnings.length ? qaWarnings.map((w) => `- ${w}`).join('\n') : 'No anomalies detected — data looks clean.'}

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

> EDITOR: Review the trend candidates below and pick ONE to write up.
> Write 2–3 sentences: what the trend is, why teens care, and one question a youth worker could ask about it.

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

> EDITOR: Select the top 5 most youth-relevant and add a one-line description for each.

**Flagged as potentially youth-relevant:**
${flaggedPodcasts.length ? flaggedPodcasts.map((p) => `${p.rank}. ${p.name}`).join('\n') : '[none flagged — review full list manually]'}

**Full Top 20:**
${numberedList(podcasts, (p) => p.name)}

---

## Ministry Angle

> EDITOR: One sentence connecting a cultural moment above to a youth ministry application.

---

## Agent Notes

${errors && errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'All sources retrieved successfully.'}

---

*Signal is published weekly by Word of Life Fellowship.*
*Editor completes the three EDITOR sections before scheduling.*
`;
}
