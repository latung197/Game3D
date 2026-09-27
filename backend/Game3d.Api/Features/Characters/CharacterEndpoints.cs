using System.Security.Claims;
using Game3d.Api.Features.Accounts;
using Game3d.Application;
using Game3d.Application.Players;
using Game3d.Domain.Players;

namespace Game3d.Api.Features.Characters;

public static class CharacterEndpoints
{
    public sealed record CreateCharacter(string? Name, string? Element);
    public sealed record ChangeElement(string? Element);
    public sealed record Victory(string? EnemyId);
    public sealed record ImportGuest(Guid LegacyId);

    public static void MapCharacterEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/characters").RequireAuthorization();
        group.MapGet("", async (ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
            Results.Ok(await store.CharactersAsync(user.AccountId(), ct)));
        group.MapGet("/selected", async (ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var character = await store.SelectedCharacterAsync(user.AccountId(), ct);
            return character is null ? Results.NotFound() : Results.Ok(Snapshot(character));
        });
        group.MapPost("", async (CreateCharacter input, ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var name = input.Name?.Trim() ?? "";
            var element = ElementCatalog.Find(input.Element);
            if (name.Length is < 2 or > 20 || name.Any(char.IsControl) || element is null)
                return Results.BadRequest(new { error = "Tên hoặc hệ nhân vật không hợp lệ." });
            var character = new CharacterRecord(Guid.NewGuid(), user.AccountId(), name, element.Id, 1, 0, 0,
                element.BaseHealth, 0, 0);
            return await store.CreateCharacterAsync(character, ct)
                ? Results.Created($"/api/characters/{character.Id}", Snapshot(character))
                : Results.Conflict(new { error = "Tên đã dùng hoặc tài khoản đã đủ 3 nhân vật." });
        });
        group.MapPost("/import-guest", async (ImportGuest input, ClaimsPrincipal user, IGameStore store, PlayerService legacy, CancellationToken ct) =>
        {
            if ((await store.CharactersAsync(user.AccountId(), ct)).Count >= 3) return Results.Conflict(new { error = "Đã đủ 3 nhân vật." });
            var old = await legacy.GetAsync(input.LegacyId, ct);
            if (old is null) return Results.NotFound();
            var character = new CharacterRecord(Guid.NewGuid(), user.AccountId(), old.Name, old.Element,
                old.Level, old.Experience, old.Gold, old.MaxHealth, old.TotalKills, old.QuestKills);
            return await store.ImportGuestAsync(input.LegacyId, character, ct)
                ? Results.Ok(Snapshot(character))
                : Results.Conflict(new { error = "Nhân vật đã được nhập hoặc tên đã dùng." });
        });
        group.MapPost("/{id:guid}/select", async (Guid id, ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
            await store.SelectCharacterAsync(user.AccountId(), id, ct) ? Results.NoContent() : Results.NotFound());
        group.MapPut("/{id:guid}/element", async (Guid id, ChangeElement input, ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var character = await Owned(id, user, store, ct);
            var element = ElementCatalog.Find(input.Element);
            if (character is null) return Results.NotFound();
            if (element is null) return Results.BadRequest();
            var max = Player.MaxHealthFor(element, character.Level);
            character = character with { Element = element.Id, MaxHealth = max };
            await store.SaveCharacterAsync(character, ct);
            return Results.Ok(Snapshot(character));
        });
        group.MapPost("/{id:guid}/victories", async (Guid id, Victory input, ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var character = await Owned(id, user, store, ct);
            var enemy = EnemyCatalog.Find(input.EnemyId ?? "");
            if (character is null) return Results.NotFound();
            if (enemy is null) return Results.BadRequest();
            var player = Player.Restore(Snapshot(character));
            player.RecordVictory(enemy);
            var updated = character with {
                Level = player.State.Level, Experience = player.State.Experience, Gold = player.State.Gold,
                MaxHealth = player.State.MaxHealth, TotalKills = player.State.TotalKills, QuestKills = player.State.QuestKills
            };
            await store.SaveCharacterAsync(updated, ct);
            return Results.Ok(player.State);
        });
    }

    private static async Task<CharacterRecord?> Owned(Guid id, ClaimsPrincipal user, IGameStore store, CancellationToken ct)
    {
        var character = await store.CharacterAsync(id, ct);
        return character?.AccountId == user.AccountId() ? character : null;
    }
    private static PlayerSnapshot Snapshot(CharacterRecord c) => new(c.Id, c.Name, c.Level, c.Experience,
        c.Gold, c.MaxHealth, c.MaxHealth, c.TotalKills, c.QuestKills, c.Element);
}
