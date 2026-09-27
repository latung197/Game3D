# Trạng thái dự án

## Đã có

- Bản đồ 3D, quái, nhiệm vụ đầu, bảy hệ với đòn thường/phòng thủ/kỹ năng riêng.
- Tài khoản cookie, ba ô nhân vật, ghi nhớ nhân vật được chọn, nhập dữ liệu chơi thử từ API cũ.
- SQLite cho nhân vật, trang bị, chat, nhóm, bang và điểm bang chiến.
- SignalR cho chat thế giới/nhóm/bang/riêng, hiện diện người chơi và PK có kiểm tra ở máy chủ; bảy hệ có tầm, hồi chiêu, phòng thủ và hiệu ứng PK riêng.
- UI desktop/mobile và manifest cho GLB, icon, texture kỹ năng riêng.

## Giới hạn cần biết

- Nền tảng nhiều người chơi hiện chạy trong **một tiến trình API**. Vị trí/HP PK nằm trong RAM. SQLite chưa phù hợp tải MMO lớn hoặc nhiều máy chủ.
- PvE/quái và phần thưởng PvE vẫn theo luồng chơi thử: trình duyệt báo hạ quái cho API. Trước khi mở máy chủ công khai, cần đưa PvE và phần thưởng sang server để chống gian lận.
- HP PvE và PK tách nhau. Trang bị cộng chỉ số trong PK; chiến đấu PvE chưa dùng bonus trang bị. Bang chiến có điểm hạ gục, chưa có phần thưởng tự động.
- Nhập nhân vật cũ bằng ID chỉ dành cho chơi thử; ID cũ chưa chứng minh quyền sở hữu. Không bật chức năng này trên máy chủ công khai nếu chưa bổ sung xác minh.
- Chưa có bạn bè, lời mời nhóm theo tài khoản, quyền quản trị bang, chợ/giao dịch, animation rig hoặc lưu trận PK.
- Chat có giới hạn tần suất cơ bản, chưa có chặn người dùng, kiểm duyệt hay công cụ quản trị.

## Hướng phát triển tiếp

1. Đưa PvE, XP, vàng, đồ rơi và chỉ số trang bị vào dịch vụ chiến đấu server; viết test cho quy tắc.
2. Thêm migration SQLite có phiên bản và thử nâng cấp từ bản sao DB thật.
3. Thêm bạn bè/lời mời nhóm, vai trò bang và phần thưởng bang chiến.
4. Thay model tạm bằng GLB/animation tối ưu, tải theo khoảng cách và đo FPS trên điện thoại thật.
5. Trước khi public: HTTPS, bảo vệ khóa Data Protection trên đĩa, xác minh email/khôi phục mật khẩu, giám sát, backup, chống spam và xác minh dữ liệu nhập cũ.

## Kiểm tra gần nhất (2026-09-28)

- `dotnet build backend/Game3d.Api/Game3d.Api.csproj -c Release --no-restore -v:q`: thành công, 0 cảnh báo.
- `npm run build` tại `frontend`: thành công. JavaScript Three.js chính khoảng 153 KB sau gzip; SignalR tải riêng khi đăng nhập.
- Trên DB thử riêng: tạo hai tài khoản, hai nhân vật, đồ khởi đầu, lập/vào nhóm, hai bang và tuyên chiến; tài khoản không thể chọn nhân vật của tài khoản khác (404).
- Hai kết nối SignalR: chat thế giới, nhóm, bang và riêng đều tới đúng người; rời nhóm không còn nhận tin dù không tự gọi làm mới. PK gây sát thương do server tính; kiếm/áo tăng đúng sát thương và HP; Hỏa phản đòn, Băng đóng băng rồi hết hiệu lực đúng thời gian.
- SignalR WebSocket đã thử qua proxy Vite ở cổng 5188; chat, PK và khôi phục HP sau kết nối lại hoạt động.
- Dữ liệu thật `App_Data/players.json` không dùng làm DB kiểm thử.
