# Ghi chú để tiếp tục phát triển

Đọc `README.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_STATUS.md` trước khi thay đổi lớn; sau đó chỉ mở file của chức năng liên quan.

## Định vị nhanh

- Đăng nhập/nhân vật: `backend/Game3d.Api/Features/Accounts`, `Features/Characters`; `frontend/src/features/account`, `features/characters`.
- Kho đồ: `Game3d.Domain/Inventory/ItemCatalog.cs`, `Features/Inventory`, `frontend/src/features/inventory`.
- Chat/nhóm/bang: `Features/Social`, `Features/Guilds`, `Features/Realtime/GameHub.cs`; `frontend/src/features/social`.
- PK: `Game3d.Domain/Players/PvpCombatCatalog.cs`, `Features/Realtime/PvpArena.cs`, `GameHub.cs`; thế giới 3D ở `frontend/src/features/world`.
- Tài sản đồ họa: `frontend/src/features/assets/assetManifest.ts`, file tĩnh ở `frontend/public/assets`.
- Lưu SQLite: `Game3d.Infrastructure/Persistence/SqliteGameStore.cs` và `Repositories/SqliteGameStore.*.cs`.
- Hợp đồng Application được chia trong `Game3d.Application/{Accounts,Characters,Inventory,Social,Guilds}`; `IGameStore` ghép các hợp đồng cho SQLite hiện tại.

## Quy tắc cần giữ

1. Không xóa/reset/ghi đè `backend/Game3d.Api/App_Data/players.json` hay `game.db`; dùng DB riêng khi test.
2. Không tin dữ liệu PK từ trình duyệt. Máy chủ xác nhận vị trí, tầm, hồi chiêu, sát thương và kết quả.
3. API tài khoản kiểm tra sở hữu nhân vật và quyền kênh chat. POST/PUT dưới `/api` cần header `X-Requested-With: XMLHttpRequest` (trừ SignalR).
4. Thay đổi bảng SQLite bằng migration tăng `PRAGMA user_version`; không sửa riêng SchemaV1 khi đã có DB người dùng.
5. Giữ frontend nhẹ: tải GLB/VFX khi cần, hạn chế texture lớn, theo dõi dung lượng build.
6. Khi đổi trạng thái tính năng hoặc giới hạn, cập nhật `docs/PROJECT_STATUS.md`.

Kiểm tra: `dotnet build backend/Game3d.Api/Game3d.Api.csproj -c Release --no-restore -v:q`; tại `frontend` chạy `npm run build`. Kịch bản nhiều tài khoản nằm trong `frontend/scripts/smoke-*.mjs`; xem `docs/TESTING.md` để chạy trên DB riêng. API cổng 5088, Vite cổng 5188. Nếu build Debug bị khóa DLL do API đang chạy, build Release hoặc dừng đúng tiến trình API.
