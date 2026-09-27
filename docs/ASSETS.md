# Thay model nhân vật và hình chiêu thức

Điểm cấu hình là `frontend/src/features/assets/assetManifest.ts`. Đặt file trong `frontend/public/assets`, rồi khai báo URL bắt đầu bằng `/assets/`. Có thể thêm tài sản từng hệ một; hệ chưa có file vẫn dùng hình khối 3D và ký hiệu mặc định.

```ts
export const assetManifest: Partial<Record<ElementId, ElementAssets>> = {
  fire: {
    characterModel: '/assets/characters/fire.glb',
    attackIcon: '/assets/skills/fire-attack.webp',
    defenseIcon: '/assets/skills/fire-defense.webp',
    skillIcon: '/assets/skills/fire-skill.webp',
    skillTexture: '/assets/skills/fire-effect.webp',
  },
}
```

`characterModel` thay nhân vật 3D chính. GLB nên có chân tại y=0, hướng mặt +Z, cao khoảng 2.5 đơn vị và ít mesh/material. `attackIcon`, `defenseIcon`, `skillIcon` là hình nền ba nút; dùng ảnh vuông và giữ chữ/ký hiệu mặc định làm lớp trên. `skillTexture` là hình nền trong suốt trải trên đất khoảng nửa giây khi kích hoạt kỹ năng; dùng PNG/WebP có alpha.

Model chỉ tải khi chọn hệ đó; GLTFLoader tách khỏi bundle chính. Ảnh kỹ năng chỉ tải khi khai báo. Nén mesh/texture trước khi đưa vào dự án; thử trên điện thoại thật và theo dõi Network/FPS. Logic sát thương và hiệu ứng trạng thái nằm ở `features/world/GameWorld.ts` (PvE) và `backend/Game3d.Api/Features/Realtime/PvpArena.cs` (PK). Hình ảnh chỉ thay biểu diễn, không thay quy tắc máy chủ.
