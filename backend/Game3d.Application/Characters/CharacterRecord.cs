namespace Game3d.Application;

public sealed record CharacterRecord(Guid Id, Guid AccountId, string Name, string Element, int Level,
    int Experience, int Gold, int MaxHealth, int TotalKills, int QuestKills);
