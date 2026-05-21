const fs = require('fs');
const path = require('path');

const EXTENSION_ID = 'laookkfknpbbblfpciffpaejjkokdgca';
const EXTENSION_BASE = path.join(
  process.env.LOCALAPPDATA,
  'Google', 'Chrome', 'User Data', 'Default', 'Extensions', EXTENSION_ID
);

function main() {
  // 1. Find the extension version directory
  const versionDir = findLatestVersionDir(EXTENSION_BASE);
  if (!versionDir) {
    console.error('Momentum extension not found at:', EXTENSION_BASE);
    process.exit(1);
  }
  console.log('Extension directory:', versionDir);

  // 2. Read backgrounds.json
  const bgJsonPath = path.join(versionDir, 'backgrounds', 'backgrounds.json');
  if (!fs.existsSync(bgJsonPath)) {
    console.error('backgrounds.json not found at:', bgJsonPath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(bgJsonPath, 'utf-8'));
  const backgrounds = data.backgrounds;
  console.log('Total backgrounds:', backgrounds.length);

  // 3. Compute today's index
  const epoch = new Date(2012, 0, 1);
  const daysSinceEpoch = Math.floor((Date.now() - epoch.getTime()) / 86400000);
  const index = daysSinceEpoch % backgrounds.length;
  console.log('Days since 2012-01-01:', daysSinceEpoch);
  console.log('Today index:', index);

  // 4. Get today's background
  const todayBg = backgrounds[index];
  console.log('');
  console.log('Title:   ', todayBg.title);
  console.log('Source:  ', todayBg.source);
  console.log('Source URL:', todayBg.sourceUrl);

  // 5. Copy the image
  const srcPath = path.join(versionDir, todayBg.filename);
  if (!fs.existsSync(srcPath)) {
    console.error('Background image not found:', srcPath);
    process.exit(1);
  }

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const safeTitle = todayBg.title
    .replace(/[^a-zA-Z0-9一-鿿\s-]/g, '')
    .replace(/\s+/g, '-');
  const filename = `${dateStr}-${safeTitle}.jpg`;
  const destPath = path.join(outputDir, filename);

  fs.copyFileSync(srcPath, destPath);
  const stats = fs.statSync(destPath);
  console.log('');
  console.log('Image saved:', destPath);
  console.log('File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
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
