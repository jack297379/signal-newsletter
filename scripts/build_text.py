"""scripts/build_text.py
Writes the Pardot Text-tab version of an issue from its built HTML:
output/YYYY-MM-DD-design.html -> output/YYYY-MM-DD-text.txt (added 2026-10-19).
Copy it with `LANG=en_US.UTF-8 pbcopy` so curly quotes and dashes survive.

Usage: python3 scripts/build_text.py 2026-10-19
"""
import html, re, sys

week = sys.argv[1]
s = open(f'output/{week}-design.html', encoding='utf-8').read()
s = re.sub(r'<div style="display:none.*?</div>', '', s, flags=re.S)
s = re.sub(r'<title>.*?</title>', '', s, flags=re.S)
s = re.sub(r'<span style="[^"]*border-radius:3px[^"]*">(.*?)</span>', r' [\1]', s, flags=re.S)
s = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>',
           lambda m: f"{m.group(2)}: {m.group(1)}" if m.group(1).startswith('{{') else f"{m.group(2)} ({m.group(1)})",
           s, flags=re.S)
s = re.sub(r'<img[^>]*>', '', s)
s = s.replace('</td>', ' ')
s = re.sub(r'<(br|/tr|/div|/p)[^>]*>', '\n', s)
s = re.sub(r'<[^>]+>', '', s)
s = html.unescape(s)
lines = [re.sub(r'[ \t\xa0]+', ' ', l).strip() for l in s.split('\n')]
lines = ['Scores are TMDB user scores out of 10.' if l == 'Title TMDB Score / 10' else l for l in lines]
out = []
for l in lines:
    if l or (out and out[-1]):
        out.append(l)
open(f'output/{week}-text.txt', 'w', encoding='utf-8').write('\n'.join(out).strip() + '\n')
