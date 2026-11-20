# Changelog

## v1.2 — Phase 3 "Đèn cạn dầu" (contract 1.2)

### Breaking changes
- **Win rule:** no early win on lighting all lanterns. Win = alive at dawn with `>= ceil(0.6*total)` lanterns lit (3/5, 4/6, 5/7). Reasons: `dawn_survived` (win), `dawn` / `no_flames` (lose). `all_lit` is no longer emitted.
- **Night length:** 240 / 270 / 300 s (was 300 / 360 / 360).
- **Lanterns decay** 1 fuel/s and go out at 0 (`lantern_out`, `deposited=0`, `ever_lit=true`). Lit was previously permanent.
- **Relight** costs 5 motes for an `ever_lit` lantern; first light still costs 10.
- **Interact** picks only receivable lanterns (unlit, or lit and not full): nearest, tie lower `id`. Lit lanterns are refuelled (`refuel` event).
- **Ink Shades** can enter lantern zones: new `drain` state; lanterns with `fuel<30` have no safe zone. Stun now ends in `wander` (was `chase`).
- **Capacity** is dynamic: `10 + 2*successful_lights` (max 20) instead of fixed 10.
- **Score** replaced: +5 per mote deposited/refuelled, +100 first light, +40 relight, +5 per stunned shade (+15 if it was draining), dawn win: `50+floor(fuel)` per lit lantern and +50 per remaining flame. Time bonus and old formulas removed; drifter-pulse +5 removed.
- **Snapshot:** lanterns add `fuel` (1 decimal, 0 when unlit), `ever_lit`, `relit_count`; `player` adds `capacity` (and `successful_lights`); shades add `target_lantern_id` and state `drain`.
- **Scenario:** lanterns accept `lit`, `fuel`, `ever_lit` (lit without fuel → 100); `player.successful_lights`; `shades[].target_lantern_id`.
- **Events:** new `refuel`, `lantern_out`, `fuel_drain` (every 60 ticks while draining); `lantern_lit` has `relight`.
- **Contract tuning** adds the Ticket-03 keys; `contract_version` = `"1.2"`.

### Added
- UI: fuel bars, 1 Hz low-fuel blink (<30), squashed/torn unlit lanterns, `carried / capacity` HUD, dawn objective, **"Bảng màu dễ phân biệt"** setting (persisted).
- Tests: `npm run test:phase3` (`tests/phase3/run.ts`, 22 cases). ADR: `docs/adr-003-fuel-and-dawn-win.md`.

### Test changes (old tests invalidated by the new rules)
- `tests/phase2/{dash,drifter,charm,pause}-output`, `determinism-a/b`, `full-night-1..3` **regenerated** with the new rules (durations, scoring and win rule changed; the drifter fixture's score changed 5 → 0).
- **Deleted** `tests/phase2/full-night.jsonl` and `phase2-night{1,2,3}.jsonl`: stale 300/360 s outputs under the old win rule, superseded by `full-night-{1,2,3}.jsonl` and the Phase 3 tests.
- `docs/phase-2-spec.md` criteria mentioning durations/scores are superseded by this changelog.
