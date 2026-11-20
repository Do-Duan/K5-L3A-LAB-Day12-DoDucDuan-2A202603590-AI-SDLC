// Browser end-to-end checks (needs Chrome/Edge): npm run build && npm run test:e2e
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { startStaticServer } from '../../scripts/server.mjs';
import { exportLeaderboard } from '../../scripts/leaderboard.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const exe = [process.env.BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));
if (!exe) { console.log('skip: no browser found'); process.exit(0); }
const dir = mkdtempSync(join(tmpdir(), 'e2e-'));
const lb = join(dir, 'lb.json');
const server = await startStaticServer({ root: join(root, 'dist'), port: 0, file: lb });
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', defaultViewport: { width: 1280, height: 720 }, userDataDir: join(dir, 'profile') });
const wait = ms => new Promise(r => setTimeout(r, ms));
let n = 0;
const ok = m => console.log('ok -', m, '#' + ++n);
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base); await wait(500);

  assert.deepEqual(await page.$$eval('#menu button', b => b.map(x => x.textContent)), ['Chơi', 'Bảng xếp hạng', 'Cài đặt']); ok('main menu');

  // minimum font size >= 18px at 1280x720; x1.25 with large text
  const minFont = () => page.evaluate(() => Math.min(...[...document.querySelectorAll('.hud *, .hint, .screen:not(.hidden) *')]
    .filter(e => [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()))
    .map(e => parseFloat(getComputedStyle(e).fontSize))));
  assert.ok(await minFont() >= 18); ok('UI font >= 18px');
  await page.click('#m-settings'); await page.click('#large');
  assert.ok(await minFont() >= 22.5 - 0.01); ok('large text x1.25');
  await page.click('#large');

  // key rebinding: conflict reported and rejected, free key accepted + persisted, reset restores
  const keyBtn = async i => (await page.$$('.key-btn'))[i];
  const text = async i => (await keyBtn(i)).evaluate(e => e.textContent);
  await (await keyBtn(8)).click(); await page.keyboard.press('KeyW'); // jump slot 0 <- W (already "Đi lên")
  assert.match(await page.$eval('#key-msg', e => e.textContent), /đã được dùng cho "Đi lên"/);
  assert.equal(await text(8), 'Space'); ok('key conflict detected');
  await (await keyBtn(8)).click(); await page.keyboard.press('KeyJ');
  assert.equal(await text(8), 'J');
  await page.reload(); await page.click('#m-settings');
  assert.equal(await text(8), 'J'); ok('rebinding persisted');
  await page.click('#keys-reset');
  assert.equal(await text(8), 'Space'); ok('reset to defaults');
  await page.click('#settings-close');

  await page.click('#m-settings'); await page.click('#reduce'); await page.click('#cb');
  await page.reload();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('dao-settings')));
  assert.equal(s.reduceMotion, true); assert.equal(s.colorblind, true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--warn').trim()), '#FFFFFF'); ok('reduce-motion + colour palette persisted');

  // campaign -> loss -> name entry -> leaderboard on disk
  await page.click('#m-play'); await page.waitForSelector('#start', { visible: true }); await page.click('#start');
  await wait(300);
  await page.evaluate(() => { const s = window.__sim; s.player.flames = 0; s.finish('lost', 'no_flames'); });
  await page.waitForSelector('#name-form:not(.hidden)', { visible: true });
  await page.type('#name', 'ab'); await page.click('#name-save');
  assert.match(await page.$eval('#name-msg', e => e.textContent), /3–12/); ok('short name rejected');
  await page.$eval('#name', e => { e.value = ''; }); await page.type('#name', 'bad name!'); await page.click('#name-save');
  assert.match(await page.$eval('#name-msg', e => e.textContent), /chữ cái, số/); ok('invalid characters rejected');
  await page.$eval('#name', e => { e.value = ''; }); await page.type('#name', 'Duan_01'); await page.click('#name-save');
  await page.waitForSelector('#board:not(.hidden) table');
  const rows = await page.$$eval('#board tbody tr', r => r.map(x => x.textContent));
  assert.equal(rows.length, 1); assert.match(rows[0], /Duan_01/); ok('score saved + shown');
  const out = join(dir, 'out.json');
  exportLeaderboard(out, lb);
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(j.entries[0].name, 'Duan_01'); assert.equal(j.entries[0].nights_won, 0); assert.equal(j.entries[0].score, 0);
  assert.match(j.entries[0].achieved_at, /(Z|[+-]\d\d:\d\d)$/); ok('persisted on disk');

  // visual cue: shade spawn -> banner
  await page.goto(`${base}?night=1`); await page.click('#start'); await wait(300);
  await page.evaluate(() => { window.__sim.simTick = 299; });
  await wait(600);
  assert.match(await page.$eval('#cues', e => e.textContent), /Bóng Mực xuất hiện/); ok('shade-spawn cue');
  assert.deepEqual(errors, []); ok('no page errors');
} finally {
  await browser.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${n} e2e checks passed`);
