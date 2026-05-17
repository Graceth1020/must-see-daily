// Test script: reads .env, fetches APIs, writes news.json
// Usage: node test-local.js

const fs = require('fs');
const https = require('https');

// ── Load .env ──
if (fs.existsSync('.env')) {
  const env = fs.readFileSync('.env', 'utf-8');
  env.split('\n').filter(Boolean).forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

if (!process.env.FINNHUB_KEY) console.warn('⚠ FINNHUB_KEY not set — finance will be empty');
if (!process.env.GNEWS_KEY) console.warn('⚠ GNEWS_KEY not set — AI will be empty');

const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const now = new Date().toISOString();

// ── Simple fetch wrapper ──
function fetch(url, token) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'node-test' } };
    if (token) opts.headers['Authorization'] = `token ${token}`;
    https.get(url, opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`Parse error: ${data.slice(0,100)}`)); }
      });
    }).on('error', reject);
  });
}

// ── Main ──
async function main() {
  console.log('Fetching...');

  let finance = [];
  try {
    const raw = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_KEY}`);
    if (Array.isArray(raw)) {
      finance = raw.slice(0, 5).map(i => ({
        title: i.headline || i.title || '', summary: i.summary || '',
        url: i.url || '', source: i.source || '', datetime: i.datetime || 0,
        image: i.image || ''
      }));
    }
    console.log(`  ✓ Finance: ${finance.length} items`);
  } catch (e) { console.warn(`  ✗ Finance: ${e.message}`); }

  let ai = [];
  try {
    const raw = await fetch(`https://gnews.io/api/v4/search?q=artificial%20intelligence&token=${process.env.GNEWS_KEY}&lang=en&max=5`);
    const articles = raw.articles || [];
    ai = articles.slice(0, 5).map(i => ({
      title: i.title || '', description: i.description || '',
      url: i.url || '', source: (i.source && i.source.name) || i.source || '',
      publishedAt: i.publishedAt || '', image: i.image || ''
    }));
    console.log(`  ✓ AI: ${ai.length} items`);
  } catch (e) { console.warn(`  ✗ AI: ${e.message}`); }

  let github = [];
  try {
    const raw = await fetch(`https://api.github.com/search/repositories?q=created:>${yesterday}&sort=stars&order=desc&per_page=5`, process.env.GITHUB_TOKEN);
    const items = raw.items || [];
    github = items.slice(0, 5).map(i => ({
      full_name: i.full_name || '', description: i.description || '',
      stargazers_count: i.stargazers_count || 0, html_url: i.html_url || '',
      language: i.language || null
    }));
    console.log(`  ✓ GitHub: ${github.length} items`);
  } catch (e) { console.warn(`  ✗ GitHub: ${e.message}`); }

  const datePart = now.slice(0, 10).replace(/-/g, '');
  const output = { lastUpdated: now, finance, ai, github };
  fs.mkdirSync('news', { recursive: true });
  fs.writeFileSync(`news/news_${datePart}.json`, JSON.stringify(output, null, 2) + '\n');
  console.log(`\n✅ news/news_${datePart}.json written (${finance.length} finance, ${ai.length} AI, ${github.length} GitHub)`);
}

main().catch(console.error);
