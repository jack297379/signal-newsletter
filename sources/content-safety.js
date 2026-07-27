// sources/content-safety.js
// Shared first-pass content filter, used by any source that pulls raw
// user-generated text (Reddit posts, YouTube comments, etc.) for the
// Social/TikTok Pulse section. This is NOT a substitute for the editor's
// judgment and never fully will be — see sources/reddit.js for why (some
// categories of "not okay for this newsletter" share no vocabulary with
// anything keyword-blockable).

const BLOCK_PATTERNS = [
  /\bnsfw\b/i,
  /\bonlyfans\b/i,
  /\bepstein\b/i,
  /\bdry hump/i,
  /\b(brother|sister|dad|father|mom|mother|stepdad|stepmom|stepbrother|stepsister|uncle|aunt|cousin)\b[\s\S]{0,40}\b(kiss(es|ing)?|touch(es|ing)?|grop(e|es|ing))\b/i,
];

export function isBlocked(text) {
  return BLOCK_PATTERNS.some((re) => re.test(text));
}
