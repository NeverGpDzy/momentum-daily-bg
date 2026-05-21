// ============================================================
// Momentum Daily Background — 阿里云 ESA EdgeRoutine
//
// EdgeRoutine 使用 Web API（fetch / Request / Response），不是 Node.js
// 入口：export default { async fetch(request) { ... } }
// ============================================================

const MOMENTUM_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTA5MTkzODMuMCwibmJmIjoxNzc5MzgzMDgzLjAsImlzcyI6ImxvZ2luLWFwaS12MyIsInVzZXJfaWQiOjE2NjYzNjM1LCJ1c2VyX2d1aWQiOiI2MDcyOWJiNS1jNzAwLTRiZWUtYTM5ZS1mYTc3ZjZmOGUzMDQiLCJjb3Ntb3NfZGJfY29sbGVjdGlvbiI6InVzZXJkYXRhLWFsbCJ9.rxFLPzlbhNCYY1N5JaqDx2BshxxEuCvQ_p2gTugfEI4';
const FALLBACK_URL = 'https://momentum.photos/img/3596af9e-4d1f-492d-a95e-2e8ddc0e3af5.jpg';

// 用 token 调 API 获取今日背景数据
async function fetchDailyPhoto(token) {
  const today = new Date().toISOString().split('T')[0];
  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-Momentum-Version': '2.26.6',
    'Accept': 'application/json',
  };

  let bg = null;

  // 方式1: GET /feed/bulk
  try {
    const res = await fetch(
      `https://api.momentumdash.com/feed/bulk?syncTypes=background&localDate=${today}`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.backgrounds && data.backgrounds.length > 0) bg = data.backgrounds[0];
    }
  } catch (e) {}

  // 方式2: GET /backgrounds/history
  if (!bg) {
    try {
      const res = await fetch('https://api.momentumdash.com/backgrounds/history', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.history && data.history.length > 0) bg = data.history[0];
      }
    } catch (e) {}
  }

  if (!bg) return null;

  const uuid = bg._id || bg.id;
  const info = {
    title: bg.title || '',
    source: bg.source || bg.attribution || '',
    sourceUrl: bg.sourceUrl || '',
    uuid,
    isBuiltIn: !!bg.isBuiltIn,
  };

  // 云端图片：filename 就是公开 URL（Unsplash / Azure Blob 等）
  if (bg.filename && bg.filename.startsWith('http')) {
    return { url: bg.filename, ...info };
  }

  // 内置图片：尝试 momentum.photos CDN
  const candidates = [
    `https://momentum.photos/img/${uuid}.jpg`,
    `https://momentum.photos/images/${uuid}.jpg`,
    `https://momentum.photos/backgrounds/${uuid}.jpg`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return { url, ...info };
    } catch (e) {}
  }

  // CDN 上也没有，返回 fallback
  return { url: FALLBACK_URL, ...info, fallback: true };
}

function buildHtml(imageUrl, info) {
  const title = info.title || 'Momentum Daily Background';
  const credit = info.source ? `Photo by ${info.source}` : '';
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .info {
      position: fixed; bottom: 20px; left: 20px;
      background: rgba(0,0,0,0.5); color: #fff;
      padding: 12px 20px; border-radius: 10px;
      font-family: -apple-system, sans-serif; font-size: 14px;
      backdrop-filter: blur(8px); max-width: 400px;
    }
    .info .title { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    .info .credit { opacity: 0.8; font-size: 12px; }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="${title}" />
  <div class="info">
    <div class="title">${title}</div>
    ${credit ? `<div class="credit">${credit}</div>` : ''}
  </div>
</body>
</html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const format = url.searchParams.get('format');

    const photo = await fetchDailyPhoto(MOMENTUM_TOKEN);
    const imageUrl = photo ? photo.url : FALLBACK_URL;
    const info = photo || { title: 'Fallback', source: '' };

    // ?format=image → 代理返回图片二进制
    if (format === 'image') {
      try {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const headers = new Headers(imgRes.headers);
          headers.set('Cache-Control', 'public, max-age=86400');
          headers.set('Access-Control-Allow-Origin', '*');
          return new Response(imgRes.body, { status: 200, headers });
        }
        return new Response('Image not available', { status: imgRes.status });
      } catch (e) {
        return new Response('Failed to fetch image', { status: 502 });
      }
    }

    // ?format=json → 返回 JSON
    if (format === 'json') {
      const jsonOut = photo ? { ...photo } : { error: 'not found' };
      if (photo && photo.fallback) jsonOut.note = 'Built-in image not available on CDN, using fallback';
      return new Response(JSON.stringify(jsonOut), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 默认 → 返回 HTML 页面
    const html = buildHtml(imageUrl, info);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};
