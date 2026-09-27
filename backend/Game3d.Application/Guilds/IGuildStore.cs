namespace Game3d.Application;

public interface IGuildStore
{
    Task<GuildRecord?> GuildForAsync(Guid accountId, CancellationToken ct);
    Task<IReadOnlyList<GuildRecord>> GuildsAsync(CancellationToken ct);
    Task<GuildRecord?> GuildAsync(Guid id, CancellationToken ct);
    Task<bool> CreateGuildAsync(Guid leaderId, string name, CancellationToken ct);
    Task<bool> JoinGuildAsync(Guid accountId, Guid guildId, CancellationToken ct);
    Task LeaveGuildAsync(Guid accountId, CancellationToken ct);
    Task<GuildWarRecord?> ActiveWarAsync(Guid guildA, Guid guildB, CancellationToken ct);
    Task<IReadOnlyList<GuildWarRecord>> WarsForAsync(Guid guildId, CancellationToken ct);
    Task<GuildWarRecord?> DeclareWarAsync(Guid leaderId, Guid targetGuildId, CancellationToken ct);
    Task RecordWarKillAsync(Guid warId, Guid winnerGuildId, CancellationToken ct);
}
