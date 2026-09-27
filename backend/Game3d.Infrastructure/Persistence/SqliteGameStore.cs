using Microsoft.Data.Sqlite;
using Game3d.Application;

namespace Game3d.Infrastructure.Persistence;

public sealed partial class SqliteGameStore : IGameStore
{
    private readonly string _connectionString;

    public SqliteGameStore(string filePath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(filePath))!);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = Path.GetFullPath(filePath),
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared,
            ForeignKeys = true,
            DefaultTimeout = 5
        }.ToString();
    }

    private async Task<SqliteConnection> OpenAsync(CancellationToken ct)
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }

    private static SqliteCommand Command(SqliteConnection connection, string sql, params (string, object?)[] parameters)
    {
        var command = connection.CreateCommand();
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
            command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        return command;
    }

    private static Guid Id(SqliteDataReader reader, int index) => Guid.Parse(reader.GetString(index));
    private static Guid? OptionalId(SqliteDataReader reader, int index) =>
        reader.IsDBNull(index) ? null : Id(reader, index);

    public async Task InitializeAsync(CancellationToken ct = default)
    {
        await using var connection = await OpenAsync(ct);
        await using (var pragma = Command(connection, "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;"))
            await pragma.ExecuteNonQueryAsync(ct);
        await using var versionCommand = Command(connection, "PRAGMA user_version;");
        var version = Convert.ToInt32(await versionCommand.ExecuteScalarAsync(ct));
        if (version >= 1) return;
        await using var transaction = await connection.BeginTransactionAsync(ct);
        await using var schema = Command(connection, SchemaV1);
        schema.Transaction = (SqliteTransaction)transaction;
        await schema.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private const string SchemaV1 = """
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
          selected_character_id TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS characters (
          id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
          name TEXT NOT NULL UNIQUE COLLATE NOCASE, element TEXT NOT NULL,
          level INTEGER NOT NULL, experience INTEGER NOT NULL, gold INTEGER NOT NULL,
          max_health INTEGER NOT NULL, total_kills INTEGER NOT NULL, quest_kills INTEGER NOT NULL,
          created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS ix_characters_account ON characters(account_id);
        CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(id),
          item_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0),
          equipped_slot TEXT, created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS ix_inventory_character ON inventory(character_id);
        CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_equipped ON inventory(character_id,equipped_slot)
          WHERE equipped_slot IS NOT NULL;
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY, sender_id TEXT NOT NULL REFERENCES accounts(id),
          sender_name TEXT NOT NULL, channel TEXT NOT NULL, scope_id TEXT NOT NULL,
          text TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS ix_messages_channel ON messages(channel,scope_id,created_at DESC);
        CREATE TABLE IF NOT EXISTS parties (
          id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, leader_id TEXT NOT NULL,
          created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS party_members (
          party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
          account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id), joined_at TEXT NOT NULL,
          PRIMARY KEY(party_id,account_id));
        CREATE TABLE IF NOT EXISTS guilds (
          id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          leader_id TEXT NOT NULL REFERENCES accounts(id), created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS guild_members (
          guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
          account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id), role TEXT NOT NULL,
          joined_at TEXT NOT NULL, PRIMARY KEY(guild_id,account_id));
        CREATE TABLE IF NOT EXISTS guild_wars (
          id TEXT PRIMARY KEY, guild_a TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
          guild_b TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE, score_a INTEGER NOT NULL DEFAULT 0,
          score_b INTEGER NOT NULL DEFAULT 0, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS ix_wars_end ON guild_wars(ends_at);
        CREATE TABLE IF NOT EXISTS guest_imports (
          legacy_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
          character_id TEXT NOT NULL REFERENCES characters(id));
        PRAGMA user_version=1;
        """;
}
