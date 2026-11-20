# Retro — Đảo Đèn Lồng (Phase 1–4)

> **Bản nháp do AI soạn từ những gì thấy trong repo và lịch sử làm việc.** Các mục đánh dấu `TODO` là số liệu/nhận định cá nhân mà chỉ tác giả biết (Evaluation của từng phase, token/chi phí thực tế). Hãy điền hoặc sửa trước khi nộp.

## 1. Evaluation 4 phase
| Phase | Kết quả | Điều học được |
| :-- | :-- | :-- |
| 1 — Đêm 1 + headless | TODO (điểm/nhận xét) | Test Contract phải chính xác từ đầu; mô phỏng thuần + seed giúp mọi thứ sau kiểm chứng được. |
| 2 — Đêm 2–3, kỹ năng | TODO | Ticket thiếu phần số chuẩn → phải đoán và ghi giả định (`docs/phase-2-spec.md`). Mã dày đặc khó sửa. |
| 3 — Đèn cạn dầu | TODO | Đổi luật cốt lõi kéo theo test, fixture, tài liệu cũ; ADR + CHANGELOG giúp không sót. |
| 4 — Phát hành | TODO | Đo được (bench/soak) buộc thiết kế lại phần đo thay vì "cảm giác"; bài toán nằm ở quy trình hơn là code. |

## 2. Điều gì hiệu quả / không hiệu quả khi làm với AI
- **Hiệu quả:** giao việc theo ticket, yêu cầu AI liệt kê luật bị thay trước khi sửa; test viết cùng lúc với luật (22 + 13 ca); tách `sim.ts` thuần khỏi renderer nên chạy headless/soak/bench trên cùng mô phỏng; tái tạo fixture bằng lệnh thay vì sửa tay.
- **Không hiệu quả:** để AI viết mã nén một dòng (khó đọc, khó review); để cả phase vào một lần commit lớn; tin báo cáo "xong" mà chưa chạy lệnh kiểm chứng.

## 3. Những lần AI sai và cách phát hiện
- _Phase 3:_ thứ tự trừ dầu so với tương tác làm đèn `fuel: 100` đặt sẵn không còn "đầy" ở tick đầu → phát hiện bằng test "đèn đầy dầu không được chọn", sửa bằng cách đặt bước dầu **sau** tương tác.
- _Phase 3:_ ban đầu dùng bán kính đẩy Bóng Mực 3 m (`safe_radius`) trong khi ticket ghi 6 m → phát hiện khi đối chiếu lại ticket từng điều khoản, sửa và ghi ADR.
- _Phase 3:_ lỗi so sánh thời gian bằng số thực (`time -= 1/60`) có thể lệch 1 tick ở bình minh → đổi sang bộ đếm tick nguyên.
- _Phase 4:_ trong renderer, vật liệu đèn bị tạo mới mỗi khung hình (rò bộ nhớ GPU) và sự kiện mô phỏng không bao giờ được lấy ra → phát hiện khi viết soak/bench, đã sửa.
- TODO: bổ sung những lần sai khác bạn nhớ (và cách bạn bắt được).

## 4. Harness giúp nhiều nhất
- `AGENTS.md` (kiến trúc + quy tắc: tất định, test trước khi commit, không đổi headless khi không được yêu cầu), ADR/CHANGELOG như "bộ nhớ" giữa các phase, lệnh `npm test` một dòng, script bench/soak/e2e chạy lại được.
- TODO: nêu skill/hook/plugin cụ thể bạn đã dùng (nếu có) và cái nào hữu ích nhất.

## 5. Token / chi phí
- Tổng token/chi phí ước tính: TODO (lấy từ trang usage của công cụ).
- Cách tiết kiệm: TODO (ví dụ: đọc phần cần thiết thay vì cả file, tái sử dụng ticket/ADR làm ngữ cảnh, chạy lệnh kiểm chứng thay vì hỏi lại).

## 6. Nếu làm lại
- Viết mô phỏng dễ đọc ngay từ Phase 1 (không nén dòng) và có bộ test từ đầu.
- Dựng `bench`/`soak` sớm (Phase 2) để thấy vấn đề hiệu năng/bộ nhớ trước khi chồng thêm tính năng.
- Tách commit theo từng yêu cầu của ticket; gắn tag ngay khi xong phase.
- Hỏi giảng viên về chỗ ticket mơ hồ (số chuẩn Phase 2, luật `wander` của Ticket-02) thay vì đoán.
