using Game3d.Application;
using Microsoft.Data.Sqlite;

namespace Game3d.Infrastructure.Persistence;

public sealed partial class SqliteGameStore
{
    private const string GuildSelect = "SELECT g.id,g.name,g.leader_id,(SELECT count(*) FROM guild_members WHERE guild_id=g.id) FROM guilds g";
    private static GuildRecord ReadGuild(SqliteDataReader reader) => new(Id(reader, 0), reader.GetString(1), Id(reader, 2), reader.GetInt32(3));

    public async Task<GuildRecord?> GuildForAsync(Guid accountId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, GuildSelect + " JOIN guild_members m ON m.guild_id=g.id WHERE m.account_id=$id", ("$id", accountId.ToString()));
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadGuild(reader) : null;
    }

    public async Task<IReadOnlyList<GuildRecord>> GuildsAsync(CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, GuildSelect + " ORDER BY g.created_at DESC LIMIT 100");
        await using var reader = await command.ExecuteReaderAsync(ct);
        var result = new List<GuildRecord>();
        while (await reader.ReadAsync(ct)) result.Add(ReadGuild(reader));
        return result;
    }

    public async Task<GuildRecord?> GuildAsync(Guid id, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, GuildSelect + " WHERE g.id=$id", ("$id", id.ToString()));
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadGuild(reader) : null;
    }

    public async Task<bool> CreateGuildAsync(Guid leaderId, string name, CancellationToken ct)
    {
        var guildId = Guid.NewGuid();
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        try
        {
            await using var create = Command(connection,
                "INSERT INTO guilds(id,name,leader_id,created_at) VALUES($id,$name,$leader,$now)",
                ("$id", guildId.ToString()), ("$name", name), ("$leader", leaderId.ToString()),
                ("$now", DateTimeOffset.UtcNow.ToString("O")));
            create.Transaction = transaction;
            await create.ExecuteNonQueryAsync(ct);
            await using var join = Command(connection,
                "INSERT INTO guild_members(guild_id,account_id,role,joined_at) VALUES($guild,$account,'leader',$now)",
                ("$guild", guildId.ToString()), ("$account", leaderId.ToString()),
                ("$now", DateTimeOffset.UtcNow.ToString("O")));
            join.Transaction = transaction;
            await join.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);
            return true;
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19) { return false; }
    }

    public async Task<bool> JoinGuildAsync(Guid accountId, Guid guildId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            """
            INSERT INTO guild_members(guild_id,account_id,role,joined_at)
            SELECT g.id,$account,'member',$now FROM guilds g WHERE g.id=$guild
            AND NOT EXISTS(SELECT 1 FROM guild_members WHERE account_id=$account)
            """, ("$guild", guildId.ToString()), ("$account", accountId.ToString()),
            ("$now", DateTimeOffset.UtcNow.ToString("O")));
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task LeaveGuildAsync(Guid accountId, CancellationToken ct)
    {
        var guild = await GuildForAsync(accountId, ct);
        if (guild is null) return;
        await using var connection = await OpenAsync(ct);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        await using var count = Command(connection,
            "SELECT count(*) FROM guild_members WHERE guild_id=$guild", ("$guild", guild.Id.ToString()));
        count.Transaction = transaction;
        if (Convert.ToInt32(await count.ExecuteScalarAsync(ct)) <= 1)
        {
            await using var delete = Command(connection, "DELETE FROM guilds WHERE id=$guild", ("$guild", guild.Id.ToString()));
            delete.Transaction = transaction;
            await delete.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);
            return;
        }
        await using var leave = Command(connection, "DELETE FROM guild_members WHERE account_id=$account", ("$account", accountId.ToString()));
        leave.Transaction = transaction;
        await leave.ExecuteNonQueryAsync(ct);
        await using var promote = Command(connection,
            "UPDATE guilds SET leader_id=(SELECT account_id FROM guild_members WHERE guild_id=$guild ORDER BY joined_at LIMIT 1) WHERE id=$guild AND leader_id=$account",
            ("$guild", guild.Id.ToString()), ("$account", accountId.ToString()));
        promote.Transaction = transaction;
        await promote.ExecuteNonQueryAsync(ct);
        await using var role = Command(connection,
            "UPDATE guild_members SET role='leader' WHERE guild_id=$guild AND account_id=(SELECT leader_id FROM guilds WHERE id=$guild)",
            ("$guild", guild.Id.ToString()));
        role.Transaction = transaction;
        await role.ExecuteNonQueryAsync(ct);
        await using var empty = Command(connection,
            "DELETE FROM guilds WHERE id=$guild AND NOT EXISTS(SELECT 1 FROM guild_members WHERE guild_id=$guild)",
            ("$guild", guild.Id.ToString()));
        empty.Transaction = transaction;
        await empty.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private const string WarSelect = "SELECT id,guild_a,guild_b,score_a,score_b,starts_at,ends_at FROM guild_wars";
    private static GuildWarRecord ReadWar(SqliteDataReader r) => new(Id(r, 0), Id(r, 1), Id(r, 2), r.GetInt32(3), r.GetInt32(4), DateTimeOffset.Parse(r.GetString(5)), DateTimeOffset.Parse(r.GetString(6)));

    public async Task<GuildWarRecord?> ActiveWarAsync(Guid guildA, Guid guildB, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, WarSelect + " WHERE ((guild_a=$a AND guild_b=$b) OR (guild_a=$b AND guild_b=$a)) AND ends_at>$now ORDER BY starts_at DESC LIMIT 1",
            ("$a", guildA.ToString()), ("$b", guildB.ToString()), ("$now", DateTimeOffset.UtcNow.ToString("O")));
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadWar(reader) : null;
    }

    public async Task<IReadOnlyList<GuildWarRecord>> WarsForAsync(Guid guildId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection, WarSelect + " WHERE guild_a=$id OR guild_b=$id ORDER BY starts_at DESC LIMIT 20", ("$id", guildId.ToString()));
        await using var reader = await command.ExecuteReaderAsync(ct);
        var result = new List<GuildWarRecord>();
        while (await reader.ReadAsync(ct)) result.Add(ReadWar(reader));
        return result;
    }

    public async Task<GuildWarRecord?> DeclareWarAsync(Guid leaderId, Guid targetGuildId, CancellationToken ct)
    {
        var own = await GuildForAsync(leaderId, ct);
        if (own is null || own.LeaderId != leaderId || own.Id == targetGuildId || await GuildAsync(targetGuildId, ct) is null) return null;
        if (await ActiveWarAsync(own.Id, targetGuildId, ct) is not null) return null;
        var now = DateTimeOffset.UtcNow;
        var war = new GuildWarRecord(Guid.NewGuid(), own.Id, targetGuildId, 0, 0, now, now.AddMinutes(10));
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "INSERT INTO guild_wars(id,guild_a,guild_b,starts_at,ends_at) VALUES($id,$a,$b,$starts,$ends)",
            ("$id", war.Id.ToString()), ("$a", own.Id.ToString()), ("$b", targetGuildId.ToString()),
            ("$starts", now.ToString("O")), ("$ends", war.EndsAt.ToString("O")));
        await command.ExecuteNonQueryAsync(ct);
        return war;
    }

    public async Task RecordWarKillAsync(Guid warId, Guid winnerGuildId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = Command(connection,
            "UPDATE guild_wars SET score_a=score_a+CASE WHEN guild_a=$guild THEN 1 ELSE 0 END, score_b=score_b+CASE WHEN guild_b=$guild THEN 1 ELSE 0 END WHERE id=$war AND ends_at>$now AND (guild_a=$guild OR guild_b=$guild)",
            ("$guild", winnerGuildId.ToString()), ("$war", warId.ToString()), ("$now", DateTimeOffset.UtcNow.ToString("O")));
        await command.ExecuteNonQueryAsync(ct);
    }
}
