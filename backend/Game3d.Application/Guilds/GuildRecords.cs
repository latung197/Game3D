namespace Game3d.Application;

public sealed record GuildRecord(Guid Id, string Name, Guid LeaderId, int Members);
public sealed record GuildWarRecord(Guid Id, Guid GuildA, Guid GuildB, int ScoreA, int ScoreB,
    DateTimeOffset StartsAt, DateTimeOffset EndsAt);
