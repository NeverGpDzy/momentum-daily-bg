const fs = require('fs');
const path = require('path');

const EXTENSION_ID = 'laookkfknpbbblfpciffpaejjkokdgca';
const CHROME_DATA = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Default');
const EXTENSION_BASE = path.join(CHROME_DATA, 'Extensions', EXTENSION_ID);
const SW_CACHE_BASE = path.join(CHROME_DATA, 'Service Worker', 'CacheStorage');

function main() {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const dateStr = new Date().toISOString().split('T')[0];

  // Method 1: Extract from Chrome service worker cache (real daily image)
  const cached = extractLatestCachedBg(outputDir, dateStr);
  if (cached) {
    console.log('Source: Chrome Service Worker cache (Momentum API)');
    console.log('Image saved:', cached.path);
    console.log('Image URL:', cached.url || '(not found)');
    const stats = fs.statSync(cached.path);
    console.log('File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    return;
  }

  // Method 2: Fall back to local 24-image rotation
  console.log('Cache extraction failed, falling back to local rotation...');
  const localPath = extractLocalBg(outputDir, dateStr);
  if (localPath) {
    console.log('Source: Local extension backgrounds');
    console.log('Image saved:', localPath);
    const stats = fs.statSync(localPath);
    console.log('File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    return;
  }

  console.error('Failed to fetch background image.');
  process.exit(1);
}

// Extract most recent JPEG from Chrome service worker cache
function extractLatestCachedBg(outputDir, dateStr) {
  if (!fs.existsSync(SW_CACHE_BASE)) return null;

  // Find cache directories
  let newestJpeg = null;
  let newestTime = 0;

  function scanDir(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('_0')) {
        const stats = fs.statSync(fullPath);
        if (stats.mtimeMs > newestTime) {
          newestTime = stats.mtimeMs;
          newestJpeg = { path: fullPath, mtime: stats.mtime };
        }
      }
    }
  }

  // Only scan the Momentum extension's cache (hash: 1c66fe3c418d821685633f04ffddf419f5d63d9b)
  const momentumCache = '1c66fe3c418d821685633f04ffddf419f5d63d9b';
  const cacheDir = path.join(SW_CACHE_BASE, momentumCache);
  if (fs.existsSync(cacheDir)) scanDir(cacheDir);

  if (!newestJpeg) return null;

  // Extract JPEG data and image URL from the cache file
  const buf = fs.readFileSync(newestJpeg.path);
  let jpegStart = -1;
  for (let i = 0; i < Math.min(2000, buf.length - 2); i++) {
    if (buf[i] === 0xFF && buf[i + 1] === 0xD8 && buf[i + 2] === 0xFF) {
      jpegStart = i;
      break;
    }
  }

  if (jpegStart < 0) return null;

  // Extract image URL from cache file text
  const text = buf.toString('utf-8');
  const urlMatch = text.match(/https:\/\/momentum\.photos\/img\/[a-f0-9-]+\.jpg/i)
    || text.match(/https:\/\/images\.unsplash\.com\/[^\x00\x01-\x1f\s"<>]+/i)
    || text.match(/https:\/\/farm\d+\.staticflickr\.com\/[^\x00\x01-\x1f\s"<>]+\.jpg/i);
  const imageUrl = urlMatch ? urlMatch[0].replace(/[P\s]+$/, '') : null;

  const jpegData = buf.slice(jpegStart);
  const filename = `${dateStr}-daily.jpg`;
  const destPath = path.join(outputDir, filename);
  fs.writeFileSync(destPath, jpegData);

  console.log('Cache date:', newestJpeg.mtime.toISOString().split('T')[0]);
  return { path: destPath, url: imageUrl };
}

// Fall back to local 24-image daily rotation
function extractLocalBg(outputDir, dateStr) {
  const versionDir = findLatestVersionDir(EXTENSION_BASE);
  if (!versionDir) return null;

  const bgJsonPath = path.join(versionDir, 'backgrounds', 'backgrounds.json');
  if (!fs.existsSync(bgJsonPath)) return null;

  const data = JSON.parse(fs.readFileSync(bgJsonPath, 'utf-8'));
  const backgrounds = data.backgrounds;

  const epoch = new Date(2012, 0, 1);
  const daysSinceEpoch = Math.floor((Date.now() - epoch.getTime()) / 86400000);
  const index = daysSinceEpoch % backgrounds.length;
  const todayBg = backgrounds[index];

  console.log('Title:   ', todayBg.title);
  console.log('Source:  ', todayBg.source);
  console.log('Source URL:', todayBg.sourceUrl);

  const srcPath = path.join(versionDir, todayBg.filename);
  if (!fs.existsSync(srcPath)) return null;

  const safeTitle = todayBg.title.replace(/[^a-zA-Z0-9一-鿿\s-]/g, '').replace(/\s+/g, '-');
  const filename = `${dateStr}-${safeTitle}.jpg`;
  const destPath = path.join(outputDir, filename);
  fs.copyFileSync(srcPath, destPath);
  return destPath;
}

function findLatestVersionDir(baseDir) {
  if (!fs.existsSync(baseDir)) return null;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const versionDirs = entries
    .filter(e => e.isDirectory())
    .map(e => ({ name: e.name, path: path.join(baseDir, e.name) }))
    .filter(d => fs.existsSync(path.join(d.path, 'backgrounds', 'backgrounds.json')))
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  return versionDirs.length > 0 ? versionDirs[0].path : null;
}

main();
