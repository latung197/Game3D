# Kiểm tra bằng dữ liệu riêng

Các script `frontend/scripts/smoke-*.mjs` tạo tài khoản và nhân vật thử. **Không chạy chúng với DB thật.** Tạo thư mục `.runtime-test` trong gốc dự án, rồi mở API với hai biến cấu hình trỏ đến file thử:

```powershell
New-Item -ItemType Directory -Force .runtime-test | Out-Null
$workspace=(Get-Location).Path
$env:GameDb__Path=Join-Path $workspace '.runtime-test/smoke.db'
$env:PlayerStore__Path=Join-Path $workspace '.runtime-test/smoke-players.json'
dotnet run --project backend/Game3d.Api/Game3d.Api.csproj -c Release --no-launch-profile --urls http://127.0.0.1:5091
```

Trong terminal khác:

```powershell
cd frontend
$env:GAME3D_TEST_BASE='http://127.0.0.1:5091/api'
npm.cmd run smoke:relations
npm.cmd run smoke:chat
npm.cmd run smoke:realtime
```

`smoke:relations` thử lập/rời bang. `smoke:chat` thử chat nhóm, bang, riêng và quyền sau khi rời nhóm. `smoke:realtime` thử chat thế giới, PK, chỉ số trang bị, nối lại sau mất kết nối, phản đòn Hỏa và đóng băng Băng. Các script chỉ nhận URL localhost để giảm khả năng chạy nhầm trên máy chủ bên ngoài.

Để thử WebSocket qua Vite, chạy Vite ở terminal thứ ba với `$env:VITE_API_TARGET='http://127.0.0.1:5091'; npm.cmd run dev`; sau đó đặt `GAME3D_TEST_BASE='http://127.0.0.1:5188/api'` và chạy `smoke:realtime`.
