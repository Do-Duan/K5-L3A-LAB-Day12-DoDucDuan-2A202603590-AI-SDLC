import type { Scenario, V3 } from './sim';

/** Seeded PRNG (mulberry32), shared by the benchmark scene and tests. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const BENCH = { shades: 200, motes: 100, warmup_s: 3, camera_radius: 30, camera_height: 15, orbit_period_s: 15, island_radius: 38 } as const;

/** Uniform random point on the Night 1 island (area-uniform disc). */
function onIsland(rand: () => number, radius: number): V3 {
  const r = radius * Math.sqrt(rand()), a = rand() * Math.PI * 2;
  return [+(Math.cos(a) * r).toFixed(3), 0, +(Math.sin(a) * r).toFixed(3)];
}

/** Ticket-04 §1 benchmark scene: 200 wandering shades, 100 motes, L1-L3 lit at fuel 100, Mây at the origin. */
export function benchScenario(seed: number): Scenario {
  const rand = mulberry32(seed);
  return {
    bench: true,
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { pos: [0, 0, 0], carried: 0 },
    motes: Array.from({ length: BENCH.motes }, () => onIsland(rand, BENCH.island_radius)),
    shades: Array.from({ length: BENCH.shades }, (_, i) => ({ id: `S${i + 1}`, pos: onIsland(rand, BENCH.island_radius), state: 'wander' })),
    lanterns: ['L1', 'L2', 'L3'].map(id => ({ id, lit: true, fuel: 100, ever_lit: true })),
  };
}

/** Camera on a circle around the origin, CCW seen from above, starting at (30,15,0). */
export function benchCamera(tSeconds: number): V3 {
  const ang = (tSeconds / BENCH.orbit_period_s) * Math.PI * 2;
  // seen from above (+Y), x->z... CCW from +X toward -Z in a right-handed Y-up frame.
  return [BENCH.camera_radius * Math.cos(ang), BENCH.camera_height, -BENCH.camera_radius * Math.sin(ang) + 0];
}

/** Metrics exactly as defined in Ticket-04 §1 from per-frame dt in ms. */
export function benchStats(dts: number[]) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const p95Idx = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
  return {
    frames: n,
    avg_fps: n ? +(1000 * n / sum).toFixed(1) : 0,
    p1_low_fps: n ? +(1000 / (worst.reduce((a, b) => a + b, 0) / k)).toFixed(1) : 0,
    frame_ms_p95: n ? +sorted[p95Idx].toFixed(1) : 0,
  };
}
