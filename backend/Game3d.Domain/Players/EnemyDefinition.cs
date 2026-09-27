namespace Game3d.Domain.Players;

public sealed record EnemyDefinition(string Id, string Name, int Health, int Damage, int Experience, int Gold);

public static class EnemyCatalog
{
    public static readonly IReadOnlyList<EnemyDefinition> All =
    [
        new("forest_slime", "Mộc Linh", 42, 8, 25, 8),
        new("stone_guardian", "Thạch Vệ", 80, 13, 40, 15)
    ];

    public static EnemyDefinition? Find(string id) => All.FirstOrDefault(enemy => enemy.Id == id);
}
