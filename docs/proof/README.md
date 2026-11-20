# Bằng chứng theo phase

Mỗi mục trỏ tới thứ có thể chạy lại. Tag tương ứng: `phase-1` … `phase-4`.

| Phase | Bằng chứng | Cách kiểm lại |
| :-- | :-- | :-- |
| 1 | Headless tất định, Đêm 1; tuning ở `game.contract.json` | `npm run headless -- --seed 12 --night 1 --ticks 600 --out r.jsonl` (chạy hai lần, so sánh) |
| 2 | Fixture lướt/tạm dừng/bùa/Gió Lạc/cả Đêm: `tests/phase2/`; tiêu chí: `docs/phase-2-spec.md` | chạy lại headless với `--scenario/--inputs` tương ứng (kết quả đã tạo lại theo luật v1.2, xem CHANGELOG) |
| 3 | 22 test luật: `tests/phase3/run.ts`; ADR: `docs/adr-003-fuel-and-dawn-win.md`; CHANGELOG ghi breaking changes | `npm run test:phase3` |
| 4 | 13 test + 13 kiểm tra trình duyệt: `tests/phase4/`; `bench.json`, `soak.json` | `npm test`, `npm run test:e2e`, `npm run bench -- --seed 42 --duration 30 --out bench.json`, `npm run soak -- --seed 7 --nights 10 --out soak.json` |

## Phase 4 — kết quả tự đo

Máy: Windows 11, Intel Core i5-12500H, Intel Iris Xe, 16 GB RAM; Chrome 157 (ANGLE/D3D11). **Không phải máy chấm.**

| Chỉ số | Kết quả | Ngưỡng |
| :-- | :-- | :-- |
| `avg_fps` | 261.1 | ≥ 60 |
| `p1_low_fps` | 118.9 | ≥ 30 |
| `frame_ms_p95` | 5.7 ms | — |
| `load_ms` | 1850 | ≤ 10000 |
| soak `crashes` | 0 | = 0 |
| soak bộ nhớ | 69 → 72 MB (×1.04) | ≤ ×1.2 |

Phạm vi và giới hạn:
- Soak: input ngẫu nhiên khiến Mây thường thua sớm, nên tổng thời gian mô phỏng ngắn (≈ 14 000 tick cho 10 Đêm). Bộ nhớ ổn định trong khoảng đó; chưa chạy soak với Đêm dài đầy đủ.
- Bench: số liệu từ một lần chạy 30 s; `peak_mem_mb` là cả cây tiến trình trình duyệt.
- Test chưa chạy trên máy sạch/hệ điều hành khác; chưa có video (người làm tự quay).
