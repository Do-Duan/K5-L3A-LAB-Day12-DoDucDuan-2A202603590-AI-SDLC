// Dev tool: captures README screenshots into docs/img (needs Chrome/Edge, see bench.mjs).
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { startStaticServer } from './server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exe = [process.env.BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));
if (!exe) throw new Error('No browser found; set BROWSER_PATH');
const dir = join(root, 'docs', 'img'); mkdirSync(dir, { recursive: true });
const lbFile = join(root, 'bench-profile', 'shot-lb.json'); process.env.LEADERBOARD_FILE = lbFile;
const server = await startStaticServer({ root: join(root, 'dist'), port: 0, file: lbFile });
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: exe, headless: false, defaultViewport: { width: 1280, height: 720 }, args: ['--window-size=1280,800'] });
try {
  const page = (await browser.pages())[0];
  await page.goto(base, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: join(dir, 'menu.png') });
  await page.goto(`${base}?night=1`, { waitUntil: 'load' });
  await page.click('#start'); await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: join(dir, 'gameplay.png') });
  await page.goto(`${base}?bench=1&seed=42&duration=600`, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 6000));
  await page.screenshot({ path: join(dir, 'bench-scene.png') });
  await page.goto(base, { waitUntil: 'load' }); await page.click('#m-settings'); await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: join(dir, 'settings.png') });
} finally { await browser.close(); server.close(); rmSync(join(root, 'bench-profile'), { recursive: true, force: true }); }
