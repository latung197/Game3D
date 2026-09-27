namespace Game3d.Domain.Players;

public sealed record ElementDefinition(
    string Id, string Name, int BaseHealth, int Attack, int Defense, int Speed);

public static class ElementCatalog
{
    public static readonly IReadOnlyList<ElementDefinition> All =
    [
        new("metal", "Kim", 105, 34, 14, 5),
        new("wood", "Mộc", 110, 24, 10, 5),
        new("water", "Thủy", 100, 25, 11, 6),
        new("fire", "Hỏa", 85, 33, 7, 6),
        new("earth", "Thổ", 145, 27, 20, 4),
        new("ice", "Băng", 95, 27, 12, 5),
        new("qi", "Khí", 90, 29, 8, 8)
    ];

    public static ElementDefinition? Find(string? id) =>
        All.FirstOrDefault(element => element.Id == id);
}
