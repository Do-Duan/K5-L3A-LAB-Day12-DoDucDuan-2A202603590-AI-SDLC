# Phase 2 spec and acceptance criteria

Source: user-provided Ticket-02. The pasted ticket omitted its “standard numbers” section. These are explicit temporary assumptions and must be reconciled if that section becomes available: carry capacity 10 (HUD contract), lantern cost 10 (HUD contract), dash 14 m/s for 0.2 s, dash cooldown 1.5 s, Night 2 duration 360 s, Night 3 duration 420 s. Night 1 values are retained from Phase 1. Score for a shade hit by pulse is set to the ticket's +5.

## Acceptance criteria

- [x] Contract version reports 1.1 and headless accepts night 1, 2, or 3.
- [x] Snapshot includes night, wind, movement/ability timers, motes, drifters, and charms.
- [x] Dash and pause inputs are edge triggered; pause freezes simulation timers and increments wall tick only.
- [x] Night-specific lantern counts/coordinates: 5, 6, and 7.
- [x] Charm pickup refreshes 600 ticks of speed bonus; respawn configured to 2700 ticks.
- [x] Drifter steal/drop events and states are represented in simulation.
- [x] Base night layouts, lantern coordinates, 60 Hz fixed stepping, jump/dash and pause support are represented in the simulation. Night 2 bridge/island and Night 3 terraces are represented in the renderer.
- [x] Intro screen, pause menu, retry, settings sliders persisted in local storage, and next-night link are present.
- [x] Scenario fixtures exercise dash, pause/resume, charm pickup, drifter steal/drop, and full-night runs. Outputs are committed under `tests/phase2/`.
- [x] Full headless runs completed at 18,000 ticks for Night 1 and 21,600 ticks for Nights 2 and 3; local wall time was 1.05–1.20 s per run, including Node/npm startup. These runs used the empty deterministic scenario.
- [ ] Exact walkable slopes/platform collision, all spawn-point and AI edge cases, full HUD cues/arrow, mouse camera sensitivity, all specified sound cues, and end-to-end campaign score persistence still need completion/review.
- [ ] Hidden Phase 1 regression and 30 FPS at 1280×720 have no recorded evidence; GUI measurement needs a browser/device run.

The unchecked criteria are known remaining work; no evidence is claimed for them.
