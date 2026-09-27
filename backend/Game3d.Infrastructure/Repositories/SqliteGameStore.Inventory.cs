using Game3d.Application;
using Microsoft.Data.Sqlite;

namespace Game3d.Infrastructure.Persistence;

public sealed partial class SqliteGameStore
{
    private static async Task GiveStarterItemsAsync(SqliteConnection connection, SqliteTransaction transaction, Guid characterId, CancellationToken ct)
    {
        foreach (var item in new[] { "bamboo_sword", "traveler_robe" })
        {
            await using var command = Command(connection,
                "INSERT INTO inventory(id,character_id,item_id,quantity,created_at) VALUES($id,$char,$item,1,$now)",
                ("$id", Guid.NewGuid().ToString()), ("$char", characterId.ToString()),
                ("$item", item), ("$now", DateTimeOffset.UtcNow.ToString("O")));
            command.Transaction = transaction;
            await command.ExecuteNonQueryAsync(ct);
        }
    }

    public async Task<IReadOnlyList<InventoryEntry>> InventoryAsync(Guid characterId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "SELECT id,character_id,item_id,quantity,equipped_slot FROM inventory WHERE character_id=$id ORDER BY created_at",
            ("$id", characterId.ToString()));
        await using var reader = await command.ExecuteReaderAsync(ct);
        var result = new List<InventoryEntry>();
        while (await reader.ReadAsync(ct))
            result.Add(new InventoryEntry(Id(reader, 0), Id(reader, 1), reader.GetString(2), reader.GetInt32(3),
                reader.IsDBNull(4) ? null : reader.GetString(4)));
        return result;
    }

    public async Task AddItemAsync(Guid characterId, string itemId, int quantity, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "INSERT INTO inventory(id,character_id,item_id,quantity,created_at) VALUES($id,$char,$item,$quantity,$now)",
            ("$id", Guid.NewGuid().ToString()), ("$char", characterId.ToString()), ("$item", itemId),
            ("$quantity", quantity), ("$now", DateTimeOffset.UtcNow.ToString("O")));
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> EquipAsync(Guid characterId, Guid entryId, string slot, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        await using var exists = Command(connection,
            "SELECT count(*) FROM inventory WHERE id=$entry AND character_id=$char",
            ("$entry", entryId.ToString()), ("$char", characterId.ToString()));
        exists.Transaction = transaction;
        if (Convert.ToInt32(await exists.ExecuteScalarAsync(ct)) != 1) return false;
        await using var clear = Command(connection,
            "UPDATE inventory SET equipped_slot=NULL WHERE character_id=$char AND equipped_slot=$slot",
            ("$char", characterId.ToString()), ("$slot", slot));
        clear.Transaction = transaction;
        await clear.ExecuteNonQueryAsync(ct);
        await using var equip = Command(connection,
            "UPDATE inventory SET equipped_slot=$slot WHERE id=$entry AND character_id=$char",
            ("$slot", slot), ("$entry", entryId.ToString()), ("$char", characterId.ToString()));
        equip.Transaction = transaction;
        var success = await equip.ExecuteNonQueryAsync(ct) == 1;
        await transaction.CommitAsync(ct);
        return success;
    }

    public async Task<bool> UnequipAsync(Guid characterId, string slot, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "UPDATE inventory SET equipped_slot=NULL WHERE character_id=$char AND equipped_slot=$slot",
            ("$char", characterId.ToString()), ("$slot", slot));
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }
}
