using Game3d.Application;
using Microsoft.Data.Sqlite;

namespace Game3d.Infrastructure.Persistence;

public sealed partial class SqliteGameStore
{
    private static AccountRecord ReadAccount(SqliteDataReader reader) => new(
        Id(reader, 0), reader.GetString(1), reader.GetString(2), reader.GetString(3), OptionalId(reader, 4));

    private async Task<AccountRecord?> FindAccountAsync(string sql, string value, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, sql, ("$value", value));
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadAccount(reader) : null;
    }

    private const string AccountColumns = "SELECT id,email,display_name,password_hash,selected_character_id FROM accounts";

    public Task<AccountRecord?> AccountByEmailAsync(string email, CancellationToken ct) =>
        FindAccountAsync(AccountColumns + " WHERE email=$value COLLATE NOCASE", email, ct);

    public Task<AccountRecord?> AccountByIdAsync(Guid id, CancellationToken ct) =>
        FindAccountAsync(AccountColumns + " WHERE id=$value", id.ToString(), ct);

    public Task<AccountRecord?> AccountByNameAsync(string name, CancellationToken ct) =>
        FindAccountAsync(AccountColumns + " WHERE display_name=$value COLLATE NOCASE", name, ct);

    public async Task<bool> CreateAccountAsync(AccountRecord account, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "INSERT INTO accounts(id,email,display_name,password_hash,created_at) VALUES($id,$email,$name,$hash,$now)",
            ("$id", account.Id.ToString()), ("$email", account.Email), ("$name", account.DisplayName),
            ("$hash", account.PasswordHash), ("$now", DateTimeOffset.UtcNow.ToString("O")));
        try { return await command.ExecuteNonQueryAsync(ct) == 1; }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19) { return false; }
    }

    private static CharacterRecord ReadCharacter(SqliteDataReader reader) => new(
        Id(reader, 0), Id(reader, 1), reader.GetString(2), reader.GetString(3),
        reader.GetInt32(4), reader.GetInt32(5), reader.GetInt32(6), reader.GetInt32(7),
        reader.GetInt32(8), reader.GetInt32(9));

    private const string CharacterColumns =
        "SELECT id,account_id,name,element,level,experience,gold,max_health,total_kills,quest_kills FROM characters";

    public async Task<IReadOnlyList<CharacterRecord>> CharactersAsync(Guid accountId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, CharacterColumns + " WHERE account_id=$id ORDER BY created_at",
            ("$id", accountId.ToString()));
        await using var reader = await command.ExecuteReaderAsync(ct);
        var result = new List<CharacterRecord>();
        while (await reader.ReadAsync(ct)) result.Add(ReadCharacter(reader));
        return result;
    }

    public async Task<CharacterRecord?> CharacterAsync(Guid id, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, CharacterColumns + " WHERE id=$id", ("$id", id.ToString()));
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadCharacter(reader) : null;
    }

    public async Task<CharacterRecord?> SelectedCharacterAsync(Guid accountId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, CharacterColumns +
            " WHERE id=(SELECT selected_character_id FROM accounts WHERE id=$id) AND account_id=$id",
            ("$id", accountId.ToString()));
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadCharacter(reader) : null;
    }

    public async Task<bool> CreateCharacterAsync(CharacterRecord character, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        await using var count = Command(connection,
            "SELECT count(*) FROM characters WHERE account_id=$id", ("$id", character.AccountId.ToString()));
        count.Transaction = (SqliteTransaction)transaction;
        if (Convert.ToInt32(await count.ExecuteScalarAsync(ct)) >= 3) return false;
        try
        {
            await InsertCharacterAsync(connection, (SqliteTransaction)transaction, character, ct);
            await GiveStarterItemsAsync(connection, (SqliteTransaction)transaction, character.Id, ct);
            await using var select = Command(connection,
                "UPDATE accounts SET selected_character_id=COALESCE(selected_character_id,$char) WHERE id=$user",
                ("$char", character.Id.ToString()), ("$user", character.AccountId.ToString()));
            select.Transaction = (SqliteTransaction)transaction;
            await select.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);
            return true;
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19) { return false; }
    }

    private static async Task InsertCharacterAsync(SqliteConnection connection, SqliteTransaction transaction,
        CharacterRecord character, CancellationToken ct)
    {
        await using var insert = Command(connection,
            """
            INSERT INTO characters(id,account_id,name,element,level,experience,gold,max_health,total_kills,quest_kills,created_at)
            VALUES($id,$account,$name,$element,$level,$xp,$gold,$hp,$kills,$quest,$now)
            """,
            ("$id", character.Id.ToString()), ("$account", character.AccountId.ToString()),
            ("$name", character.Name), ("$element", character.Element), ("$level", character.Level),
            ("$xp", character.Experience), ("$gold", character.Gold), ("$hp", character.MaxHealth),
            ("$kills", character.TotalKills), ("$quest", character.QuestKills),
            ("$now", DateTimeOffset.UtcNow.ToString("O")));
        insert.Transaction = transaction;
        await insert.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> SelectCharacterAsync(Guid accountId, Guid characterId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            """
            UPDATE accounts SET selected_character_id=$character
            WHERE id=$account AND EXISTS(SELECT 1 FROM characters WHERE id=$character AND account_id=$account)
            """, ("$character", characterId.ToString()), ("$account", accountId.ToString()));
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task<bool> SaveCharacterAsync(CharacterRecord character, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            """
            UPDATE characters SET element=$element,level=$level,experience=$xp,gold=$gold,
              max_health=$hp,total_kills=$kills,quest_kills=$quest WHERE id=$id AND account_id=$account
            """,
            ("$id", character.Id.ToString()), ("$account", character.AccountId.ToString()),
            ("$element", character.Element), ("$level", character.Level), ("$xp", character.Experience),
            ("$gold", character.Gold), ("$hp", character.MaxHealth),
            ("$kills", character.TotalKills), ("$quest", character.QuestKills));
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task<bool> ImportGuestAsync(Guid legacyId, CharacterRecord character, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        try
        {
            await InsertCharacterAsync(connection, (SqliteTransaction)transaction, character, ct);
            await GiveStarterItemsAsync(connection, (SqliteTransaction)transaction, character.Id, ct);
            await using var mark = Command(connection,
                "INSERT INTO guest_imports(legacy_id,account_id,character_id) VALUES($legacy,$account,$char)",
                ("$legacy", legacyId.ToString()), ("$account", character.AccountId.ToString()),
                ("$char", character.Id.ToString()));
            mark.Transaction = (SqliteTransaction)transaction;
            await mark.ExecuteNonQueryAsync(ct);
            await using var select = Command(connection,
                "UPDATE accounts SET selected_character_id=$char WHERE id=$account",
                ("$char", character.Id.ToString()), ("$account", character.AccountId.ToString()));
            select.Transaction = (SqliteTransaction)transaction;
            await select.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);
            return true;
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19) { return false; }
    }
}
