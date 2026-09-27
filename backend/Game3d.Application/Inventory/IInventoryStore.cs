namespace Game3d.Application;

public interface IInventoryStore
{
    Task<IReadOnlyList<InventoryEntry>> InventoryAsync(Guid characterId, CancellationToken ct);
    Task AddItemAsync(Guid characterId, string itemId, int quantity, CancellationToken ct);
    Task<bool> EquipAsync(Guid characterId, Guid entryId, string slot, CancellationToken ct);
    Task<bool> UnequipAsync(Guid characterId, string slot, CancellationToken ct);
}
