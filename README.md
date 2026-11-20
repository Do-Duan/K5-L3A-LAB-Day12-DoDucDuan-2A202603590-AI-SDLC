# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba chạy trên trình duyệt, làm bằng Three.js + TypeScript. Chọn đêm qua `?night=1`, `?night=2` hoặc `?night=3`. Mây thu thập đom đóm, thắp đèn, né Bóng Mực và dùng xung sáng để tạm thời làm chúng choáng.

## Chạy game

Yêu cầu Node.js 20+. Trong thư mục repo:

```bash
npm install
npm run dev
```

Mở URL Vite in ra (thường là `http://localhost:5173`). Build bản web: `npm run build`; thư mục phát hành là `dist/` và cần host tĩnh qua HTTP.

## Điều khiển

- WASD hoặc phím mũi tên: di chuyển
- Space: nhảy
- E: nạp đom đóm vào đèn gần nhất
- Q: xung sáng (tốn 1 đốm sáng)
- Shift: lướt
- Esc hoặc P: tạm dừng

Mỗi đom đóm +10 điểm; mỗi đèn hoàn tất +100 điểm; làm Bóng Mực choáng +25 điểm; thắng cộng điểm theo thời gian và số mạng còn lại.

## Headless / Test Contract

```bash
npm run headless -- --seed 12 --night 1 --ticks 600 --out result.jsonl
npm run headless -- --seed 12 --night 1 --scenario scenario.json --inputs inputs.json --ticks 600 --out result.jsonl --snapshot-every 10
```

Mô phỏng chạy fixed-step 60 Hz, output JSONL snapshot/event/end. Cùng seed và input tạo cùng kết quả. Các tuning được khai báo trong `game.contract.json`.

## Phase 2: contract v1.1

Spec và danh sách acceptance criteria: [`docs/phase-2-spec.md`](docs/phase-2-spec.md). Một số tuning được giả định vì nội dung Ticket-02 được dán vào cuộc trò chuyện không kèm phần số chuẩn: sức chứa/chi phí đèn 10, tốc độ lướt 14 m/s trong 0.2 s, hồi lướt 1.5 s, thời lượng đêm 2 và 3 là 360 s. Cần thay nếu tài liệu phát hành đầy đủ quy định khác.

Scenario đầu vào cho lướt, pause, bùa và Gió Lạc nằm trong `tests/phase2/`.

## Giả định Phase 1

5 đom đóm nạp đầy một đèn; Mây có 3 ngọn lửa; xung sáng tiêu hao 1 ngọn lửa và làm choáng Bóng Mực trong 2 giây. Màn kéo dài 5 phút. Điểm và thông số khác xem `game.contract.json`.

## Sáng tạo của tôi

Đảo đêm sương mờ, cây low-poly, Mây đội nón lá, ánh sáng đèn đổi dần từ tím sang vàng. Các chi tiết này chỉ thuộc lớp trình bày, không thay đổi mô phỏng headless.

## Bằng chứng và AI

Đã build bằng `npm run build`; chạy headless đủ 21.600 tick cho Đêm 3 ở `tests/phase2/full-night.jsonl`. Đây là bằng chứng mô phỏng, không phải đo FPS trình duyệt. Nhật ký token và kiểm chứng hình ảnh cần bổ sung.

## Credits

Hình học, vật liệu và hiệu ứng được dựng bằng mã; không dùng asset bên ngoài. Typeface tải từ Google Fonts khi có mạng.
