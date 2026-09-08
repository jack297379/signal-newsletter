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
// If the editor file is missing, the three human sections are rendered with
// unmistakable [EDITOR: ...] placeholders and the podcast picks default to
// the first five chart entries flagged youth-relevant (real names from the
// chart, placeholder blurbs). Nothing is ever invented. Editor file shape:
// {
//   "socialPick":   { "title": "...", "blurb": "..." },
//   "podcastPicks": [ { "name": "<exact chart name>", "blurb": "..." }, ... x5 ],
//   "ministryAngle": "..."
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

const flagged = data.podcasts.filter((p) => p.flagged);
const defaultPicks = (flagged.length >= 5 ? flagged : data.podcasts).slice(0, 5)
  .map((p) => ({ name: p.name, blurb: '[EDITOR: one-line blurb - why this show matters for teens]' }));

const html = buildBrandedHtml({
  ...data,
  logoUrl,
  podcastPicks: editor?.podcastPicks || defaultPicks,
  ministryAngle: editor?.ministryAngle || '[EDITOR: one sentence connecting a cultural moment above to a youth ministry application]',
  socialPick: editor?.socialPick || {
    title: '[EDITOR: trend name]',
    blurb: '[EDITOR: 2-3 sentences - what the trend is, why teens care, and one question a youth worker could ask about it]',
  },
});

const outPath = `./output/${week}-design.html`;
writeFileSync(outPath, html);
console.log(`Branded HTML written to ${outPath}${editor ? '' : ' (placeholders - editor copy not yet supplied)'}`);
