# Retro — Đảo Đèn Lồng (Phase 1–4)

Công cụ AI: Claude Code (Anthropic). Chưa có điểm chấm của giảng viên khi viết bản này, nên phần Evaluation dưới đây là **tự đánh giá dựa trên bằng chứng trong repo**.

## 1. Evaluation 4 phase (tự đánh giá)
| Phase | Tự đánh giá | Bằng chứng / hạn chế |
| :-- | :-- | :-- |
| 1 — Đêm 1 + headless | Đạt phần chính: mô phỏng tất định 60 Hz, headless JSONL, tag `phase-1`. | Chỉ có kiểm tra bằng chạy lại cùng seed; chưa có bộ test tự động. |
| 2 — Đêm 2–3, kỹ năng | Đạt một phần: đủ tính năng, nhưng ticket thiếu phần số chuẩn nên nhiều giá trị là **giả định** (`docs/phase-2-spec.md`). Luật `wander` của Ticket-02 chưa cài đúng nguyên văn; va chạm dốc/bậc thang chưa đầy đủ. | Các mục chưa xong được ghi thẳng trong spec thay vì tuyên bố đã đạt. |
| 3 — Đèn cạn dầu | Tốt nhất trong 4 phase: 22 test luật, ADR-003, CHANGELOG liệt kê breaking changes, test/fixture cũ được tạo lại hoặc xóa có lý do. | Các giả định về thứ tự bước trong tick (bước 2 của Ticket-02 không có trong repo) và điểm của Gió Lạc. |
| 4 — Phát hành | Đạt phần có thể đo: bench 261 fps, soak 0 crash, bảng xếp hạng, trợ năng, 15 + 13 test, 13 kiểm tra trình duyệt. | Số đo từ **một máy**, không phải máy chấm; soak với input ngẫu nhiên kết thúc Đêm rất sớm; chưa thử clone sạch trên máy khác. |

## 2. Điều gì hiệu quả / không hiệu quả khi làm với AI
- **Hiệu quả:**
  - Giao việc theo từng ticket và yêu cầu liệt kê luật bị thay trước khi sửa.
  - Viết test cùng lúc với luật (Phase 3, 4).
  - Giữ `sim.ts` thuần để headless, soak, bench và test dùng chung một mô phỏng.
  - Tạo lại fixture bằng lệnh thay vì sửa tay.
  - Kiểm chứng bằng cách **chạy thật** (test, build, bench, trình duyệt) thay vì tin lời báo "xong".
- **Không hiệu quả:**
  - Mã Phase 1–2 bị nén thành các dòng rất dài, khó đọc và khó review.
  - Mỗi phase ít commit nhỏ, khó lần lại từng quyết định.
  - Những chỗ ticket mơ hồ bị đoán thay vì hỏi.

## 3. Những lần AI sai và cách phát hiện
- **Phase 2 (mã nền):** Bóng Mực sinh ra ở trạng thái `spawning` rồi không bao giờ đổi trạng thái, và không có hành vi `wander` thật như ticket mô tả. Phát hiện khi đọc `sim.ts` để cài luật hút dầu Phase 3. Hiện vẫn giữ hành vi cũ (đuổi theo Mây) và ghi trong ADR-003.
- **Phase 3 – thứ tự bước:** trừ dầu đặt trước tương tác khiến đèn đặt sẵn `fuel: 100` không còn "đầy" ở tick đầu. Test "đèn đầy dầu không được chọn" bắt được; sửa bằng cách đặt bước dầu sau tương tác.
- **Phase 3 – bán kính đẩy Bóng Mực:** ban đầu dùng 3 m (`safe_radius`) trong khi ticket ghi 6 m. Phát hiện khi đối chiếu lại từng điều khoản; sửa và ghi vào ADR.
- **Phase 3 – thời gian bằng số thực:** `time -= 1/60` có thể lệch một tick ở bình minh. Đổi sang bộ đếm tick nguyên.
- **Phase 3 – test sai chứ không phải mã:** vài test ban đầu tự sai (tên người chơi chỉ 2 ký tự bị từ chối, mốc tick lệch 1, kỳ vọng khoảng cách tính trước khi đẩy xong). Phát hiện vì test đỏ, đọc kỹ lý do rồi sửa test thay vì sửa mã cho "vừa".
- **Phase 4 – renderer:** vật liệu đèn bị tạo mới mỗi khung hình (rò bộ nhớ GPU) và sự kiện mô phỏng không bao giờ được lấy ra nên tích lũy vô hạn. Phát hiện khi viết soak/bench; đã sửa.
- **Phase 4 – camera bench:** tọa độ bắt đầu ra `(30, 15, -0)` thay vì `(30, 15, 0)`. Test camera bắt được (so sánh nghiêm ngặt), sửa bằng `+ 0`.
- **Phase 4 – đóng gói:** `tar` trong Git Bash là GNU tar, không tạo được zip và hiểu `C:` là máy từ xa. Phát hiện khi chạy thật lệnh đóng gói; đổi sang PowerShell `Compress-Archive` trên Windows.
- **Phase 4 – thao tác quá rộng:** AI định tắt server thử bằng lệnh dừng mọi tiến trình `node`; bị công cụ an toàn chặn và đổi sang chỉ dừng tiến trình đang nghe đúng cổng.
- **Báo cáo quá lạc quan:** có lúc kết luận "chỉ còn commit" trong khi README Phase 1–2 vẫn mô tả luật điểm cũ. Phát hiện khi rà lại tài liệu trước khi nộp.

## 4. Harness
**Không dùng harness AI nào trong dự án này**: không có skill, hook, plugin hay cấu hình MCP riêng. Phần gần nhất là `AGENTS.md` (viết ở Phase 4, mô tả kiến trúc và quy tắc), cùng ADR/CHANGELOG làm "bộ nhớ" giữa các phase. Điều giúp nhiều nhất là lệnh một dòng: `npm test`, `npm run build`, `npm run bench`, `npm run soak`, `npm run test:e2e`. Đây là điểm yếu thật: bị phụ thuộc vào việc tự nhắc AI chạy kiểm chứng.

## 5. Token / chi phí
- **Phiên Phase 3–4 (phiên gần nhất):** cửa sổ ngữ cảnh đang dùng khoảng **279 000 token** (28% của 1 triệu); đây là kích thước ngữ cảnh hiện tại, không phải tổng token đã tính phí.
- **Chi phí:** gói **Pro**, chưa bật Extra usage nên chi phí phát sinh ngoài gói là **0 USD**. Mức dùng gói lúc viết: 19% hạn mức 5 giờ, 3% hạn mức tuần.
- **Phase 1–2:** làm ở các phiên trước, không còn số liệu trong phiên này, nên **chưa có con số tổng chính xác**. Nếu cần, lấy từ trang usage của tài khoản.
- **Cách tiết kiệm:** đọc đúng phần cần sửa thay vì cả file; dùng ADR/CHANGELOG làm ngữ cảnh thay vì lặp lại giải thích; chạy lệnh kiểm chứng thay vì hỏi lại; gom nhiều thao tác độc lập vào cùng một lượt gọi công cụ.

## 6. Nếu làm lại
- Viết mô phỏng dễ đọc ngay từ Phase 1 (không nén dòng) và có bộ test từ đầu.
- Dựng `bench`/`soak` sớm (Phase 2) để thấy vấn đề hiệu năng và bộ nhớ trước khi chồng thêm tính năng.
- Tách commit theo từng yêu cầu của ticket; gắn tag ngay khi xong phase.
- Hỏi giảng viên về chỗ ticket mơ hồ (số chuẩn Phase 2, luật `wander` của Ticket-02) thay vì đoán.
- Dựng harness tối thiểu từ đầu: `AGENTS.md`, một hook chạy `npm test` trước khi commit.
