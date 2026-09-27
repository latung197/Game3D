export type ElementId = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'ice' | 'qi'

export interface ElementStyle {
  id: ElementId
  name: string
  title: string
  glyph: string
  color: string
  colorHex: number
  description: string
  stats: { health: number; attack: number; defense: number; speed: number }
  attackMove: { name: string; damage: number; range: number; cooldown: number }
  defenseMove: { name: string; cooldown: number; duration: number; description: string }
  skillMove: { name: string; damage: number; range: number; cooldown: number; description: string }
}

export const elements: Record<ElementId, ElementStyle> = {
  metal: {
    id: 'metal', name: 'Kim', title: 'Thiết Kiếm', glyph: '金', color: '#e8ca82', colorHex: 0xe8ca82,
    description: 'Kiếm sĩ công thủ cân bằng, tung nhát chém sắc bén xuyên đội hình địch.',
    stats: { health: 105, attack: 34, defense: 14, speed: 5 },
    attackMove: { name: 'Thiết Kiếm Trảm', damage: 34, range: 2.6, cooldown: 0.45 },
    defenseMove: { name: 'Cương Giáp', cooldown: 8, duration: 2.4, description: 'Giảm 70% sát thương trong 2,4 giây.' },
    skillMove: { name: 'Kim Quang Trảm', damage: 60, range: 4.8, cooldown: 8, description: 'Chém mạnh theo hướng đang nhìn.' },
  },
  wood: {
    id: 'wood', name: 'Mộc', title: 'Linh Mộc', glyph: '木', color: '#91d398', colorHex: 0x91d398,
    description: 'Hồi phục bền bỉ, trói chân quái và bảo vệ bản thân bằng sinh khí.',
    stats: { health: 110, attack: 24, defense: 10, speed: 5 },
    attackMove: { name: 'Diệp Nhẫn', damage: 24, range: 2.8, cooldown: 0.43 },
    defenseMove: { name: 'Mộc Hộ', cooldown: 9, duration: 4, description: 'Hồi máu theo thời gian, giảm nhẹ sát thương.' },
    skillMove: { name: 'Dây Leo Trói', damage: 31, range: 3.7, cooldown: 9, description: 'Trói quái trong 3 giây và hồi máu.' },
  },
  water: {
    id: 'water', name: 'Thủy', title: 'Lưu Thủy', glyph: '水', color: '#82d6e3', colorHex: 0x82d6e3,
    description: 'Linh hoạt như dòng nước, làm chậm kẻ địch và thoát hiểm nhanh.',
    stats: { health: 100, attack: 25, defense: 11, speed: 6 },
    attackMove: { name: 'Thủy Kích', damage: 25, range: 3, cooldown: 0.42 },
    defenseMove: { name: 'Thủy Ảnh', cooldown: 6, duration: 0.8, description: 'Lướt đi và né mọi sát thương trong chốc lát.' },
    skillMove: { name: 'Thủy Long Ba', damage: 34, range: 4, cooldown: 8, description: 'Sóng nước làm chậm và hồi ít máu.' },
  },
  fire: {
    id: 'fire', name: 'Hỏa', title: 'Viêm Đao', glyph: '火', color: '#f7a36e', colorHex: 0xf7a36e,
    description: 'Sát thương bùng nổ, thiêu đốt quái và phản đòn khi bị đánh.',
    stats: { health: 85, attack: 33, defense: 7, speed: 6 },
    attackMove: { name: 'Viêm Đao', damage: 33, range: 2.6, cooldown: 0.4 },
    defenseMove: { name: 'Hỏa Thuẫn', cooldown: 8, duration: 2.5, description: 'Giảm nửa sát thương và phản đòn.' },
    skillMove: { name: 'Liệt Diệm', damage: 46, range: 4, cooldown: 9, description: 'Bùng nổ lửa và gây bỏng theo thời gian.' },
  },
  earth: {
    id: 'earth', name: 'Thổ', title: 'Sơn Vệ', glyph: '土', color: '#d7ae80', colorHex: 0xd7ae80,
    description: 'Sinh lực và giáp cao, tạo địa chấn làm choáng quái xung quanh.',
    stats: { health: 145, attack: 27, defense: 20, speed: 4 },
    attackMove: { name: 'Nham Quyền', damage: 27, range: 2.4, cooldown: 0.5 },
    defenseMove: { name: 'Thạch Bích', cooldown: 10, duration: 3, description: 'Giảm 80% sát thương trong 3 giây.' },
    skillMove: { name: 'Địa Chấn', damage: 38, range: 3.5, cooldown: 9, description: 'Làm choáng quái trong 2,4 giây.' },
  },
  ice: {
    id: 'ice', name: 'Băng', title: 'Hàn Kiếm', glyph: '氷', color: '#a5dbf2', colorHex: 0xa5dbf2,
    description: 'Khống chế trận địa bằng băng giá và đóng băng kẻ tấn công.',
    stats: { health: 95, attack: 27, defense: 12, speed: 5 },
    attackMove: { name: 'Hàn Nhận', damage: 27, range: 3, cooldown: 0.45 },
    defenseMove: { name: 'Băng Tâm', cooldown: 9, duration: 2.5, description: 'Giảm sát thương, đóng băng kẻ đánh trúng.' },
    skillMove: { name: 'Băng Phong', damage: 36, range: 3.8, cooldown: 9, description: 'Đóng băng quái trong 3 giây.' },
  },
  qi: {
    id: 'qi', name: 'Khí', title: 'Vô Ảnh', glyph: '氣', color: '#c6b2ef', colorHex: 0xc6b2ef,
    description: 'Tốc độ cao, luồng khí hất tung địch và thân pháp khó nắm bắt.',
    stats: { health: 90, attack: 29, defense: 8, speed: 8 },
    attackMove: { name: 'Khí Kình', damage: 29, range: 2.9, cooldown: 0.31 },
    defenseMove: { name: 'Vô Ảnh Bộ', cooldown: 6, duration: 0.7, description: 'Lướt nhanh, né đòn và tăng tốc ngắn hạn.' },
    skillMove: { name: 'Khí Toàn', damage: 40, range: 4.2, cooldown: 8, description: 'Hất lùi quái và tăng tốc di chuyển.' },
  },
}

export const elementList = Object.values(elements)

export function getElement(id: string | null | undefined): ElementStyle {
  return elements[id as ElementId] ?? elements.metal
}
