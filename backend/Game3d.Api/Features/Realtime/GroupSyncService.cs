using Game3d.Application;
using Microsoft.AspNetCore.SignalR;

namespace Game3d.Api.Features.Realtime;

// Endpoint membership changes update all current connections immediately.
public sealed class GroupSyncService(IGameStore store, PvpArena arena, IHubContext<GameHub> hub)
{
    public async Task SyncAsync(Guid accountId, CancellationToken ct)
    {
        var party = await store.PartyForAsync(accountId, ct);
        var guild = await store.GuildForAsync(accountId, ct);
        var desired = new List<string>();
        if (party is not null) desired.Add($"party:{party.Id}");
        if (guild is not null) desired.Add($"guild:{guild.Id}");
        foreach (var connection in arena.ConnectionsFor(accountId))
        {
            var current = arena.GroupsFor(connection);
            foreach (var group in current.Except(desired)) await hub.Groups.RemoveFromGroupAsync(connection, group, ct);
            foreach (var group in desired.Except(current)) await hub.Groups.AddToGroupAsync(connection, group, ct);
            arena.SetGroups(connection, desired);
        }
    }
}
