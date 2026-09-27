# Kiến trúc và đường đi chức năng

## Backend

```text
Game3d.Domain          Quy tắc nhân vật, hệ, quái, catalog vật phẩm
Game3d.Application     Hợp đồng IGameStore, model ứng dụng, dịch vụ nhân vật cũ
Game3d.Infrastructure  SQLite, repository JSON cũ, mã hóa mật khẩu
Game3d.Api             HTTP endpoints, Cookie auth, SignalR, bộ nhớ PK
```

Phụ thuộc đi từ API/Infrastructure vào Application/Domain. `Program.cs` đăng ký dịch vụ và endpoint. SQLite dùng `Microsoft.Data.Sqlite`; schema trong `SqliteGameStore.cs`, truy vấn chia theo Accounts, Inventory, Social, Guilds ở các partial class. Application chia model và interface theo chức năng; `IGameStore` ghép các hợp đồng này cho SQLite hiện tại.

| Chức năng | Route | Nguồn |
| --- | --- | --- |
| Tài khoản | `/api/accounts/*` | `Features/Accounts` |
| Nhân vật | `/api/characters/*` | `Features/Characters` |
| Kho đồ | `/api/inventory/*` | `Features/Inventory` |
| Danh bạ/nhóm/lịch sử chat | `/api/social/*` | `Features/Social` |
| Bang hội/bang chiến | `/api/guilds/*` | `Features/Guilds` |
| Chat và PK realtime | `/api/realtime` | `Features/Realtime` |
| Chơi thử cũ | `/api/players/*`, `/api/world` | `Features/Players` |

Cookie xác thực chỉ chứa ID tài khoản; `HttpOnly`, `SameSite=Strict`, phiên 8 giờ hoặc 30 ngày khi ghi nhớ. Mật khẩu dùng `PasswordHasher`. API thay đổi dữ liệu yêu cầu `X-Requested-With`; đăng nhập có rate limit IP. Hub xác nhận thành viên nhóm/bang trước khi gửi chat. `PvpArena` giữ vị trí, HP, thời gian hồi, phạm vi và sát thương ở máy chủ. `PvpCombatCatalog` định nghĩa tầm đánh, hồi chiêu và hiệu ứng PK riêng từng hệ; trạng thái trói/chậm/tăng tốc gửi về frontend qua `ControlStatus`.

## Frontend

```text
src/main.ts                    HUD, bảng chức năng và phiên chơi
src/features/account           Phiên tài khoản và chọn nhân vật
src/features/characters        API chơi thử / tiến trình nhân vật
src/features/inventory         Túi đồ/trang bị
src/features/social            SignalR và chat/nhóm/bang/PK
src/features/world             Three.js, điều khiển, quái, bản đồ
src/features/assets            Manifest tài sản riêng
src/style.css                  Desktop/mobile
```

`GameWorld.configureElement` đọc `assetManifest`. Nếu có `characterModel`, tải `.glb` theo nhu cầu; `attackIcon`, `defenseIcon`, `skillIcon` thay ảnh nền nút; `skillTexture` hiện khi dùng kỹ năng. Đặt file tại `frontend/public/assets/characters/fire.glb`, khai báo `fire: { characterModel: '/assets/characters/fire.glb' }`. Model nên có chân tại y=0, mặt hướng +Z, cao khoảng 2.5 đơn vị. Dùng GLB nén và ảnh nhỏ để giữ tải nhẹ.

## Luồng dữ liệu

1. Chơi thử không cần tài khoản; tiến trình cũ nằm trong `players.json` khi API chạy hoặc localStorage khi ngoại tuyến.
2. Tài khoản có tối đa ba nhân vật, lưu `selected_character_id`. Tài khoản mới có thể tạo nhân vật hoặc nhập nhân vật chơi thử đã nằm trên máy chủ.
3. `game.db` lưu tài khoản, nhân vật, đồ, chat, nhóm, bang, bang chiến. Trạng thái PK nằm trong RAM và mất khi API khởi động lại.
4. SignalR vào kênh thế giới và nhóm/bang phù hợp; frontend gọi `RefreshGroups` sau khi đổi thành viên.
5. Thế giới gửi vị trí khoảng 8 lần/giây; server giới hạn tốc độ. Đánh PK gọi `Attack(targetId, skill)`, server quyết định trúng đòn rồi phát `PlayerHit`.

Thêm hệ nhân vật cần cập nhật `ElementCatalog`, `PvpCombatCatalog` và `features/world/elements.ts`. Khi triển khai nhiều máy chủ, cần chuyển trạng thái PK và nhóm SignalR khỏi RAM sang dịch vụ chia sẻ.
