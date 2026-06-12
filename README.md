# Daily News Dashboard

An automated daily news dashboard that fetches **Finance** (CNBC) and **AI** news via GitHub Actions, translates them to Chinese, and displays them on a clean frontend page with an EN/CN toggle per card.

**How it works:** GitHub Actions runs on a schedule (daily), calls two news APIs, merges the results into a JSON file, translates key fields to Chinese via Tencent Cloud TMT API, and commits. The frontend reads the static JSON and renders the content with a per-card translate button. No API calls from the browser — everything goes through the static file.

---

## Features

- 📰 **Finance News** — Filtered to CNBC sources only (via Finnhub API)
- 🤖 **AI News** — Latest artificial intelligence stories (via GNews API)
- 🌐 **Chinese Translation** — Each card has a toggle button to switch between English and Chinese
- 📱 **Responsive** — Works on desktop and mobile
- ⚡ **Zero server needed** — Pure static site, hosted on GitHub Pages

---

## Screenshot (concept)

```
┌─────────────────────────────────────────────┐
│  ◆ Daily News Dashboard                     │
│  Finance · AI                     [MOCK DATA]│
├─────────────────────────────────────────────┤
│  ┌─────────┬──────────┐                     │
│  │ 💰 Finance │ 🤖 AI  │                     │
│  └─────────┴──────────┘                     │
│  ┌─────────────────────────────────────────┐ │
│  │ Fed Holds Interest Rates Steady...      │ │
│  │ The Federal Reserve maintained its...   │ │
│  │ Reuters · May 16              [中文]    │ │
│  ├─────────────────────────────────────────┤ │
│  │ Oil Prices Slide as OPEC+ Considers... │ │
│  │ Brent crude fell 2.3% on reports...     │ │
│  │ Bloomberg · May 15              [中文]  │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## Quick Start (for non-technical users)

### 1. Fork this repository

Click the **Fork** button at the top-right of this page on GitHub. This creates your own copy of the repo.

### 2. Get free API keys

#### Finnhub (Finance News)
1. Go to [finnhub.io](https://finnhub.io/)
2. Click **Get Free API Key** and sign up
3. Copy your API key (looks like `sandbox_abc123` or `cabc123...`)

#### GNews (AI News)
1. Go to [gnews.io](https://gnews.io/)
2. Click **Get Started Free** and sign up
3. Copy your API key (looks like `abc123def456...`)

#### Tencent Cloud TMT (Translation) — optional
If you want Chinese translation, you also need a Tencent Cloud account:
1. Go to [cloud.tencent.com](https://cloud.tencent.com/) and register
2. Enable **Machine Translation (TMT)** service in the console
3. Create an API key at [API Key Management](https://console.cloud.tencent.com/cam/capi)
4. Copy your `SecretId` and `SecretKey`

> **Note:** Finnhub's free tier allows 60 calls/minute. GNews free tier allows 100 requests/day. TMT free tier offers 5 million characters/month — enough for daily use.

### 3. Add secrets to GitHub

1. Go to your forked repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

| Name | Value | Required |
|------|-------|----------|
| `FINNHUB_KEY` | Your Finnhub API key | ✅ Yes |
| `GNEWS_KEY` | Your GNews API key | ✅ Yes |
| `TENCENT_SECRET_ID` | Your Tencent Cloud SecretId | Optional |
| `TENCENT_SECRET_KEY` | Your Tencent Cloud SecretKey | Optional |

> Without TENCENT_SECRET_ID/KEY, the workflow runs normally but skips translation — all content stays in English.

### 4. Run the workflow manually (first time)

1. Go to **Actions** tab in your repository
2. Click **Fetch Daily News** in the left sidebar
3. Click **Run workflow** → **Run workflow**
4. Wait a minute — the workflow fetches data, translates (if configured), and commits a file like `news/news_20260612.json` to the `claude_source` branch
5. Verify the `news/` folder exists in the repository

### 5. View the dashboard locally (with mock data)

Open `index.html` directly in your browser. By default, mock data is shown so you can see the UI immediately.

### 6. Switch to live mode

In `index.html`, find the config line and change it:

```javascript
const USE_MOCK_DATA = false;   // Reads from news/news_*.json
```

### 7. Deploy to GitHub Pages

1. Go to your repository **Settings** → **Pages**
2. Under **Branch**, select `claude_source` and `/ (root)`
3. Click **Save**
4. Wait 1-2 minutes, then visit `https://<your-username>.github.io/<repo-name>/`

---

## Mock Mode vs Live Mode

The dashboard has two modes controlled by a single variable in `index.html`:

```javascript
const USE_MOCK_DATA = true;   // Shows built-in fake data with Chinese translations
const USE_MOCK_DATA = false;  // Fetches news_YYYYMMDD.json from the news/ folder
```

**Mock mode** is great for:
- Testing the UI look-and-feel without running the workflow
- Previewing the translate button with pre-populated Chinese text
- Debugging layout changes

**Live mode** requires real JSON files in the `news/` folder (generated by GitHub Actions or `test-local.js`).

---

## Translation Feature

Each news card has a **"中文"** button in its footer:

| State | Behavior |
|-------|----------|
| Translation available | Click → switches title & summary to Chinese; button becomes "English" |
| No translation data | Button is hidden |
| Translation failed for this item | Button is hidden (falls back to English gracefully) |

Translation happens in two ways:
- **GitHub Actions (auto):** The workflow calls Tencent Cloud TMT API after fetching news
- **Local testing:** Run `node test-local-translate.js` to translate existing JSON files

> Old news files (before translation was added) work fine — they just don't show the translate button.

---

## Running Locally

### Prerequisites

- Node.js (v16+)
- API keys in `.env` file

### Setup `.env`

```env
FINNHUB_KEY=your_finnhub_key
GNEWS_KEY=your_gnews_key
TENCENT_SECRET_ID=your_tencent_secret_id
TENCENT_SECRET_KEY=your_tencent_secret_key
```

### Test the full pipeline

```bash
# 1. Fetch live news (requires FINNHUB_KEY + GNEWS_KEY)
node test-local.js

# 2. Translate to Chinese (requires TENCENT_SECRET_ID + TENCENT_SECRET_KEY)
node test-local-translate.js

# 3. Serve locally (to test with live data)
npx serve .
# or: python -m http.server 8000
```

### Test translation only

```bash
# Translates the latest news_*.json file in the news/ folder
node test-local-translate.js
```

---

## Project Structure

```
.github/workflows/
  └── fetch-news.yml          # GitHub Actions: fetch → translate → commit
index.html                     # Frontend page (all-in-one: HTML + CSS + JS)
README.md                      # This file
test-local.js                  # Local test script for fetching news
test-local-translate.js        # Local test script for translation
.env                           # API keys (local only, not committed)
news/                          # Auto-generated JSON files (news_YYYYMMDD.json)
docs/superpowers/specs/        # Design documents
```

---

## Data Flow

```
GitHub Actions (daily 08:00 Beijing time)
       │
       ├── Finnhub API ──────────→ Filter CNBC → Finance news (max 5)
       ├── GNews API ────────────→ AI news (max 5)
       │
       ▼
Build news_YYYYMMDD.json
       │
       ▼
Translate via Tencent Cloud TMT
       │  title → title_cn
       │  summary → summary_cn (finance)
       │  description → description_cn (AI)
       ▼
Commit → Push → GitHub Pages
       │
       ▼
Browser loads index.html
       │  fetch news_YYYYMMDD.json
       │  render cards with [中文] button
       ▼
User toggles EN ↔ CN per card
```

---

## FAQ

**Q: Why only CNBC for finance news?**
To keep the feed focused and reduce noise from syndicated content. CNBC is a consistently reliable finance news source.

**Q: How do I change the update time?**
Edit the cron expression in `.github/workflows/fetch-news.yml`. The current `0 0 * * *` runs at 00:00 UTC (08:00 Beijing time). Change it using [crontab.guru](https://crontab.guru/).

**Q: What are the API rate limits?**
- **Finnhub (free):** 60 calls/minute
- **GNews (free):** 100 requests/day
- **Tencent Cloud TMT (free):** 5 million characters/month

**Q: The workflow ran but news.json is empty**
Check the **Actions** run logs for warnings. Most likely a missing API key or the API returned an error. Verify your secrets are set correctly. Note that Finnhub may return fewer than 5 CNBC articles on some days — this is normal.

**Q: Can I trigger the workflow outside the scheduled time?**
Yes! Go to **Actions** → **Fetch Daily News** → **Run workflow**. This is useful for testing.

**Q: How do I prevent [skip ci] from causing issues?**
The commit message contains `[skip ci]` to prevent the push from triggering another workflow run (avoiding infinite loops).

**Q: Can I add more news categories?**
Yes. Edit the workflow to call additional APIs, extend the JSON transformation step, and add a new tab + renderer in `index.html`.

**Q: My API keys are in .env but the translate script fails**
Make sure you've added `TENCENT_SECRET_ID` and `TENCENT_SECRET_KEY` to your `.env` file. If you just added them, note that `.env` is excluded from git — it stays on your local machine.

---

## Security

- All API keys are stored in **GitHub Secrets** — never committed to the repository
- The `.env` file is excluded from version control via `.gitignore`
- The frontend makes zero direct API calls (all data comes from the static JSON file)
- Translation credentials are only used during the CI workflow step, never exposed to the browser

---

## License

MIT
