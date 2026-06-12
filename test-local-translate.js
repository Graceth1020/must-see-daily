// Test script: reads the latest news JSON, translates via Tencent Cloud TMT API
// Usage: node test-local-translate.js
// Note: requires TENCENT_SECRET_ID and TENCENT_SECRET_KEY in .env

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

// ── Load .env ──
if (fs.existsSync('.env')) {
  const env = fs.readFileSync('.env', 'utf-8');
  env.split('\n').filter(Boolean).forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const SECRET_ID = process.env.TENCENT_SECRET_ID;
const SECRET_KEY = process.env.TENCENT_SECRET_KEY;

if (!SECRET_ID || !SECRET_KEY) {
  console.error('❌ TENCENT_SECRET_ID and TENCENT_SECRET_KEY must be set in .env');
  process.exit(1);
}

// ── Tencent Cloud Signature v3 (TC3-HMAC-SHA256) ──
// https://www.tencentcloud.com/document/api/213/47673

function sha256(msg) {
  return crypto.createHash('sha256').update(msg).digest('hex');
}

function hmacSha256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

/**
 * Build Tencent Cloud Signature v3 authorization header.
 * Returns { authorization, timestamp } where timestamp is the
 * same Unix epoch second used in the signature — use it for X-TC-Timestamp.
 */
function buildAuthorization(payload, secretId, secretKey) {
  const now = Math.floor(Date.now() / 1000);       // Unix timestamp (seconds)
  const date = new Date(now * 1000).toISOString().slice(0, 10); // YYYY-MM-DD

  const service = 'tmt';
  const algorithm = 'TC3-HMAC-SHA256';
  const contentType = 'application/json';
  const host = 'tmt.tencentcloudapi.com';
  const signedHeaders = 'content-type;host';

  // 1. CanonicalRequest
  const canonicalRequest = [
    'POST',
    '/',
    '',
    'content-type:' + contentType,
    'host:' + host,
    '',
    signedHeaders,
    sha256(payload),
  ].join('\n');

  // 2. StringToSign — timestamp is the Unix epoch second as a string
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    now.toString(),
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  // 3. SigningKey = HMAC-SHA256(HMAC-SHA256(HMAC-SHA256("TC3" + secretKey, date), service), "tc3_request")
  const secretDate = hmacSha256('TC3' + secretKey, date);
  const secretService = hmacSha256(secretDate, service);
  const signingKey = hmacSha256(secretService, 'tc3_request');

  // 4. Signature
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');

  // 5. Authorization header
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, timestamp: now };
}

// ── Call TMT API ──
function translateText(text, secretId, secretKey) {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) return resolve('');

    const payload = JSON.stringify({
      SourceText: text,
      Source: 'en',
      Target: 'zh',
      ProjectId: 0,
    });

    const { authorization, timestamp } = buildAuthorization(payload, secretId, secretKey);

    const options = {
      hostname: 'tmt.tencentcloudapi.com',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'tmt.tencentcloudapi.com',
        'Authorization': authorization,
        'X-TC-Action': 'TextTranslate',
        'X-TC-Version': '2018-03-21',
        'X-TC-Region': 'ap-guangzhou',
        'X-TC-Timestamp': timestamp.toString(),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.Response && parsed.Response.TargetText !== undefined) {
            resolve(parsed.Response.TargetText);
          } else if (parsed.Response && parsed.Response.Error) {
            reject(new Error(`TMT API error: ${parsed.Response.Error.Code} — ${parsed.Response.Error.Message}`));
          } else {
            reject(new Error(`Unexpected response: ${data.slice(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Find latest news file ──
function findLatestNewsFile() {
  if (!fs.existsSync('news')) {
    console.error('❌ news/ directory not found. Run test-local.js first to generate news data.');
    process.exit(1);
  }

  const files = fs.readdirSync('news')
    .filter(f => f.startsWith('news_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('❌ No news_*.json files found in news/. Run test-local.js first.');
    process.exit(1);
  }

  return files[0];
}

// ── Main ──
async function main() {
  const filename = findLatestNewsFile();
  console.log(`📄 Reading: news/${filename}`);

  const data = JSON.parse(fs.readFileSync(`news/${filename}`, 'utf-8'));
  const totalItems = (data.finance?.length || 0) + (data.ai?.length || 0);
  console.log(`   Found: ${data.finance?.length || 0} finance, ${data.ai?.length || 0} AI items\n`);

  if (totalItems === 0) {
    console.error('❌ No items to translate. The news file is empty.');
    process.exit(1);
  }

  console.log('🌐 Translating...');

  // ── Translate finance items ──
  let translatedCount = 0;
  for (let i = 0; i < (data.finance?.length || 0); i++) {
    const item = data.finance[i];
    try {
      if (item.title) {
        item.title_cn = await translateText(item.title, SECRET_ID, SECRET_KEY);
        process.stdout.write('.'); // progress indicator
      }
      if (item.summary) {
        item.summary_cn = await translateText(item.summary, SECRET_ID, SECRET_KEY);
        process.stdout.write('.');
      }
      translatedCount++;
    } catch (e) {
      console.warn(`\n  ⚠ Finance[${i}] translation failed: ${e.message}`);
      item.title_cn = item.title_cn || '';
      item.summary_cn = item.summary_cn || '';
    }
  }

  // ── Translate AI items ──
  for (let i = 0; i < (data.ai?.length || 0); i++) {
    const item = data.ai[i];
    try {
      if (item.title) {
        item.title_cn = await translateText(item.title, SECRET_ID, SECRET_KEY);
        process.stdout.write('.');
      }
      if (item.description) {
        item.description_cn = await translateText(item.description, SECRET_ID, SECRET_KEY);
        process.stdout.write('.');
      }
      translatedCount++;
    } catch (e) {
      console.warn(`\n  ⚠ AI[${i}] translation failed: ${e.message}`);
      item.title_cn = item.title_cn || '';
      item.description_cn = item.description_cn || '';
    }
  }

  console.log('\n');

  // ── Write back ──
  fs.writeFileSync(`news/${filename}`, JSON.stringify(data, null, 2) + '\n');
  console.log(`✅ Translated ${translatedCount} items with _cn fields added`);
  console.log(`   Written back to news/${filename}`);

  // ── Summary ──
  let summaryLines = ['📊 Translation Summary:'];
  for (const item of data.finance || []) {
    summaryLines.push(`   • ${item.title}`);
    summaryLines.push(`     → ${item.title_cn || '(empty)'}`);
  }
  for (const item of data.ai || []) {
    summaryLines.push(`   • ${item.title}`);
    summaryLines.push(`     → ${item.title_cn || '(empty)'}`);
  }
  console.log(summaryLines.join('\n'));
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
