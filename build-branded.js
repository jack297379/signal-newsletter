// build-branded.js
// Renders the branded distribution HTML from a week's real pulled data
// (output/YYYY-MM-DD.json, written by run.js) plus the editor's finished copy
// (output/YYYY-MM-DD.editor.json, written by hand). See template/build-html.js
// for why this replaces the Claude Design round-trip.
//
// Usage:
//   node build-branded.js              -> latest output/*.json
//   node build-branded.js 2026-09-03   -> that week
//   node build-branded.js --embed-logo  -> base64 logo for offline preview only
//
// If the editor file is missing, the editor sections are rendered with
// unmistakable [EDITOR: ...] placeholders. Nothing is ever invented. Editor
// file shape (v2 format, 2026-10-09):
// {
//   "talkAboutIt": { "basedOn": "<exact chart title or Social Pulse text>",
//                    "headline": "...", "whatItIs": "...", "whyItMatters": "...",
//                    "atHome": ["...", "..."], "inYouthGroup": ["...", "..."],
//                    "scripture": { "reference": "...", "text": "..." } },
//   "podcastPicks": [ "<exact chart name>", ... up to 5 ],
//   "headsUp":      [ { "basedOn": "<exact chart title>", "note": "..." } ],  // 0 to 2
//   "socialPick":   { "source": "...", "title": "...", "blurb": "..." } | null,
//   "ministryAngle": "...",
//   "surveyUrl":    "https://..." | null
// }

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { buildBrandedHtml } from './template/build-html.js';

// Hosted copy of the masthead logo in Pardot's Files library ("WOL Logo_White",
// file id 261357, same asset as the local WOL logo_horizontal_white_(R).png).
// Found 2026-09-08. Passing it means the generated HTML references a real
// image URL that email clients will load, instead of a base64 data URI that
// Outlook and Gmail block. Pass --embed-logo to force the base64 preview mode.
const PARDOT_LOGO_URL =
  'https://hi.wol.org/l/343241/2023-08-21/29vq4n7/343241/16926289847HlVAsGQ/WOL_logo_horizontal_white__R_.png';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const logoUrl = flags.includes('--embed-logo') ? null : PARDOT_LOGO_URL;
const week = arg || readdirSync('./output')
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .pop()
  ?.replace('.json', '');
if (!week) {
  console.error('No output/YYYY-MM-DD.json found. Run `npm start` first.');
  process.exit(1);
}

const dataPath = `./output/${week}.json`;
const editorPath = `./output/${week}.editor.json`;
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

let editor = null;
if (existsSync(editorPath)) {
  editor = JSON.parse(readFileSync(editorPath, 'utf8'));
} else {
  console.warn(`No ${editorPath} - rendering with [EDITOR: ...] placeholders. This is a layout proof, not a sendable issue.`);
}

const html = buildBrandedHtml({
  ...data,
  logoUrl,
  talkAboutIt: editor?.talkAboutIt || { placeholder: true },
  headsUp: editor?.headsUp || [{ placeholder: true, basedOn: '[EDITOR: exact chart title]', note: '[EDITOR: one plain sentence on why parents may want a closer look; only what the rating or data shows]' }],
  socialPick: editor ? editor.socialPick || null : null,
  ministryAngle: editor?.ministryAngle || '[EDITOR: one sentence connecting a cultural moment above to youth ministry]',
  podcastPicks: editor?.podcastPicks || [],
  surveyUrl: editor?.surveyUrl || null,
});

const outPath = `./output/${week}-design.html`;
writeFileSync(outPath, html);
console.log(`Branded HTML written to ${outPath}${editor ? '' : ' (placeholders - editor copy not yet supplied)'}`);
