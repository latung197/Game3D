namespace Game3d.Application;

public interface ISocialStore
{
    Task<ChatEntry> AddMessageAsync(ChatEntry message, CancellationToken ct);
    Task<IReadOnlyList<ChatEntry>> MessagesAsync(string channel, string scopeId, int limit, CancellationToken ct);
    Task<IReadOnlyList<OnlineProfile>> PlayerDirectoryAsync(int limit, CancellationToken ct);
    Task<PartyRecord?> PartyForAsync(Guid accountId, CancellationToken ct);
    Task<PartyRecord> CreatePartyAsync(Guid leaderId, string code, CancellationToken ct);
    Task<bool> JoinPartyAsync(Guid accountId, string code, CancellationToken ct);
    Task LeavePartyAsync(Guid accountId, CancellationToken ct);
}
