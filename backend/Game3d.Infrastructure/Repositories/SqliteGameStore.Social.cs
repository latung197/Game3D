using Game3d.Application;
using Microsoft.Data.Sqlite;

namespace Game3d.Infrastructure.Persistence;

public sealed partial class SqliteGameStore
{
    public async Task<ChatEntry> AddMessageAsync(ChatEntry message, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "INSERT INTO messages(id,sender_id,sender_name,channel,scope_id,text,created_at) VALUES($id,$sender,$name,$channel,$scope,$text,$now)",
            ("$id", message.Id.ToString()), ("$sender", message.SenderId.ToString()),
            ("$name", message.SenderName), ("$channel", message.Channel), ("$scope", message.ScopeId),
            ("$text", message.Text), ("$now", message.CreatedAt.ToString("O")));
        await command.ExecuteNonQueryAsync(ct);
        return message;
    }

    public async Task<IReadOnlyList<ChatEntry>> MessagesAsync(string channel, string scopeId, int limit, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "SELECT id,sender_id,sender_name,channel,scope_id,text,created_at FROM messages WHERE channel=$channel AND scope_id=$scope ORDER BY created_at DESC LIMIT $limit",
            ("$channel", channel), ("$scope", scopeId), ("$limit", Math.Clamp(limit, 1, 100)));
        await using var reader = await command.ExecuteReaderAsync(ct);
        var result = new List<ChatEntry>();
        while (await reader.ReadAsync(ct))
            result.Add(new ChatEntry(Id(reader, 0), Id(reader, 1), reader.GetString(2), reader.GetString(3),
                reader.GetString(4), reader.GetString(5), DateTimeOffset.Parse(reader.GetString(6))));
        result.Reverse();
        return result;
    }

    public async Task<IReadOnlyList<OnlineProfile>> PlayerDirectoryAsync(int limit, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            """
            SELECT a.id,a.display_name,c.id,c.name,c.element,COALESCE(c.level,0),gm.guild_id
            FROM accounts a LEFT JOIN characters c ON c.id=a.selected_character_id
            LEFT JOIN guild_members gm ON gm.account_id=a.id
            ORDER BY a.created_at DESC LIMIT $limit
            """, ("$limit", Math.Clamp(limit, 1, 100)));
        await using var reader = await command.ExecuteReaderAsync(ct);
        var result = new List<OnlineProfile>();
        while (await reader.ReadAsync(ct))
            result.Add(new OnlineProfile(Id(reader, 0), reader.GetString(1), OptionalId(reader, 2),
                reader.IsDBNull(3) ? null : reader.GetString(3), reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetInt32(5), OptionalId(reader, 6)));
        return result;
    }

    public async Task<PartyRecord?> PartyForAsync(Guid accountId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "SELECT p.id,p.code,p.leader_id,(SELECT count(*) FROM party_members WHERE party_id=p.id) FROM parties p JOIN party_members m ON m.party_id=p.id WHERE m.account_id=$id",
            ("$id", accountId.ToString()));
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? new PartyRecord(Id(reader, 0), reader.GetString(1), Id(reader, 2), reader.GetInt32(3)) : null;
    }

    public async Task<PartyRecord> CreatePartyAsync(Guid leaderId, string code, CancellationToken ct)
    {
        var party = new PartyRecord(Guid.NewGuid(), code, leaderId, 1);
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        await using var create = Command(connection,
            "INSERT INTO parties(id,code,leader_id,created_at) VALUES($id,$code,$leader,$now)",
            ("$id", party.Id.ToString()), ("$code", code), ("$leader", leaderId.ToString()),
            ("$now", DateTimeOffset.UtcNow.ToString("O")));
        create.Transaction = transaction;
        await create.ExecuteNonQueryAsync(ct);
        await using var join = Command(connection,
            "INSERT INTO party_members(party_id,account_id,joined_at) VALUES($party,$account,$now)",
            ("$party", party.Id.ToString()), ("$account", leaderId.ToString()),
            ("$now", DateTimeOffset.UtcNow.ToString("O")));
        join.Transaction = transaction;
        await join.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
        return party;
    }

    public async Task<bool> JoinPartyAsync(Guid accountId, string code, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            """
            INSERT INTO party_members(party_id,account_id,joined_at)
            SELECT p.id,$account,$now FROM parties p WHERE p.code=$code
            AND (SELECT count(*) FROM party_members WHERE party_id=p.id)<5
            AND NOT EXISTS(SELECT 1 FROM party_members WHERE account_id=$account)
            """, ("$account", accountId.ToString()), ("$code", code.ToUpperInvariant()),
            ("$now", DateTimeOffset.UtcNow.ToString("O")));
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task LeavePartyAsync(Guid accountId, CancellationToken ct)
    {
        var party = await PartyForAsync(accountId, ct);
        if (party is null) return;
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        await using var remove = Command(connection,
            "DELETE FROM party_members WHERE account_id=$account", ("$account", accountId.ToString()));
        remove.Transaction = transaction;
        await remove.ExecuteNonQueryAsync(ct);
        await using var empty = Command(connection,
            "DELETE FROM parties WHERE id=$party AND NOT EXISTS(SELECT 1 FROM party_members WHERE party_id=$party)",
            ("$party", party.Id.ToString()));
        empty.Transaction = transaction;
        await empty.ExecuteNonQueryAsync(ct);
        await using var promote = Command(connection,
            "UPDATE parties SET leader_id=(SELECT account_id FROM party_members WHERE party_id=$party ORDER BY joined_at LIMIT 1) WHERE id=$party AND leader_id=$account",
            ("$party", party.Id.ToString()), ("$account", accountId.ToString()));
        promote.Transaction = transaction;
        await promote.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
