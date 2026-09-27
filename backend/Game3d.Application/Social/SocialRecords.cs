namespace Game3d.Application;

public sealed record ChatEntry(Guid Id, Guid SenderId, string SenderName, string Channel,
    string ScopeId, string Text, DateTimeOffset CreatedAt);
public sealed record PartyRecord(Guid Id, string Code, Guid LeaderId, int Members);
public sealed record OnlineProfile(Guid AccountId, string DisplayName, Guid? CharacterId,
    string? CharacterName, string? Element, int Level, Guid? GuildId);
