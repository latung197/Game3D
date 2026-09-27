# Trúc Lâm Bí Cảnh

Game nhập vai 3D nhẹ cho trình duyệt máy tính và điện thoại. Frontend: TypeScript, Three.js, Vite. Backend: ASP.NET Core 10, SQLite, SignalR. Có bảy hệ: Kim, Mộc, Thủy, Hỏa, Thổ, Băng, Khí.

## Chạy dự án

Cần .NET SDK 10 và Node.js 22.12+. Mở hai terminal tại thư mục gốc:

```powershell
dotnet run --project backend/Game3d.Api/Game3d.Api.csproj --launch-profile http
```

```powershell
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5188`. API chạy ở `http://localhost:5088`; Vite chuyển tiếp `/api`. Điện thoại cùng mạng dùng địa chỉ do Vite in ra. SQLite tự tạo tại `backend/Game3d.Api/App_Data/game.db`.

## Chức năng

- Chơi thử một mình, chọn hệ, đánh quái, lên cấp, lưu nhân vật cũ.
- Đăng ký/đăng nhập, ghi nhớ phiên, tối đa ba nhân vật một tài khoản, chọn nhân vật đang dùng.
- Nhập nhân vật chơi thử đã lưu trên máy chủ; kho đồ và trang bị khởi đầu.
- Chat thế giới, nhóm, bang hội, riêng qua SignalR; lịch sử chat trong SQLite.
- Nhóm bằng mã mời; lập/vào bang hội, bang chủ tuyên chiến 10 phút.
- PK tự do nếu cả hai bật PK hoặc PK giữa hai bang đang chiến tranh. Máy chủ kiểm tra vị trí, tầm, hồi chiêu, sát thương và điểm bang chiến.
- Model `.glb`, icon và ảnh kỹ năng riêng qua `frontend/src/features/assets/assetManifest.ts`; thiếu asset riêng thì dùng hình khối nhẹ.

## Điều khiển

| Tác vụ | Máy tính | Điện thoại |
| --- | --- | --- |
| Di chuyển | WASD / mũi tên | Cần điều khiển trái |
| Đánh thường | Space | Nút đánh |
| Phòng thủ | Shift | Nút phòng thủ |
| Kỹ năng | E | Nút kỹ năng |

Để PK: đăng nhập, chọn nhân vật, vào game, mở `Chat · Bang · PK`, chọn mục tiêu ở tab PK. Bật PK tự do nếu không có bang chiến; đứng đủ gần mục tiêu.

## Đọc tiếp

[AGENTS.md](AGENTS.md) là ghi chú để lần sau mở dự án có thể tìm đúng file ngay. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) mô tả lớp, API và realtime. [docs/ASSETS.md](docs/ASSETS.md) hướng dẫn thêm model/hình chiêu thức. [docs/TESTING.md](docs/TESTING.md) hướng dẫn kiểm tra trên DB riêng. [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) ghi rõ phần đã có và giới hạn.

## Dữ liệu và kiểm tra

`backend/Game3d.Api/App_Data/players.json` là dữ liệu chơi thử cũ; **không xóa hoặc ghi đè**. `game.db` chứa tài khoản và các tính năng mới. `App_Data` bị bỏ qua khi đưa mã nguồn lên Git; sao lưu riêng khi đổi máy hoặc triển khai. Để thử API, đặt `GameDb__Path` và `PlayerStore__Path` trỏ tới file thử nghiệm.

```powershell
dotnet build backend/Game3d.Api/Game3d.Api.csproj -c Release
cd frontend
npm run build
```
