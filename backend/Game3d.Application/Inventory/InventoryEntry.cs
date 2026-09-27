namespace Game3d.Application;

public sealed record InventoryEntry(Guid Id, Guid CharacterId, string ItemId, int Quantity, string? EquippedSlot);
