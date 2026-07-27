// qa.js
// Lightweight sanity checks that run over every source's data BEFORE the
// markdown draft is built. These catch things a thrown error wouldn't — a
// real HTTP success where a selector quietly grabbed the wrong field (the
// Billboard "RE-ENTRY" bug), or a source's own API returning duplicate rows
// (Steam). Goal is triage, not perfection: flag anything suspicious so the
// editor doesn't have to eyeball every row by hand before working with it.

// Only check fields that are supposed to hold a free-text name — NOT fields
// like releaseYear/score/developer/category, where a bare number or a value
// like "n/a"/"unknown" is an intentional, expected fallback, not a bug.
const NAME_FIELDS = ['title', 'artist', 'name'];

// Chart-movement badges we've actually seen leak into an artist/title field
// via a broken selector (e.g. Billboard's "RE-ENTRY" tag).
const KNOWN_BAD_TOKENS = ['re-entry', 're-\nentry'];

function nameFields(item) {
  return Object.entries(item).filter(([key, val]) => typeof val === 'string' && NAME_FIELDS.includes(key));
}

function isSuspicious(value) {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (/^\d+$/.test(v)) return true; // bare number where a name was expected
  if (KNOWN_BAD_TOKENS.includes(v)) return true;
  return false;
}

export function runDataChecks(byLabel) {
  const warnings = [];

  for (const [label, items] of Object.entries(byLabel)) {
    if (!Array.isArray(items) || items.length === 0) continue;

    // Suspicious field values (numeric-only, known chart-badge artifacts, etc.)
    items.forEach((item) => {
      nameFields(item).forEach(([key, val]) => {
        if (isSuspicious(val)) {
          warnings.push(
            `${label}: item #${item.rank ?? '?'} has a suspicious "${key}" value ("${val.replace(/\n/g, ' ')}") — possible parsing error`
          );
        }
      });
    });

    // Duplicate entries within the same list (by title/name, case-insensitive)
    const nameKey = 'title' in items[0] ? 'title' : 'name' in items[0] ? 'name' : null;
    if (nameKey) {
      const seen = new Map();
      items.forEach((item) => {
        const key = item[nameKey]?.trim().toLowerCase();
        if (!key) return;
        if (seen.has(key)) {
          warnings.push(`${label}: duplicate entry "${item[nameKey]}" (items #${seen.get(key)} and #${item.rank})`);
        } else {
          seen.set(key, item.rank);
        }
      });
    }
  }

  return warnings;
}
