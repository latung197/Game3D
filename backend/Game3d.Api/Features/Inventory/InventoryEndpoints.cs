using System.Security.Claims;
using Game3d.Api.Features.Accounts;
using Game3d.Application;
using Game3d.Domain.Inventory;

namespace Game3d.Api.Features.Inventory;

public static class InventoryEndpoints
{
    public sealed record EquipRequest(Guid EntryId);
    public static void MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/inventory").RequireAuthorization();
        group.MapGet("/catalog", () => Results.Ok(ItemCatalog.All));
        group.MapGet("", async (ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var character = await store.SelectedCharacterAsync(user.AccountId(), ct);
            return character is null ? Results.Conflict(new { error = "Chưa chọn nhân vật." }) : Results.Ok(await store.InventoryAsync(character.Id, ct));
        });
        group.MapPost("/equip", async (EquipRequest input, ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var character = await store.SelectedCharacterAsync(user.AccountId(), ct);
            if (character is null) return Results.Conflict();
            var inventory = await store.InventoryAsync(character.Id, ct);
            var entry = inventory.FirstOrDefault(item => item.Id == input.EntryId);
            var definition = entry is null ? null : ItemCatalog.Find(entry.ItemId);
            if (definition is null) return Results.NotFound();
            return await store.EquipAsync(character.Id, entry!.Id, definition.Slot, ct) ? Results.NoContent() : Results.Conflict();
        });
        group.MapPost("/unequip/{slot}", async (string slot, ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var character = await store.SelectedCharacterAsync(user.AccountId(), ct);
            if (character is null || !new[] { "weapon", "armor", "ring" }.Contains(slot)) return Results.BadRequest();
            return await store.UnequipAsync(character.Id, slot, ct) ? Results.NoContent() : Results.NotFound();
        });
    }
}
