// sources/http.js
// Shared fetch helper for the unauthenticated JSON sources (Apple RSS/JSON
// feeds, Apple podcast chart, Steam storefront). Retries transient failures
// - 5xx responses, 429, and network errors - a couple of times with a short
// backoff before giving up. Added 2026-09-03 after Apple's podcast chart feed
// returned a one-off 504 Gateway Time-out on an otherwise clean run: a single
// blip should not cost the editor a whole section.
//
// Non-transient statuses (404, 403, 400) are NOT retried - they mean the URL
// or request shape is wrong, and retrying only hides that.

const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

export async function fetchJsonWithRetry(url, { label = url, retries = DEFAULT_RETRIES, backoffMs = DEFAULT_BACKOFF_MS, headers = {} } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.warn(`${label}: transient failure (${lastError.message}) - retry ${attempt}/${retries} in ${backoffMs / 1000}s`);
      await sleep(backoffMs * attempt);
    }
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res.json();
      const err = new Error(`${label} failed: ${res.status} ${res.statusText}`);
      if (!isTransient(res.status)) throw err;
      lastError = err;
    } catch (err) {
      // fetch() itself rejects on DNS/connection/reset errors - transient.
      if (err.message.startsWith(`${label} failed:`) && !isTransient(Number(err.message.match(/: (\d{3}) /)?.[1]))) throw err;
      lastError = err.message.startsWith(`${label} failed:`) ? err : new Error(`${label} failed: ${err.message}`);
    }
  }
  throw lastError;
}

// Minimal-header GET using Node's raw https module instead of fetch().
// Reason (confirmed 2026-09-03, same IP, same User-Agent, 8 seconds apart):
// curl and https.get both returned 200 from reddit.com/r/<sub>/.rss while
// the built-in fetch() (undici) got 429 / 403 "Blocked" every time. undici
// adds default headers a browser would send in a cross-origin fetch
// (sec-fetch-mode: cors, accept-language: *, etc.) that Reddit's bot
// screening flags. This sends exactly the headers it is given and nothing
// else. Follows up to 3 redirects.
import https from 'node:https';

export function fetchTextMinimal(url, headers = {}, { timeoutMs = 30000, maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && maxRedirects > 0) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return fetchTextMinimal(next, headers, { timeoutMs, maxRedirects: maxRedirects - 1 }).then(resolve, reject);
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ ok: status >= 200 && status < 300, status, statusText: res.statusMessage || '', body }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`request timed out after ${timeoutMs / 1000}s`)));
  });
}
