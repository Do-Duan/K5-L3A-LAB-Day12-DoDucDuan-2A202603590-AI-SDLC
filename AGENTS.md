# AGENTS.md — Đảo Đèn Lồng

Hướng dẫn cho trợ lý AI (Claude Code, v.v.) làm việc trong repo này.

## Kiến trúc
- `src/sim.ts` — mô phỏng **thuần, tất định**, bước cố định 60 Hz. Không dùng `Math.random`/`Date`; RNG theo seed. Mọi luật chơi nằm ở đây.
- `src/headless.ts` — CLI headless theo Test Contract (`game.contract.json`). Đầu ra JSONL **không được đổi** nếu ticket không yêu cầu.
- `src/main.ts` + `settings.ts`, `campaign.ts`, `leaderboard.ts`, `bench.ts` — renderer Three.js, UI, cảnh benchmark.
- `scripts/` — soak, bench, server/API xếp hạng, đóng gói release. `tests/phase3`, `tests/phase4` — test; `tests/phase2` — fixture.

## Quy tắc làm việc
1. Đọc kỹ ticket; liệt kê luật cũ bị thay (`[THAY THẾ]`) và test bị ảnh hưởng **trước khi** sửa. Test bị luật mới làm sai: sửa hoặc xóa kèm lý do trong `CHANGELOG.md`, không skip âm thầm.
2. Giá trị nhiên liệu tính bằng số nguyên 1/60 (`fuelU`) để tránh sai số thực; thời gian đêm là số nguyên tick.
3. Quyết định thiết kế ghi ở `docs/adr-*.md`; giả định ghi ở ADR/README.
4. Mọi thay đổi luật cần test trong `tests/` và chạy `npm test` + `npm run build` trước khi commit.
5. Không đổi đầu ra headless ở các phase không phải thay đổi luật; bench/soak/UI không được làm đổi mô phỏng.
6. Không commit `.env`, token, `data/`, `bench-profile/`.

## Lệnh hay dùng
`npm install` · `npm run dev` · `npm run build` · `npm test` · `npm run test:e2e` · `npm run bench` · `npm run soak` · `npm run package`
