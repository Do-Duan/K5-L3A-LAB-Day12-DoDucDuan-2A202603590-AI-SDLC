# Phase 3 verification evidence

Contract version: 1.2. Results generated with seed 1 for feature scenarios and seed 8 for full-night timing.

| Requirement | Scenario/output | Observed result |
|---|---|---|
| First light, fuel, score, capacity | `tests/phase3/light-*` | `lantern_lit relight:false`, score 150, capacity grows from 10 to 12 |
| Refuel formula and event | `tests/phase3/refuel-*` | 95 fuel plus one mote becomes 100; `refuel` amount 10; score +5 |
| Relight cost and bonus | `tests/phase3/relight-*` | Five motes relight; `relight:true`; score 65 |
| Fuel decay + shade drain | `tests/phase3/drain-*` | At tick 60 `fuel_drain` records fuel 23.1 from 29 initial fuel |
| Extinguish | `tests/phase3/extinguish-*` | `lantern_out` at tick 1 for a 0.02-fuel lamp |
| Dawn threshold win/loss | `tests/phase3/win-*`, `loss-*` | Three of five wins with `dawn_survived`; two of five loses with `dawn` |
| Zero flames takes precedence | `tests/phase3/no-flames-*` | `game_over` reason `no_flames` before dawn resolution |
| Pulse score while draining | `tests/phase3/drain-pulse-*` | Score +15 and shade enters stunned |
| Runtime ceiling | `tests/phase3/full-night-{1,2,3}.jsonl` | 14,400 / 16,200 / 18,000 ticks; 1.15 / 1.01 / 0.98 s local wall time including npm startup |

`npm.cmd run build` passed. These are local headless checks; no browser FPS measurement or hidden Phase 1/2 grader suite is available in the repo.
