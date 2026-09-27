using Game3d.Application.Players;
using Game3d.Domain.Players;

namespace Game3d.Api.Features.Players;

public static class PlayerEndpoints
{
    public static void MapPlayerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api");

        group.MapGet("/world", () => Results.Ok(new
        {
            name = "Trúc Lâm Bí Cảnh",
            enemies = EnemyCatalog.All,
            elements = ElementCatalog.All,
            quest = new { id = "first_steps", title = "Thử thách nhập môn", target = 5, enemyId = "forest_slime" }
        }));

        group.MapPost("/players", async (CreatePlayerRequest request, PlayerService service, CancellationToken ct) =>
        {
            try
            {
                var player = await service.CreateAsync(request.Name, request.Element, ct);
                return Results.Created($"/api/players/{player.Id}", player);
            }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        group.MapGet("/players/{id:guid}", async (Guid id, PlayerService service, CancellationToken ct) =>
        {
            var player = await service.GetAsync(id, ct);
            return player is null ? Results.NotFound() : Results.Ok(player);
        });

        group.MapPut("/players/{id:guid}/element", async (
            Guid id, ChangeElementRequest request, PlayerService service, CancellationToken ct) =>
        {
            try
            {
                var player = await service.ChangeElementAsync(id, request.Element, ct);
                return player is null ? Results.NotFound() : Results.Ok(player);
            }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        group.MapPost("/players/{id:guid}/victories", async (
            Guid id, VictoryRequest request, PlayerService service, CancellationToken ct) =>
        {
            try
            {
                var player = await service.RecordVictoryAsync(id, request.EnemyId, ct);
                return player is null ? Results.NotFound() : Results.Ok(player);
            }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        group.MapGet("/leaderboard", async (PlayerService service, CancellationToken ct) =>
        {
            var leaders = await service.TopAsync(ct);
            return Results.Ok(leaders.Select(player => new
            {
                player.Name, player.Level, player.TotalKills, player.Experience, player.Element
            }));
        });
    }

    public sealed record CreatePlayerRequest(string? Name, string? Element);
    public sealed record ChangeElementRequest(string? Element);
    public sealed record VictoryRequest(string EnemyId);
}
