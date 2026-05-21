const https = require('https');

// ============================================================
// Momentum Daily Background — 阿里云 ESA / Serverless Function
//
// 环境变量（在阿里云 ESA 控制台配置）：
//   MOMENTUM_TOKEN  — Momentum 登录 token（必需，用于调用 API 获取每日图片）
//
// 如果不配置 token，会使用本地缓存中的最近一张图片 URL 作为降级方案。
// ============================================================

const FALLBACK_URL = 'https://momentum.photos/img/3596af9e-4d1f-492d-a95e-2e8ddc0e3af5.jpg';

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
    };
    const req = mod.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

function httpsPost(url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// 尝试从 Momentum API 获取今日图片 URL
async function fetchDailyPhotoUrl(token) {
  try {
    const res = await httpsPost('https://api.momentumdash.com/backgrounds', {
      'X-Momentum-Version': '2.26.6',
      'X-Momentum-ClientDate': new Date().toISOString().split('T')[0],
      'Authorization': `Bearer ${token}`,
    });

    if (res.status === 200) {
      const data = JSON.parse(res.body.toString('utf-8'));
      // API 返回的数据中查找图片 URL
      const photo = findPhotoUrl(data);
      if (photo) return photo;
    }
  } catch (e) {
    console.error('API fetch failed:', e.message);
  }
  return null;
}

// 递归查找 JSON 中的图片 URL
function findPhotoUrl(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      if (
        val.includes('momentum.photos/img/') ||
        val.includes('modash.blob.core.windows.net') ||
        (val.includes('unsplash.com') && val.includes('photo'))
      ) {
        return val;
      }
    }
    if (typeof val === 'object' && val !== null) {
      const found = findPhotoUrl(val);
      if (found) return found;
    }
  }
  return null;
}

// 生成 HTML 页面
function buildHtml(imageUrl, source) {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Momentum Daily Background</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }
    .info {
      position: fixed; bottom: 20px; right: 20px;
      background: rgba(0,0,0,0.5); color: #fff;
      padding: 8px 16px; border-radius: 8px;
      font-family: -apple-system, sans-serif; font-size: 13px;
      backdrop-filter: blur(8px);
    }
    .info a { color: #8cf; text-decoration: none; }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="Momentum Daily Background" />
  <div class="info">Source: ${source}</div>
</body>
</html>`;
}

// 主处理函数（阿里云 ESA / Serverless 入口）
module.exports.handler = async (req, res) => {
  const token = process.env.MOMENTUM_TOKEN;
  let imageUrl = FALLBACK_URL;
  let source = 'fallback';

  if (token) {
    const apiPhoto = await fetchDailyPhotoUrl(token);
    if (apiPhoto) {
      imageUrl = apiPhoto;
      source = 'momentum-api';
    }
  }

  // 直接代理图片（返回图片二进制）
  if (req.query && req.query.format === 'image') {
    try {
      const img = await httpsGet(imageUrl);
      res.setHeader('Content-Type', img.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(img.body);
    } catch (e) {
      res.status(502).send('Failed to fetch image');
    }
    return;
  }

  // 返回 HTML 页面
  const html = buildHtml(imageUrl, source);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(html);
};

// 本地测试
if (require.main === module) {
  const http = require('http');
  const url = require('url');
  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const fakeReq = { query: parsed.query };
    const fakeRes = {
      _headers: {},
      setHeader(k, v) {
        this._headers[k] = v;
      },
      status(code) {
        this._statusCode = code;
        return this;
      },
      send(body) {
        res.writeHead(this._statusCode || 200, this._headers);
        res.end(body);
      },
    };
    fakeRes.status = (code) => {
      fakeRes._statusCode = code;
      return fakeRes;
    };
    await module.exports.handler(fakeReq, fakeRes);
  });
  server.listen(3000, () => {
    console.log('Local test server: http://localhost:3000');
    console.log('Image proxy:      http://localhost:3000?format=image');
  });
}
