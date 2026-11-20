# Changelog

Mỗi mục tương ứng một phase (tag `phase-N`). Phase 4 là bản phát hành `v1.0.0`.

## Phase 4 — "Bình minh", release v1.0.0 (contract 1.3)

### Added
- **Chế độ benchmark** (`npm run bench -- --seed 42 --duration 30 --out bench.json`): cảnh chuẩn 1280×720 (Đêm 1, 200 Bóng Mực `wander`, 100 đom đóm, `L1–L3` sáng fuel 100, camera bay vòng R=30 m / Y=15 m / 15 s), khởi động 3 s, xuất `bench.json` đúng schema. Cảnh bench tắt spawn, sát thương, nhặt đom đóm, hao dầu và kết thúc Đêm (`Scenario.bench`).
- **Soak test** (`npm run soak -- --seed 7 --nights 10 --out soak.json`): 10 Đêm liên tiếp (1→2→3 xoay vòng, seed `7+i`) với input ngẫu nhiên có seed; kiểm `crashes = 0` và `mem_end ≤ 1.2 × mem_start`.
- **Bảng xếp hạng cục bộ**: nhập tên 3–12 ký tự `[A-Za-z0-9_]` (chữ Việt có dấu cũng được), top 10, bằng điểm thì ai đạt trước đứng trên, lưu ra đĩa (`data/leaderboard.json`, hoặc localStorage nếu không có server), màn hình xếp hạng từ menu chính, xuất bằng `npm run dev -- --export-leaderboard out.json`.
- **Chiến dịch** Đêm 1→2→3: điểm xếp hạng = tổng điểm các Đêm đã thắng; menu chính (Chơi / Bảng xếp hạng / Cài đặt).
- **Dễ tiếp cận**: đổi phím mọi hành động (2 ô/hành động, phát hiện trùng, "Khôi phục mặc định", được lưu); chỉ báo hình ảnh/phụ đề (Bóng Mực xuất hiện + mũi tên ở mép màn hình, gió sắp thổi, 10 s cuối, đèn `fuel < 30`, đèn tắt); "Giảm chuyển động" (tắt rung camera và chớp màn hình; mặc định theo `prefers-reduced-motion`); chữ ≥ 18 px ở 1280×720 và tùy chọn chữ lớn ×1.25.
- **Đóng gói**: `npm start` (phục vụ `dist/` + API xếp hạng), `npm run package` tạo `release/dao-den-long-v1.0.0-web.zip`; `README`, `CREDITS.md`, `LICENSE`, `AGENTS.md`.
- Test: `tests/phase4/run.ts` (13 ca: luật xếp hạng, CLI xuất, cảnh/camera/chỉ số bench, soak) và `tests/phase4/e2e.mjs` (13 kiểm tra trên trình duyệt thật). `npm test` chạy Phase 3 + 4.

### Changed
- `game.contract.json`: `contract_version` `"1.3"`, thêm `bench_cmd`, `soak_cmd`. Mọi yêu cầu v1.0–v1.2 và đầu ra headless **không đổi**.
- `npm run dev` giờ chạy `scripts/run.mjs` (Vite + API xếp hạng; hỗ trợ `--export-leaderboard`).
- Renderer: vật liệu/hình học Bóng Mực dùng chung, vật liệu đèn tạo một lần (trước đây tạo mới mỗi khung hình), đom đóm tạo theo số lượng thực tế; sự kiện của mô phỏng được lấy ra mỗi khung (không còn tích lũy vô hạn).
- `main.ts` được tách module (`settings`, `campaign`, `leaderboard`, `bench`).

### Notes
- Không có thay đổi luật chơi nào ở phase này.

## Phase 3 — v1.2 "Đèn cạn dầu" (contract 1.2)

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

## Phase 2 — v1.1

- Nhảy, lướt (14 m/s trong 0,2 s, hồi 1,5 s), tạm dừng (đóng băng bộ đếm mô phỏng), Đêm 2 (hai đảo + cầu) và Đêm 3 (bậc thang + tháp, gió), bùa tốc độ (600 tick), Gió Lạc (Drifter) cướp/rơi đom đóm.
- Snapshot thêm `night`, `wind`, bộ đếm kỹ năng, `motes`, `drifters`, `charms`; headless nhận `--night 1|2|3`.
- Menu intro/tạm dừng/cài đặt (âm lượng, độ nhạy, lưu localStorage), chơi lại, sang đêm tiếp theo.
- Giả định và tiêu chí chấp nhận: `docs/phase-2-spec.md`. Fixture: `tests/phase2/`.

## Phase 1 — v1.0

- Mô phỏng cố định 60 Hz, Đêm 1 (5 đèn, 24 đom đóm), thu thập đom đóm, nạp đèn, 3 Ngọn Lửa, Tỏa Sáng làm Bóng Mực choáng 2 s, Bóng Mực đuổi theo Mây, thắng/thua ban đầu.
- Chế độ headless `npm run headless -- --seed N --night 1 --ticks N --out file.jsonl` (JSONL snapshot/event/end, tất định theo seed). Khai báo tuning ở `game.contract.json`.
- Renderer Three.js: đảo đêm sương mờ, cây low-poly, Mây đội nón lá.
