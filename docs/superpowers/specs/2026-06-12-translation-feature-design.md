# Translation Feature for Must-See Daily

**Date:** 2026-06-12
**Status:** Design (approved)

## Overview

Add Chinese translation support to the Must-See Daily news dashboard. English news articles fetched daily from Finnhub (finance) and GNews (AI) will be translated to Chinese via Tencent Cloud TMT API, stored alongside the original text in JSON, and displayed with a per-card toggle button.

## Motivation

The news dashboard aggregates English-language sources. Adding Chinese translations makes the content accessible to a Mandarin-speaking audience without losing access to the original English text.

## Data Flow

```
[Finnhub API]         [GNews API]
       │                    │
       ▼                    ▼
[GitHub Actions: Build news.json]
       │ Merge & map fields
       ▼
news_YYYYMMDD.json (English only)
       │
       ▼
[GitHub Actions: Translate step]
       │ Call Tencent Cloud TMT API
       │ Translate: title → title_cn, summary → summary_cn, description → description_cn
       ▼
news_YYYYMMDD.json (English + Chinese)
       │
       ▼
[git commit + push]
       │
       ▼
[index.html]
       │ Fetch JSON, render cards
       │ Per-card "Translate" button toggles EN ↔ 中文
       ▼
[User sees translated content on demand]
```

## JSON Schema Change

No new files — the existing `news_YYYYMMDD.json` gains `_cn` suffix fields.

### Finance item (Finnhub)

```json
{
  "title": "Fed keeps rates steady",
  "title_cn": "美联储维持利率不变",
  "summary": "The Federal Reserve decided to hold interest rates steady at its June meeting...",
  "summary_cn": "美联储在6月会议上决定维持利率不变...",
  "source": "Reuters",
  "datetime": 1780953689,
  "url": "https://...",
  "image": "https://..."
}
```

### AI item (GNews)

```json
{
  "title": "New AI model released",
  "title_cn": "新AI模型发布",
  "description": "OpenAI announced a new reasoning model...",
  "description_cn": "OpenAI发布了一款新的推理模型...",
  "source": "TechCrunch",
  "publishedAt": "2026-06-12T14:00:00Z",
  "url": "https://...",
  "image": "https://..."
}
```

### Translation scope

| Field | Translate? |
|-------|-----------|
| `title` | ✅ → `title_cn` |
| `summary` (finance) | ✅ → `summary_cn` |
| `description` (AI) | ✅ → `description_cn` |
| `source` | ❌ Keep as-is |
| `url` / `image` / `datetime` / `publishedAt` | ❌ Keep as-is |

## GitHub Actions Changes

### New step: Translate

Inserted between the existing "Build news.json" step and the "Commit and push" step in `.github/workflows/fetch-news.yml`.

**Step details:**
- Uses `actions/github-script@v7` (Node.js, same as the build step)
- Reads the just-written `news_YYYYMMDD.json`
- For each finance item: translates `title` and `summary` via Tencent Cloud TMT
- For each AI item: translates `title` and `description` via Tencent Cloud TMT
- Adds `_cn` fields to the same JSON
- Writes the updated JSON back

### Tencent Cloud TMT API

- **Endpoint:** `https://tmt.tencentcloudapi.com`
- **Action:** `TextTranslate`
- **Region:** `ap-guangzhou` (or user's preferred region)
- **Source language:** `en`
- **Target language:** `zh`
- **Auth:** Signature v3 (HMAC-SHA256) — requires `TENCENT_SECRET_ID` and `TENCENT_SECRET_KEY`

### Rate limiting & error handling

- Each article generates 2 API calls (title + summary/description) — 10 finance + 10 AI = up to 20 calls per run
- Tencent TMT free tier: 5 million characters/month — well within budget
- On single-item translation failure: log warning, leave `_cn` field as empty string, continue
- On total API failure (e.g. invalid credentials): skip all translations, keep English-only JSON, fail the step visibly

### Required secrets

Add to GitHub repo:
- `TENCENT_SECRET_ID` — Tencent Cloud API key ID
- `TENCENT_SECRET_KEY` — Tencent Cloud API key secret

## Local Testing

### Script: `test-local-translate.js`

A standalone Node.js script for testing the translation pipeline locally, separate from the main `test-local.js` (which handles news fetching).

**Usage:**
```bash
# First ensure news data exists
node test-local.js

# Then run translation
node test-local-translate.js
```

**What it does:**
1. Reads `.env` for `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`
2. Finds the latest `news/news_YYYYMMDD.json` file
3. For each finance item: calls TMT API to translate `title` → `title_cn` and `summary` → `summary_cn`
4. For each AI item: calls TMT API to translate `title` → `title_cn` and `description` → `description_cn`
5. Writes the updated JSON back to the same file
6. Prints a translation summary

**Implementation notes:**
- Uses Node.js built-in `crypto` module for Tencent Cloud Signature v3 authentication — no external dependencies
- Progress dots (`.`) printed per translation call
- On per-item failure: logs warning, leaves `_cn` as empty string, continues
- On credential failure: exits with error
- Translates empty strings as a no-op (returns empty immediately)

**Rate limiting:**
- Sequential calls (no concurrency) to avoid hitting TMT rate limits during testing
- ~20 API calls per run = ~2-3 seconds total

### Required `.env` additions

```
TENCENT_SECRET_ID=your_secret_id_here
TENCENT_SECRET_KEY=your_secret_key_here
```

### Signature v3 Auth

The script implements Tencent Cloud's [TC3-HMAC-SHA256 signing process](https://www.tencentcloud.com/document/api/213/47673):

1. Build `CanonicalRequest` (HTTP method + URI + headers + payload hash)
2. Build `StringToSign` (algorithm + timestamp + credential scope + canonical request hash)
3. Derive `SigningKey` via cascading HMAC-SHA256 (date → service → `tc3_request`)
4. Sign and construct `Authorization` header

This is the recommended auth method for Tencent Cloud APIs and will be reused identically in the GitHub Actions workflow step.

## Frontend Changes (index.html)

### Data field mapping

When rendering cards, the JS must now check for the `_cn` counterpart:

```js
// Current:
card.querySelector('.title').textContent = item.title;
card.querySelector('.description').textContent = item.summary || item.description;

// New: add state tracking
card.dataset.lang = 'en'; // 'en' or 'zh'
```

### Per-card toggle button

Each card gets a small "翻译" / "English" toggle button:

- Placed in the card footer, near the source/date line
- On click: toggle `card.dataset.lang` between `'en'` and `'zh'`
  - If `'zh'` and `item.summary_cn` exists → show `title_cn` / `summary_cn`
  - If `'en'` or no `_cn` field → show original English
- Button text flips: "中文" → "English"

### States

| State | Behavior |
|-------|----------|
| Translation exists | Toggle button works, shows Chinese |
| No `_cn` field (old data) | Button hidden or disabled |
| `_cn` field is empty string | Button disabled, tooltip "Translation unavailable" |
| Translation API failed for this item | `_cn` field missing/empty, same as above |

### CSS

- Small pill-style button, secondary styling, sits inline in the card footer
- No animation needed — instant text swap

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/fetch-news.yml` | Add translate step between build and commit |
| `index.html` | Add per-card translate button + toggle logic (JS + CSS) |
| `.env` | Add `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` (local dev only) |
| `test-local-translate.js` | New standalone script for local translation testing |

## Backward Compatibility

- Old JSON files (before this change) have no `_cn` fields — frontend hides the toggle button gracefully
- New JSON files are fully backward-compatible with old frontend (extra `_cn` fields are just ignored)

## Non-Goals

- No DeepSeek or LLM summarization (deferred to a future feature if desired)
- No global language toggle (per-card only)
- No translation of cached/older news files (only newly fetched data is translated)
