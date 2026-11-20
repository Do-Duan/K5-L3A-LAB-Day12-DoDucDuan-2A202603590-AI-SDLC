// bench_cmd: npm run bench -- --seed 42 --duration 30 --out bench.json
// Opens the real game in a 1280x720 (non-fullscreen) browser window, runs the Ticket-04 benchmark scene
// and writes bench.json. Needs Chrome/Edge/Chromium (set BROWSER_PATH to override).
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import puppeteer from 'puppeteer-core';
import { parseArgs, intArg } from './args.mjs';
import { startStaticServer } from './server.mjs';

const T_START = Date.now(); // "process start" for load_ms
const args = parseArgs();
const seed = intArg(args, 'seed', 42), duration = intArg(args, 'duration', 30);
const out = typeof args.out === 'string' ? args.out : 'bench.json';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = '1.3';

function findBrowser() {
  const c = [process.env.BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find(p => p && existsSync(p));
}

/** Sum of resident memory (MB) of every process whose command line contains `marker` (our private profile dir). */
function treeRssMb(marker) {
  try {
    if (process.platform === 'win32') {
      const ps = `$m='${marker.replace(/'/g, "''")}'; (Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($m) } | Measure-Object -Property WorkingSetSize -Sum).Sum`;
      const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
      const v = Number(String(r.stdout).trim());
      return Number.isFinite(v) && v > 0 ? v / 1048576 : null;
    }
    const r = spawnSync('ps', ['-eo', 'rss,args'], { encoding: 'utf8' });
    const kb = String(r.stdout).split('\n').filter(l => l.includes(marker)).reduce((a, l) => a + (parseInt(l.trim(), 10) || 0), 0);
    return kb ? kb / 1024 : null;
  } catch { return null; }
}

if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.log('dist/ missing, building...');
  const b = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (b.status !== 0) { console.error('build failed'); process.exit(1); }
}
const exe = findBrowser();
if (!exe) { console.error('No Chrome/Edge/Chromium found. Set BROWSER_PATH.'); process.exit(1); }

const server = await startStaticServer({ root: join(root, 'dist'), port: 0 });
const port = server.address().port;
const profile = join(root, 'bench-profile', String(process.pid));
mkdirSync(profile, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: exe, headless: false, defaultViewport: { width: 1280, height: 720 }, userDataDir: profile,
  args: ['--window-size=1280,800', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
let peak = 0, sampler = null;
try {
  const page = (await browser.pages())[0] ?? await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}`, { waitUntil: 'load' });
  sampler = setInterval(() => { const m = treeRssMb(profile); if (m && m > peak) peak = m; }, 1500);
  await page.waitForFunction('window.__bench && window.__bench.done', { timeout: (duration + 60) * 1000, polling: 500 });
  const r = await page.evaluate('window.__bench');
  const version = await browser.version();
  const peakNow = treeRssMb(profile); if (peakNow && peakNow > peak) peak = peakNow;
  const report = {
    contract_version: CONTRACT,
    avg_fps: r.avg_fps, p1_low_fps: r.p1_low_fps, frame_ms_p95: r.frame_ms_p95, frames: r.frames,
    load_ms: Math.max(0, r.first_frame_epoch_ms - T_START),
    peak_mem_mb: peak ? Math.round(peak) : null,
    vsync_off: true, // --disable-frame-rate-limit --disable-gpu-vsync (verify: avg_fps above the display refresh rate)
    renderer: `Three.js ${r.three_revision} / ${r.gl_renderer} / ${version}`,
    os: `${os.type()} ${os.release()} (${os.arch()}), ${os.cpus()[0]?.model?.trim()}, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`,
  };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (sampler) clearInterval(sampler);
  await browser.close().catch(() => {});
  server.close();
  try { rmSync(join(root, 'bench-profile'), { recursive: true, force: true }); } catch { /* ignore */ }
}
process.exit(0);
