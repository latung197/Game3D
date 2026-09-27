namespace Game3d.Domain.Inventory;

public sealed record ItemDefinition(string Id, string Name, string Slot, int AttackBonus, int DefenseBonus, int HealthBonus, string Icon);

public static class ItemCatalog
{
    public static readonly IReadOnlyList<ItemDefinition> All =
    [
        new("bamboo_sword", "Trúc Kiếm", "weapon", 4, 0, 0, "⚔"),
        new("bronze_blade", "Đồng Đao", "weapon", 8, 0, 0, "⚔"),
        new("traveler_robe", "Du Hiệp Bào", "armor", 0, 3, 8, "◈"),
        new("stone_armor", "Thạch Giáp", "armor", 0, 7, 18, "◆"),
        new("spirit_ring", "Linh Khí Giới", "ring", 3, 2, 5, "✧")
    ];

    public static ItemDefinition? Find(string id) => All.FirstOrDefault(item => item.Id == id);
}
