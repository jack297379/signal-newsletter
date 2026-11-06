# Handoff: The Signal – weekly email template revisions

## Overview
*The Signal* is a weekly culture briefing email for youth leaders and parents, sent by Word of Life Fellowship. The 2026-10-19 issue got a design review against the Word of Life Design System (brand guidelines, email appendix, register 3 "Ministry update"). This package holds the original issue, the corrected issue, and every change, so you can apply them to the **generator/template** that produces `output/YYYY-MM-DD-design.html`. Apply them there, not just to this one issue.

## About the design files
- `original/2026-10-19-design.html` is the issue as generated.
- `revised/2026-10-19-design.html` is the corrected reference.

Both are table-based HTML email with inline styles, which is the right format for email clients. Treat the revised file as the visual source of truth. Then update the code that renders each section (masthead, section bars, chart lists, badges, CTA, footer) so future issues come out this way automatically. Diff the two files to see each change exactly.

## Fidelity
**High fidelity.** Colors, type, sizes, and copy in the revised file are final.

## Task for Claude Code
1. Find the template/partials that generate The Signal (search for `The Signal`, `#0a7ea4`, `#939598`, `Publisher's content notes`).
2. Apply changes 1–14 below to the template and the data-shaping logic.
3. Regenerate the 2026-10-19 issue and diff it against `revised/2026-10-19-design.html`. The only differences should be ones you can explain.

---

## Changes (apply in the generator)

### Document / technical
1. **Add `lang="en"`** to `<html>`.
2. **Remove `<meta name="color-scheme" content="light dark">`.** The email has no dark-mode styles, so this tag invites clients to auto-invert it badly. Only add it back alongside real `@media (prefers-color-scheme: dark)` styles.
3. **Add a hidden preheader** as the first element inside `<body>`, before the gray wrapper div:
   ```html
   <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{{preheader}}</div>
   ```
   This issue's copy: `AI apps crowd the charts, plus what teens are watching, hearing, and playing this week.` Make `preheader` a per-issue field.

### Color and contrast
4. **Secondary gray `#939598` → `#6d6e71` everywhere.** `#939598` on white is about 2.9:1, which fails WCAG AA at the 11–12px sizes used. `#6d6e71` passes 4.5:1. This affects the eyebrow labels, source tags such as "(Steam)", meta lines (YouTube channel and views, app publisher and category), the chart disclaimer, and the new table headers.
5. **Mature-rating badges: orange → brand dark blue.** Orange (`#fde7c8` / `#8a4b00`) isn't in the palette.
   - Mature (R, TV-MA, ESRB M, 17+): `background:#004f68; color:#ffffff;`
   - Everything else (PG, PG-13, TV-14, ESRB E/T, 4+, 12+): unchanged, `background:#e6e7e8; color:#414042;`
   - The badge shape stays the same: `display:inline-block; margin-left:6px; padding:1px 6px; border-radius:3px; font-family:Arial, sans-serif; font-size:10px; font-weight:bold; letter-spacing:0.5px; vertical-align:1px;`

### Typography
6. **Sub-section headers** ("Movies – Trending This Week", "Apple Music – Top Songs", and so on). Serif italic display isn't allowed outside annual theme art, and `#0a7ea4` is off-palette.
   - Before: `font-family:Georgia, 'Noto Serif', serif; font-style:italic; font-size:20px; color:#0a7ea4;`
   - After: `font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight:700; font-size:18px; color:#004f68;`
7. **Masthead "THE SIGNAL"** now uses the brand condensed display cut:
   - `font-family:'Helvetica Neue LT Std Cn', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-stretch:condensed; font-weight:700; font-size:38px; letter-spacing:1px; color:#ffffff; text-transform:uppercase;` (was 34px, non-condensed)
8. **CTA button** ("Share Your Feedback") now follows the brand email button spec (condensed, all caps, 8px radius, light drop shadow):
   - `display:inline-block; margin-top:10px; padding:12px 24px; background:#004f68; color:#ffffff; text-decoration:none; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.12); font-family:'Helvetica Neue LT Std Cn', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-stretch:condensed; font-weight:700; font-size:14px; letter-spacing:1px; text-transform:uppercase;`
   - Label: `Share Your Feedback` (CSS uppercases it).

### Copy and punctuation
9. **Curly quotes** for every quotation. The brand never uses straight `"`. Scripture is now `&ldquo;…&rdquo;`. If copy is generated, run a smart-quote pass, or emit `&ldquo;`/`&rdquo;`/`&rsquo;` from the template.
10. **The Ministry Angle callout** is editorial voice, so it shouldn't sit in quotation marks with no attribution. Render it unquoted. This issue's text: `Teens are asking apps the questions they used to ask people. They still need adults who will listen and point them to the God who gives wisdom.`
11. **The lead headline must not assert a count the charts contradict.** It changed from "Three AI assistants are in the top free apps" to `AI assistants are crowding the top free apps`. #1 in the charts, Muse from Meta, may also be an AI assistant. If the generator writes this line, have it either count from the data or avoid exact counts.

### Data presentation
12. **Movies and TV lists:**
    - Drop the release year `(2026)` from every row. It's redundant in a "trending this week" list.
    - Add a column header row above the first item, labeling the right-hand number:
      ```html
      <tr><td style="padding:0 0 6px 0; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#6d6e71;">Title</td><td style="padding:0 0 6px 0; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#6d6e71; text-align:right;">Score / 10</td></tr>
      ```
      **To do:** name the score source (TMDB? IMDb?) in that header, e.g. `TMDB Score / 10`.
13. **Heads Up section:**
    - Add a one-line intro above the list (`font-family:Arial; font-size:14px; color:#414042; line-height:1.6; margin-bottom:10px;`). Copy: `Two popular titles worth a closer look before they show up on a phone or console at home.` The section's top padding changed from 8px to 16px.
    - **Remove the raw "Publisher's content notes: …" line** under each item. The plain-language summary sentence already covers it, and the raw string was a hard-to-read wall of text.
14. **Sort lists by rank.** Podcasts were emitted 9, 17, 16 and now run 9, 16, 17. Sort every "picks from top N" list ascending before rendering.

15. **Chart disclaimer → "The Charts" group header + legend.** The plain 12px gray paragraph read like an afterthought, and it explains sections 03–05 as a group. It's now an un-numbered group header placed **before** the 03 section bar, so it reads as the intro to all three chart sections. The numbered 01–06 section bars are unchanged.
    Order: `…end of 02 Heads Up` → **group bar** → **legend band** → `03 What Teens Are Watching` bar → …
    - **Group bar:** the same shape as the numbered section bars, with colors inverted to mark it as a container and not a section. `background:#73d1f5; padding:10px 32px;` Text: `THE CHARTS` + two non-breaking spaces + `03–05`, Helvetica bold 13px, 2px tracking, uppercase, `color:#004f68`.
    - **Legend band:** full column width, `background:#eaf7fc;`, padding `16px 32px 18px 32px`, flush under the group bar; the dark 03 bar follows directly.
      - Eyebrow: `How to Read the Charts`, Helvetica bold 11px, 1.5px tracking, uppercase, `#004f68`.
      - Body: Arial 14px / 1.6, `#414042`: `Sections 03–05 show what is actually popular this week, as is. Tags are the publisher's own ratings: movie and TV ratings, Apple's explicit and age ratings, and ESRB.`
      - Badge key: `PG-13` + "General to teen" (on the band this key chip is `background:#ffffff; border:1px solid #c9e9f6;`; in chart rows neutral badges stay `#e6e7e8`); dark-blue `R` + "Mature (R, TV-MA, M, 17+)". Labels Arial 13px.
      - Closing line, Arial 13px: **No tag** (bold, `#004f68`) + ` means no rating was available, not that a title is clean.`
    - Compute the "03–05" range from the actual chart sections if numbering changes.

### Text cleanup (data normalization)
- Insert a missing space before `(`: `Tarugana(ft.` → `Tarugana (ft.`. Add a generic regex: `(\S)\(` → `$1 (` for titles.
- Collapse repeated whitespace in channel and artist names (`Johnny slime  ` → `Johnny slime`).

---

## Open items (not changed; need a decision)
- **Score source:** see #12.
- **Heads Up selection rule:** it currently flags KICK and Gears of War only, while R movies (Hope, Masterplan), TV-MA shows (Crystal Lake, Carrie), and Muse from Meta (17+) go unflagged. Either write the rule down (e.g. "top-ranked mature title per platform") or include them all.
- **"TikTok Pro – Events"** in Top Free Apps: confirm it's a real app and not a lookalike before sending.
- **Links are inconsistent.** Top songs link directly, Christian songs link to Apple Music *search* pages, and games and apps have no links. Make them consistent.
- **Footer address:** confirm `4230 Glendale Road, Pottersville, NY 12860` matches the standard Fellowship email footer.

---

## Design tokens used
**Colors**
- Dark Blue (primary): `#004f68` – section bars, headings, links, CTA, mature badges
- Light Blue (primary): `#73d1f5` – section numbers, masthead subline, feedback box border
- Light-blue tint: `#eaf7fc` (Talk About It card), `#c9e9f6` (card divider)
- Body text, 90% K: `#414042` (also the footer background)
- Secondary text: `#6d6e71`
- Rules / neutral badge / page bg, 10% K: `#e6e7e8`
- White: `#ffffff`

**Typography**
- Body: Arial 14–15px, line-height 1.6 (per the brand email appendix)
- Headings and labels: 'Helvetica Neue', Helvetica, Arial, bold
- Display and CTA: 'Helvetica Neue LT Std Cn' (77 Bold Condensed), falling back to Helvetica Neue
- Scripture only: Georgia / 'Noto Serif' italic 14px
- Section bar labels: 13px bold, 2px tracking, uppercase
- Eyebrows / table headers: 11px bold, 1–1.5px tracking, uppercase

**Layout**
- 600px single column on `#e6e7e8`, 32px top/bottom page padding
- 32px side padding inside the column
- Cards: 8px radius, 22–26px padding
- Row dividers: 1px solid `#e6e7e8`

## Assets
- Logo: `https://hi.wol.org/l/343241/2023-08-21/29vq4n7/343241/16926289847HlVAsGQ/WOL_logo_horizontal_white__R_.png` (white horizontal, 140px wide, on dark blue). No change.

## Files
- `revised/2026-10-19-design.html`: corrected reference
- `original/2026-10-19-design.html`: as generated, for diffing
