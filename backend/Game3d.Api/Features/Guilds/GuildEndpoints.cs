using System.Security.Claims;
using Game3d.Api.Features.Accounts;
using Game3d.Application;
using Game3d.Api.Features.Realtime;

namespace Game3d.Api.Features.Guilds;

public static class GuildEndpoints
{
    public sealed record CreateGuild(string Name);
    public sealed record JoinGuild(Guid GuildId);
    public sealed record DeclareWar(Guid TargetGuildId);
    public static void MapGuildEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/guilds").RequireAuthorization();
        group.MapGet("", async (IGameStore store, CancellationToken ct) => Results.Ok(await store.GuildsAsync(ct)));
        group.MapGet("/mine", async (ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
            Results.Ok(await store.GuildForAsync(user.AccountId(), ct)));
        group.MapPost("", async (CreateGuild input, ClaimsPrincipal user, IGameStore store, GroupSyncService groups, CancellationToken ct) =>
        {
            var name = input.Name?.Trim() ?? "";
            if (name.Length is < 3 or > 30 || name.Any(char.IsControl)) return Results.BadRequest();
            if (!await store.CreateGuildAsync(user.AccountId(), name, ct))
                return Results.Conflict(new { error = "Tên bang đã dùng hoặc bạn đã có bang." });
            await groups.SyncAsync(user.AccountId(), CancellationToken.None);
            return Results.Ok(await store.GuildForAsync(user.AccountId(), ct));
        });
        group.MapPost("/join", async (JoinGuild input, ClaimsPrincipal user, IGameStore store, GroupSyncService groups, CancellationToken ct) =>
        {
            if (!await store.JoinGuildAsync(user.AccountId(), input.GuildId, ct)) return Results.Conflict();
            await groups.SyncAsync(user.AccountId(), CancellationToken.None);
            return Results.Ok(await store.GuildForAsync(user.AccountId(), ct));
        });
        group.MapPost("/leave", async (ClaimsPrincipal user, IGameStore store, GroupSyncService groups, CancellationToken ct) =>
        {
            await store.LeaveGuildAsync(user.AccountId(), ct);
            await groups.SyncAsync(user.AccountId(), CancellationToken.None);
            return Results.NoContent();
        });
        group.MapGet("/wars", async (ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var guild = await store.GuildForAsync(user.AccountId(), ct);
            return Results.Ok(guild is null ? [] : await store.WarsForAsync(guild.Id, ct));
        });
        group.MapPost("/wars", async (DeclareWar input, ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var war = await store.DeclareWarAsync(user.AccountId(), input.TargetGuildId, ct);
            return war is null ? Results.Conflict(new { error = "Chỉ bang chủ có thể tuyên chiến với bang khác." }) : Results.Ok(war);
        });
    }
}
