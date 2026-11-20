// Soak test (Ticket-04 §2): N consecutive headless Nights in one process.
// Usage: npm run soak -- --seed 7 --nights 10 --out soak.json
import { writeFileSync } from 'node:fs';
import { Simulation, type InputFrame } from '../src/sim';
import { parseArgs, intArg } from './args.mjs';

const args = parseArgs();
const seed = intArg(args, 'seed', 7), nights = intArg(args, 'nights', 10);
const idle = args.idle === true; // stress variant: no input, so Nights tend to run longer
const out = typeof args.out === 'string' ? args.out : 'soak.json';
if (!Number.isInteger(nights) || nights < 1) throw new Error('--nights must be a positive integer');

const rssMb = () => Math.round(process.memoryUsage().rss / 1048576);
const gc = (globalThis as { gc?: () => void }).gc;
const settle = () => { gc?.(); gc?.(); };

/** Small seeded PRNG (mulberry32) so the random input stream is reproducible. */
function rng(s: number) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const t0 = Date.now();
const results: string[] = [];
let crashes = 0, memStart = 0, totalTicks = 0;
const durations: Record<number, number> = { 1: 240, 2: 270, 3: 300 };

for (let i = 1; i <= nights; i++) {
  const night = ((i - 1) % 3) + 1;
  try {
    let sim: Simulation | null = new Simulation(seed + i, {}, night);
    if (i === 1) { settle(); memStart = rssMb(); }
    const rand = rng(seed + i);
    const maxTicks = durations[night] * 60;
    let move: [number, number] = [0, 0];
    for (let k = 0; k < maxTicks && sim.state === 'playing'; k++) {
      if (k % 30 === 0) move = [rand() * 2 - 1, rand() * 2 - 1];
      const input: Partial<InputFrame> = idle ? {} : { move, jump: rand() < 0.05, dash: rand() < 0.03, pulse: rand() < 0.02, interact: rand() < 0.10 };
      sim.step(input);
      sim.takeEvents(); // drain like the headless runner does
      sim.snapshot();   // exercise snapshot allocation too
      totalTicks++;
    }
    results.push(sim.state === 'playing' ? 'lost' : sim.state);
    sim = null; // "reset": drop the finished Night before the next one is built
  } catch (e) {
    crashes++; results.push('crash');
    console.error(`night ${i} crashed:`, (e as Error).message);
  }
}
settle();
const report = { nights, crashes, results, mem_start_mb: memStart, mem_end_mb: rssMb(), duration_s: +((Date.now() - t0) / 1000).toFixed(1) };
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report), `(${totalTicks} ticks simulated${idle ? ', idle input' : ''})`);
const pass = crashes === 0 && report.mem_end_mb <= 1.2 * report.mem_start_mb;
if (!pass) { console.error('SOAK THRESHOLD NOT MET'); process.exitCode = 1; }
