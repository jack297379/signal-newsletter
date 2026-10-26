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
  // Sexual content / exploitation / abuse. Confirmed leak 2026-09-03: an
  // r/teenagers title about AI child pornography reached the candidate list.
  /\bporn(o|ography|ographic|hub|s)?\b/i,
  /\bp[e3]d[o0](phile|philia|s)?\b/i,
  /\bchild (abuse|sex|exploitation)/i,
  /\bsex(ual|ually)? (abuse|assault|predator|content)/i,
  /\bgroom(ed|ing|er)\b/i,
  /\brap(e|ed|ist|ing)\b/i,
  /\bmolest/i,
  /\bnudes?\b/i,
  /\bsex tape/i,
  /\bhentai\b/i,
  // Profanity. Confirmed leak 2026-09-03: a YouTube comment containing
  // "FUCKING" reached the editor's Social Pulse candidate list. Candidates
  // are quoted verbatim in a newsletter for youth pastors and parents, so
  // anything with strong profanity is dropped outright rather than left for
  // the editor to trip over. Covers common spellings/censored variants
  // (f*ck, fuk, sh1t, etc.) without matching innocent words (scunthorpe-safe:
  // word boundaries, no bare "ass" or "hell").
  // No trailing \b: compounds like "Fuckoffening" leaked 2026-10-26.
  /\bf+[u\*@#]+c+k/i,
  /\bfuk+(ing|ed|er)?\b/i,
  /\b(bull|horse|dog)?sh[i1\*]+t+(ty|s|ted|ting|head|post|posts|posting)?\b/i,
  /\bb[i1\*]tch(es|y|ing)?\b/i,
  /\bass(hole|holes|wipe)\b/i,
  /\bd[i1]ck(s|head)?\b/i,
  /\bp[u\*]ss(y|ies)\b/i,
  /\bc[u\*]nt(s)?\b/i,
  /\bmotherf/i,
  /\bwtf\b/i,
  /\bstfu\b/i,
  /\bn[i1]gg/i,
  /\bfag(got|s)?\b/i,
  /\bretard(ed|s)?\b/i,
];

// Politics. Editorial rule from John Yarosh, 2026-09-03: "Absolutely no
// politics." The Signal never runs partisan or electoral content in any
// section, so political candidates are dropped before the editor sees them
// rather than left as a judgment call. Deliberately broad - losing a benign
// post that mentions "the senate" costs nothing; surfacing "Why Trump over
// Harris" to a youth-pastor audience does.
const POLITICS_PATTERNS = [
  /\bpolitic(s|al|ian|ians)?\b/i,
  // hasan/piker added 2026-10-26 (political streamer quote leaked into r/GenZ candidates).
  /\b(trump|biden|harris|obama|vance|walz|pelosi|aoc|desantis|newsom|musk|rfk|hasan piker|piker)\b/i,
  /\b(democrat|democrats|republican|republicans|gop|maga|libs?|liberal|liberals|conservative|conservatives|leftist|leftists|right-wing|left-wing|far-right|far-left|woke)\b/i,
  /\b(election|elections|ballot|voting|vote for|voter|voters|midterms?|primary election|presidential|president|congress|senate|senator|governor|supreme court|scotus|white house|capitol)\b/i,
  /\b(socialis[tm]s?|communis[tm]s?|marxis[tm]s?|fascis[tm]s?|nazis?|antifa)\b/i,
  /\b(abortion|pro-life|pro-choice|roe v\.? wade|gun control|second amendment|2nd amendment|immigration|immigrants?|deportation|border wall|ice raids?|tariffs?)\b/i,
  /\b(israel|gaza|palestin(e|ian|ians)|hamas|zionis[tm]|ukraine|putin|zelensky|netanyahu)\b/i,
  // Government / current-affairs vocabulary. A 2026-09-03 r/GenZ title about
  // the "Lake America" / Denali / military-base renaming controversy passed
  // the lists above; John's rule is absolute, so government and policy
  // machinery words are blocked too, accepting some benign losses.
  /\b(government|govt|federal|administration|executive order|legislation|lawmakers?|policy|policies|military|pentagon|renamings?|renamed|lake america|denali|gulf of america)\b/i,
  // Protest, policing, and civil-rights flashpoints. Added 2026-09-08 after
  // three r/GenZ and r/TikTokCringe titles (a protester assaulted at a party
  // conference, a teen detained by police, police-abuse investigations)
  // passed the lists above.
  /\b(protest|protests|protester|protesters|protesting|riot|riots|rioters?|reform uk|party conference|police|policing|cops?|officers?|detained|arrests?|arrested|brutality|civil rights|activists?|activism)\b/i,
];

export function isPolitical(text) {
  return POLITICS_PATTERNS.some((re) => re.test(text));
}

export function isBlocked(text) {
  return BLOCK_PATTERNS.some((re) => re.test(text)) || isPolitical(text);
}
