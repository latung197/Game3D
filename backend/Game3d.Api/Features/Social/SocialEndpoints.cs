using System.Security.Claims;
using System.Security.Cryptography;
using Game3d.Api.Features.Accounts;
using Game3d.Api.Features.Realtime;
using Game3d.Application;

namespace Game3d.Api.Features.Social;

public static class SocialEndpoints
{
    public sealed record JoinParty(string Code);
    public static void MapSocialEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/social").RequireAuthorization();
        group.MapGet("/players", async (IGameStore store, CancellationToken ct) => Results.Ok(await store.PlayerDirectoryAsync(100, ct)));
        group.MapGet("/players/{name}", async (string name, IGameStore store, CancellationToken ct) =>
        {
            var found = await store.AccountByNameAsync(name.Trim(), ct);
            return found is null ? Results.NotFound() : Results.Ok(new { found.Id, found.DisplayName });
        });
        group.MapGet("/party", async (ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
            Results.Ok(await store.PartyForAsync(user.AccountId(), ct)));
        group.MapPost("/party", async (ClaimsPrincipal user, IGameStore store, GroupSyncService groups, CancellationToken ct) =>
        {
            if (await store.PartyForAsync(user.AccountId(), ct) is not null) return Results.Conflict(new { error = "Bạn đã ở trong nhóm." });
            var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(3));
            var party = await store.CreatePartyAsync(user.AccountId(), code, ct);
            await groups.SyncAsync(user.AccountId(), CancellationToken.None);
            return Results.Ok(party);
        });
        group.MapPost("/party/join", async (JoinParty input, ClaimsPrincipal user, IGameStore store, GroupSyncService groups, CancellationToken ct) =>
        {
            if (input.Code?.Trim().Length != 6) return Results.BadRequest();
            if (!await store.JoinPartyAsync(user.AccountId(), input.Code.Trim(), ct))
                return Results.Conflict(new { error = "Mã nhóm sai, nhóm đầy hoặc bạn đã vào nhóm." });
            await groups.SyncAsync(user.AccountId(), CancellationToken.None);
            return Results.Ok(await store.PartyForAsync(user.AccountId(), ct));
        });
        group.MapPost("/party/leave", async (ClaimsPrincipal user, IGameStore store, GroupSyncService groups, CancellationToken ct) =>
        {
            await store.LeavePartyAsync(user.AccountId(), ct);
            await groups.SyncAsync(user.AccountId(), CancellationToken.None);
            return Results.NoContent();
        });
        group.MapGet("/messages/{channel}", async (string channel, string? target, ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var id = user.AccountId();
            string scope;
            if (channel == "world") scope = "world";
            else if (channel == "party") scope = (await store.PartyForAsync(id, ct))?.Id.ToString() ?? "";
            else if (channel == "guild") scope = (await store.GuildForAsync(id, ct))?.Id.ToString() ?? "";
            else if (channel == "dm")
            {
                var recipient = await store.AccountByNameAsync(target ?? "", ct);
                scope = recipient is null ? "" : GameHub.DirectScope(id, recipient.Id);
            }
            else return Results.BadRequest();
            return scope.Length == 0 ? Results.Ok(Array.Empty<ChatEntry>()) : Results.Ok(await store.MessagesAsync(channel, scope, 50, ct));
        });
    }
}
