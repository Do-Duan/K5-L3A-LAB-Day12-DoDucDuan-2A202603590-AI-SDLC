// Phase 4 tests: leaderboard rules, bench scene/metrics, CLI export, soak smoke. Run: npm run test:phase4
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { addEntry, rank, validateName, normalizeEntry } from '../../scripts/leaderboard-core.mjs';
import { saveEntries, loadEntries, submit } from '../../scripts/leaderboard.mjs';
import { benchScenario, benchCamera, benchStats } from '../../src/bench';
import { Simulation } from '../../src/sim';
import contract from '../../game.contract.json' with { type: 'json' };

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('ok -', name); };
const e = (name: string, score: number, at = '2026-01-01T00:00:00+07:00', won = 1) => ({ name, score, nights_won: won, achieved_at: at, seed: 1 });
const root = process.cwd();

test('contract v1.3 has bench_cmd and soak_cmd; older keys kept', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.ok(contract.bench_cmd && contract.soak_cmd && contract.headless_cmd && contract.run_cmd && contract.build_cmd);
});

test('name validation: 3-12 of [A-Za-z0-9_] (+ Vietnamese letters)', () => {
  for (const ok of ['abc', 'Duan_01', '123456789012', 'Đức_Duẩn']) assert.equal(validateName(ok), null, ok);
  for (const bad of ['ab', '1234567890123', 'a b c', 'ab!', '', 'name-x', 'a\u0000bc']) assert.notEqual(validateName(bad), null, bad);
  assert.notEqual(validateName(42 as unknown), null);
});

test('entry validation: score/nights_won/seed/achieved_at', () => {
  assert.throws(() => normalizeEntry({ ...e('abc', -1) }));
  assert.throws(() => normalizeEntry({ ...e('abc', 1.5) }));
  assert.throws(() => normalizeEntry({ ...e('abc', 10, undefined, 4) }));
  assert.throws(() => normalizeEntry({ ...e('abc', 10), seed: 'x' }));
  const n = normalizeEntry({ ...e('abc', 10), achieved_at: 'garbage' });
  assert.match(n.achieved_at, /(Z|[+-]\d\d:\d\d)$/);
});

test('ranking: score desc, earlier achieved_at wins ties, top 10 only', () => {
  const r = rank([e('late', 100, '2026-01-02T00:00:00+07:00'), e('early', 100, '2026-01-01T00:00:00+07:00'), e('top', 500)]);
  assert.deepEqual(r.map(x => x.name), ['top', 'early', 'late']);
  let list: ReturnType<typeof rank> = [];
  for (let i = 0; i < 15; i++) list = addEntry(list, e(`p${String(i).padStart(2, '0')}`, i * 10, `2026-01-01T00:${String(i).padStart(2, '0')}:00+07:00`));
  assert.equal(list.length, 10);
  assert.equal(list[0].score, 140); assert.equal(list[9].score, 50);
});

test('ties across time zones compare real instants', () => {
  const r = rank([e('b', 10, '2026-01-01T10:00:00+07:00'), e('a', 10, '2026-01-01T04:00:00Z')]); // 03:00Z vs 04:00Z
  assert.deepEqual(r.map(x => x.name), ['b', 'a']);
});

test('equal score and equal time keep insertion order', () => {
  let l = addEntry([], e('first', 5)); l = addEntry(l, e('second', 5));
  assert.deepEqual(l.map(x => x.name), ['first', 'second']);
});

test('persistence survives a restart and corrupt rows are dropped', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lb-')); const file = join(dir, 'lb.json');
  try {
    submit(e('alpha', 50), file); submit(e('beta', 90), file);
    assert.deepEqual(loadEntries(file).map(x => x.name), ['beta', 'alpha']); // fresh read = "after restart"
    writeFileSync(file, JSON.stringify({ entries: [e('good', 5), { name: 'x', score: 'bad' }] }));
    assert.deepEqual(loadEntries(file).map(x => x.name), ['good']);
    writeFileSync(file, 'not json'); assert.deepEqual(loadEntries(file), []);
    assert.throws(() => submit(e('no', 5), file));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: npm run dev -- --export-leaderboard out.json writes {"entries": [...]} in order', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lb-')); const file = join(dir, 'lb.json'); const out = join(dir, 'out.json');
  try {
    saveEntries(rank([e('low', 10), e('high', 99)]), file);
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'run.mjs'), '--export-leaderboard', out], { env: { ...process.env, LEADERBOARD_FILE: file }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(readFileSync(out, 'utf8'));
    assert.deepEqual(Object.keys(j), ['entries']); assert.deepEqual(j.entries.map((x: { name: string }) => x.name), ['high', 'low']);
    assert.deepEqual(Object.keys(j.entries[0]).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('bench scene: 200 wandering shades, 100 motes, L1-L3 lit fuel 100, player at origin', () => {
  const sim = new Simulation(42, benchScenario(42), 1);
  assert.equal(sim.shades.length, 200); assert.ok(sim.shades.every(s => s.state === 'wander'));
  assert.equal(sim.motes.length, 100);
  assert.deepEqual(sim.lanterns.map(l => l.lit), [true, true, true, false, false]);
  assert.deepEqual(sim.snapshot().lanterns.slice(0, 3).map(l => l.fuel), [100, 100, 100]);
  assert.deepEqual(sim.player.pos, [0, 0, 0]);
  for (const s of sim.shades) assert.ok(Math.hypot(s.pos[0], s.pos[2]) <= 38 + 1e-6);
  assert.equal(JSON.stringify(benchScenario(42)), JSON.stringify(benchScenario(42))); // seeded
  assert.notEqual(JSON.stringify(benchScenario(42)), JSON.stringify(benchScenario(43)));
});

test('bench scene: no spawns, damage, pickups, fuel decay or night end', () => {
  const sim = new Simulation(42, benchScenario(42), 1);
  for (let i = 0; i < 20000; i++) sim.step({});
  assert.equal(sim.state, 'playing'); assert.equal(sim.player.flames, 3); assert.equal(sim.player.carried, 0);
  assert.equal(sim.shades.length, 200); assert.equal(sim.motes.length, 100);
  assert.deepEqual(sim.snapshot().lanterns.slice(0, 3).map(l => l.fuel), [100, 100, 100]);
  assert.deepEqual(sim.player.pos, [0, 0, 0]);
});

test('bench camera: radius 30, height 15, starts at (30,15,0), CCW, 15 s per lap', () => {
  assert.deepEqual(benchCamera(0), [30, 15, 0]);
  const q = benchCamera(3.75); // quarter lap: from +X towards -Z (CCW seen from above)
  assert.ok(Math.abs(q[0]) < 1e-9 && Math.abs(q[2] + 30) < 1e-9 && q[1] === 15);
  const full = benchCamera(15); assert.ok(Math.abs(full[0] - 30) < 1e-9 && Math.abs(full[2]) < 1e-9);
});

test('bench metrics follow the Ticket-04 definitions', () => {
  const s = benchStats(Array(100).fill(10)); // 100 fps flat
  assert.deepEqual([s.frames, s.avg_fps, s.p1_low_fps, s.frame_ms_p95], [100, 100, 100, 10]);
  const dts = [...Array(99).fill(10), 100]; // k = ceil(1) = 1 -> slowest frame
  const t = benchStats(dts);
  assert.equal(t.p1_low_fps, 10); assert.equal(t.avg_fps, +(1000 * 100 / 1090).toFixed(1));
  assert.equal(benchStats([20, 10]).p1_low_fps, 50); // k = max(1, ceil(0.02)) = 1
  const u = benchStats(Array.from({ length: 200 }, (_, i) => i + 1)); // k = 2 -> mean(199,200)
  assert.equal(u.p1_low_fps, +(1000 / 199.5).toFixed(1)); assert.equal(u.frame_ms_p95, 190);
});

test('soak smoke: 3 nights, deterministic JSON shape, thresholds met', () => {
  const dir = mkdtempSync(join(tmpdir(), 'soak-')); const out = join(dir, 'soak.json');
  try {
    const r = spawnSync(process.execPath, ['--expose-gc', '--import', 'tsx', join(root, 'scripts', 'soak.ts'), '--seed', '7', '--nights', '3', '--out', out], { encoding: 'utf8', cwd: root });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const j = JSON.parse(readFileSync(out, 'utf8'));
    assert.deepEqual(Object.keys(j), ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']);
    assert.equal(j.nights, 3); assert.equal(j.crashes, 0); assert.equal(j.results.length, 3);
    assert.ok(j.mem_end_mb <= 1.2 * j.mem_start_mb);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\n${passed} passed`);
