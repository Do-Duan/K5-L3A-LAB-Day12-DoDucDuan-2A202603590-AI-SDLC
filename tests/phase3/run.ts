// Phase 3 rule tests. Run: npm run test:phase3
import assert from 'node:assert/strict';
import { Simulation, type Scenario } from '../../src/sim';

const base: Scenario = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [] };
const mk = (s: Scenario, night = 1) => new Simulation(1, { ...base, ...s }, night);
const run = (sim: Simulation, n: number, input: Record<string, unknown> = {}) => { for (let i = 0; i < n; i++) sim.step(input); };
const press = (sim: Simulation, input: Record<string, unknown> = {}) => { sim.step({ ...input, interact: true }); sim.step({ ...input, interact: false }); };
const lit = (id: string, fuel?: number, extra: object = {}) => ({ id, lit: true, ...(fuel === undefined ? {} : { fuel }), ...extra });
const P = { pos: [0, 0, 24] as [number, number, number] };
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('ok -', name); };
const names = (sim: Simulation) => sim.takeEvents().map(e => e.name);

import contract from '../../game.contract.json' with { type: 'json' };
test('contract fields', () => {
  assert.equal(contract.contract_version, '1.2');
  const t = contract.tuning;
  assert.deepEqual([t.fuel_max, t.fuel_decay_per_s, t.fuel_per_mote, t.relight_cost, t.win_ratio, t.drain_per_s, t.low_fuel_threshold, t.capacity_max], [100, 1, 10, 5, 0.6, 5, 30, 20]);
  assert.deepEqual([t.night1_duration_s, t.night2_duration_s, t.night3_duration_s], [240, 270, 300]);
});

test('lit without fuel defaults to 100; unlit snapshot fuel is 0', () => {
  const s = mk({ lanterns: [{ id: 'L1', lit: true }] }).snapshot();
  assert.equal(s.lanterns[0].fuel, 100); assert.equal(s.lanterns[0].ever_lit, true);
  assert.equal(s.lanterns[1].fuel, 0); assert.equal(s.lanterns[1].ever_lit, false);
});

test('decay is 1 unit/s (1/60 per tick), no float drift', () => {
  const sim = mk({ lanterns: [lit('L1')] }); run(sim, 600);
  assert.equal(sim.snapshot().lanterns[0].fuel, 90);
});

test('refuel formula: used=min(carried,ceil((100-fuel)/10)), no overfill', () => {
  const sim = mk({ player: { ...P, carried: 10 }, lanterns: [lit('L1', 55)] }); press(sim);
  const ev = sim.takeEvents().find(e => e.name === 'refuel')!;
  assert.equal((ev.data as any).amount, 5); assert.equal(sim.player.carried, 5);
  assert.ok(sim.snapshot().lanterns[0].fuel <= 100);
  assert.equal(sim.score, 25);
});

test('refuel limited by carried', () => {
  const sim = mk({ player: { ...P, carried: 2 }, lanterns: [lit('L1', 20)] }); press(sim);
  assert.equal(sim.player.carried, 0);
  assert.ok(Math.abs(sim.snapshot().lanterns[0].fuel - 40) < 0.2);
});

test('full lantern is not selected, no event, no score', () => {
  const sim = mk({ player: { ...P, carried: 5 }, lanterns: [lit('L1', 100)] }); press(sim);
  assert.ok(!names(sim).includes('refuel')); assert.equal(sim.player.carried, 5); assert.equal(sim.score, 0);
});

test('selection skips full lantern and takes the receivable one', () => {
  const sim = mk({ player: { pos: [12, 0, 25], carried: 10 }, lanterns: [lit('L1', 100), { id: 'L2', pos: [14, 0, 25], lit: false }] }); press(sim);
  assert.equal(sim.player.carried, 0); assert.equal(sim.lanterns[1].lit, true);
});

test('first light: cost 10, +100, +5 per mote, relight=false, fuel 100', () => {
  const sim = mk({ player: { ...P, carried: 10 } }); press(sim);
  const ev = sim.takeEvents().find(e => e.name === 'lantern_lit')!;
  assert.equal((ev.data as any).relight, false);
  assert.equal(sim.score, 150); assert.equal(sim.snapshot().lanterns[0].fuel, 100);
});

test('lantern goes out at fuel<=0, deposited=0, event, ever_lit kept; relight costs 5, +40', () => {
  const sim = mk({ player: { ...P }, lanterns: [lit('L1', 0.05)] }); run(sim, 3);
  const l = sim.snapshot().lanterns[0];
  assert.equal(l.lit, false); assert.equal(l.deposited, 0); assert.equal(l.ever_lit, true); assert.equal(l.fuel, 0);
  assert.ok(names(sim).includes('lantern_out'));
  sim.player.carried = 5; sim.score = 0; press(sim);
  const ev = sim.takeEvents().find(e => e.name === 'lantern_lit')!;
  assert.equal((ev.data as any).relight, true); assert.equal(sim.score, 25 + 40);
  assert.equal(sim.snapshot().lanterns[0].relit_count, 1);
});

test('capacity = 10 + 2*successful_lights, max 20', () => {
  const sim = mk({ player: { ...P, successful_lights: 3 } }); assert.equal(sim.snapshot().player.capacity, 16);
  assert.equal(mk({ player: { ...P, successful_lights: 9 } }).snapshot().player.capacity, 20);
  const s2 = mk({ player: { ...P, carried: 10 } }); press(s2); assert.equal(s2.snapshot().player.capacity, 12);
});

test('shade: fuel 30 keeps safe zone, 29.9 loses it; wander shade targets weak lantern then drains 5/s', () => {
  const sim = mk({ player: { pos: [40, 0, -40] }, lanterns: [lit('L1', 29), lit('L2', 100)], shades: [{ id: 'S1', pos: [0, 0, 27], state: 'wander' }] });
  run(sim, 2); assert.equal(sim.shades[0].state, 'drain'); assert.equal(sim.shades[0].target, 'L1');
  const f0 = sim.snapshot().lanterns[0].fuel; run(sim, 58);
  const drop = f0 - sim.snapshot().lanterns[0].fuel;
  assert.ok(Math.abs(drop - 58 * 6 / 60) < 0.15, `drop ${drop}`);
  run(sim, 4); assert.ok(names(sim).includes('fuel_drain'));
});

test('drain -> stunned by pulse gives 15 points', () => {
  const sim = mk({ player: { pos: [0, 0, 22], flames: 3 }, lanterns: [lit('L1', 20)], shades: [{ id: 'S1', pos: [0, 0, 26], state: 'drain', target_lantern_id: 'L1' }] });
  sim.step({ pulse: true });
  assert.equal(sim.shades[0].state, 'stunned'); assert.equal(sim.score, 15);
});

test('drain -> chase when the player comes within 6 m', () => {
  const sim = mk({ player: { pos: [0, 0, 21.5] }, lanterns: [lit('L1', 20)], shades: [{ id: 'S1', pos: [0, 0, 26], state: 'drain', target_lantern_id: 'L1' }] });
  sim.step({}); assert.equal(sim.shades[0].state, 'chase');
});

test('refuel crossing 30 pushes shades within 6 m to the 6 m edge for <=30 ticks with no damage', () => {
  const sim = mk({ player: { pos: [0, 0, 24], carried: 5, flames: 3 }, lanterns: [lit('L1', 25)], shades: [{ id: 'S1', pos: [0, 0, 24.5], state: 'chase' }] });
  sim.step({ interact: true });
  assert.ok(sim.snapshot().lanterns[0].fuel >= 30);
  run(sim, 29);
  assert.equal(sim.player.flames, 3);
  assert.ok(Math.hypot(sim.shades[0].pos[0], sim.shades[0].pos[2] - 25) >= 6 - 1e-6);
});

test('drain -> wander when lantern goes out', () => {
  const sim = mk({ player: { pos: [40, 0, -40] }, lanterns: [lit('L1', 0.1)], shades: [{ id: 'S1', pos: [0, 0, 26], state: 'drain', target_lantern_id: 'L1' }] });
  run(sim, 3); assert.equal(sim.shades[0].state, 'wander');
});

test('no early win when all lit; win at dawn with threshold; dawn_survived + bonus', () => {
  const all = ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => lit(id));
  const sim = mk({ lanterns: all, time_left_s: 1 });
  run(sim, 59); assert.equal(sim.state, 'playing');
  sim.step({}); assert.equal(sim.state, 'won');
  const over = sim.takeEvents().find(e => e.name === 'game_over')!;
  assert.equal((over.data as any).reason, 'dawn_survived');
  // fuel 100 -60 ticks of decay => 99 (floor 99): 5*(50+99) + 3*50
  assert.equal(sim.score, 5 * 149 + 150);
});

test('night thresholds 3/5, 4/6, 5/7', () => {
  const need = (n: number, count: number) => { const sim = mk({ lanterns: Array.from({ length: count }, (_, i) => lit(`L${i + 1}`)), time_left_s: 1 / 60 }, n); sim.step({}); return sim.state; };
  assert.equal(need(1, 3), 'won'); assert.equal(need(1, 2), 'lost');
  assert.equal(need(2, 4), 'won'); assert.equal(need(2, 3), 'lost');
  assert.equal(need(3, 5), 'won'); assert.equal(need(3, 4), 'lost');
});

test('lose at dawn with too few lanterns: reason dawn, no bonus', () => {
  const sim = mk({ lanterns: [lit('L1')], time_left_s: 1 / 60 }); sim.step({});
  assert.equal(sim.state, 'lost'); assert.equal((sim.takeEvents().pop()!.data as any).reason, 'dawn'); assert.equal(sim.score, 0);
});

test('last-tick lantern out counts against the threshold', () => {
  const sim = mk({ lanterns: [lit('L1'), lit('L2'), lit('L3', 1 / 60)], time_left_s: 1 / 60 }); sim.step({});
  assert.equal(sim.state, 'lost');
});

test('no_flames beats dawn on the final tick', () => {
  const all = ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => lit(id));
  const sim = mk({ player: { pos: [0, 0, 0], flames: 1 }, lanterns: all, time_left_s: 1 / 60, shades: [{ id: 'S1', pos: [0, 0, 0.5], state: 'chase' }] }); sim.step({});
  assert.equal(sim.state, 'lost'); assert.equal((sim.takeEvents().pop()!.data as any).reason, 'no_flames');
});

test('durations 240/270/300', () => {
  assert.equal(new Simulation(1, base, 1).time, 240); assert.equal(new Simulation(1, base, 2).time, 270); assert.equal(new Simulation(1, base, 3).time, 300);
});

test('full-night headless-style run stays deterministic', () => {
  const a = new Simulation(7, {}, 1), b = new Simulation(7, {}, 1);
  for (let i = 0; i < 14400 && a.state === 'playing'; i++) { a.step({}); b.step({}); }
  assert.equal(JSON.stringify(a.snapshot()), JSON.stringify(b.snapshot()));
  assert.equal(a.state, 'lost');
});
console.log(`\n${passed} passed`);
