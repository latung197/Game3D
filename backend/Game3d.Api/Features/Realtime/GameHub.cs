using Game3d.Api.Features.Accounts;
using Game3d.Application;
using Game3d.Domain.Social;
using Game3d.Domain.Players;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Game3d.Api.Features.Realtime;

[Authorize]
public sealed class GameHub(IGameStore store, PvpArena arena) : Hub
{
    public override async Task OnConnectedAsync()
    {
        arena.RegisterConnection(Context.User!.AccountId(), Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, "world");
        await RefreshGroups();
        await Clients.Caller.SendAsync("ArenaSnapshot", arena.Snapshot());
        await base.OnConnectedAsync();
    }
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var id = Context.User!.AccountId();
        if (arena.Leave(id, Context.ConnectionId)) await Clients.All.SendAsync("PlayerLeft", id);
        await base.OnDisconnectedAsync(exception);
    }
    public async Task RefreshGroups()
    {
        var id = Context.User!.AccountId();
        var party = await store.PartyForAsync(id, Context.ConnectionAborted);
        var guild = await store.GuildForAsync(id, Context.ConnectionAborted);
        foreach (var group in arena.GroupsFor(Context.ConnectionId)) await Groups.RemoveFromGroupAsync(Context.ConnectionId, group);
        var groups = new List<string>();
        if (party is not null) groups.Add($"party:{party.Id}");
        if (guild is not null) groups.Add($"guild:{guild.Id}");
        foreach (var group in groups) await Groups.AddToGroupAsync(Context.ConnectionId, group);
        arena.SetGroups(Context.ConnectionId, groups);
    }
    public static string DirectScope(Guid a, Guid b) =>
        string.CompareOrdinal(a.ToString(), b.ToString()) < 0 ? $"{a}:{b}" : $"{b}:{a}";

    public async Task SendChat(string channel, string target, string text)
    {
        text = ChatRules.Normalize(text);
        if (!ChatRules.IsValid(text))
            throw new HubException("Tin nhắn phải từ 1 đến 300 ký tự.");
        var id = Context.User!.AccountId();
        if (!arena.AllowChat(id)) throw new HubException("Bạn gửi tin quá nhanh.");
        Guid? recipient = null;
        string scope = channel switch
        {
            "world" => "world",
            "party" => (await store.PartyForAsync(id, Context.ConnectionAborted))?.Id.ToString() ?? throw new HubException("Bạn chưa vào nhóm."),
            "guild" => (await store.GuildForAsync(id, Context.ConnectionAborted))?.Id.ToString() ?? throw new HubException("Bạn chưa vào bang hội."),
            "dm" => "",
            _ => throw new HubException("Kênh chat không hợp lệ.")
        };
        if (channel == "dm")
        {
            var account = await store.AccountByNameAsync(target?.Trim() ?? "", Context.ConnectionAborted)
                ?? throw new HubException("Không tìm thấy tài khoản nhận.");
            recipient = account.Id;
            scope = DirectScope(id, account.Id);
        }
        var sender = await store.AccountByIdAsync(id, Context.ConnectionAborted)
            ?? throw new HubException("Tài khoản không tồn tại.");
        var message = await store.AddMessageAsync(new ChatEntry(Guid.NewGuid(), id, sender.DisplayName,
            channel, scope, text, DateTimeOffset.UtcNow), Context.ConnectionAborted);
        if (channel == "dm") await Clients.Users(id.ToString(), recipient!.Value.ToString()).SendAsync("ChatMessage", message);
        else await Clients.Group(channel == "world" ? "world" : $"{channel}:{scope}").SendAsync("ChatMessage", message);
    }
    public async Task<ArenaPlayer> EnterArena(bool pkEnabled)
    {
        var id = Context.User!.AccountId();
        var character = await store.SelectedCharacterAsync(id, Context.ConnectionAborted)
            ?? throw new HubException("Chưa chọn nhân vật.");
        var inventory = await store.InventoryAsync(character.Id, Context.ConnectionAborted);
        var state = arena.Enter(id, Context.ConnectionId, character, inventory, pkEnabled);
        await Clients.All.SendAsync("PlayerMoved", state);
        var control = arena.ControlFor(id, Context.ConnectionId);
        if (control.RootSeconds > 0 || control.SlowSeconds > 0 || control.HasteSeconds > 0)
            await Clients.Caller.SendAsync("ControlStatus", control.RootSeconds, control.SlowSeconds, control.HasteSeconds);
        return state;
    }
    public async Task Move(float x, float z)
    {
        var state = arena.Move(Context.User!.AccountId(), Context.ConnectionId, x, z);
        if (state is not null) await Clients.Others.SendAsync("PlayerMoved", state);
    }
    public async Task SetPk(bool enabled)
    {
        var state = arena.SetPk(Context.User!.AccountId(), Context.ConnectionId, enabled);
        if (state is not null) await Clients.All.SendAsync("PlayerMoved", state);
    }
    public async Task Guard()
    {
        var state = arena.Guard(Context.User!.AccountId(), Context.ConnectionId);
        if (state is null) return;
        await Clients.All.SendAsync("PlayerGuarded", Context.User!.AccountId());
        await Clients.All.SendAsync("PlayerMoved", state);
        var haste = PvpCombatCatalog.For(state.Element).GuardHasteSeconds;
        if (haste > 0) await Clients.Caller.SendAsync("ControlStatus", 0, 0, haste);
    }
    public async Task Attack(Guid targetId, bool skill)
    {
        var attacker = Context.User!.AccountId();
        var ownGuild = await store.GuildForAsync(attacker, Context.ConnectionAborted);
        var targetGuild = await store.GuildForAsync(targetId, Context.ConnectionAborted);
        GuildWarRecord? war = null;
        if (ownGuild is not null && targetGuild is not null && ownGuild.Id != targetGuild.Id)
            war = await store.ActiveWarAsync(ownGuild.Id, targetGuild.Id, Context.ConnectionAborted);
        var result = arena.Attack(attacker, Context.ConnectionId, targetId, skill, war is not null,
            ownGuild is not null && ownGuild.Id == targetGuild?.Id);
        if (result is null) return;
        if (result.Hit.Killed && war is not null && ownGuild is not null)
            await store.RecordWarKillAsync(war.Id, ownGuild.Id, Context.ConnectionAborted);
        if (result.CounterHit?.Killed == true && war is not null && targetGuild is not null)
            await store.RecordWarKillAsync(war.Id, targetGuild.Id, Context.ConnectionAborted);
        await Clients.All.SendAsync("PlayerHit", result.Hit);
        if (result.CounterHit is not null) await Clients.All.SendAsync("PlayerHit", result.CounterHit);
        await Clients.All.SendAsync("PlayerMoved", result.Attacker);
        await Clients.All.SendAsync("PlayerMoved", result.Target);
        if (result.TargetRootSeconds > 0 || result.TargetSlowSeconds > 0)
            await Clients.User(targetId.ToString()).SendAsync("ControlStatus", result.TargetRootSeconds, result.TargetSlowSeconds, 0);
        if (result.AttackerRootSeconds > 0 || result.AttackerHasteSeconds > 0)
            await Clients.Caller.SendAsync("ControlStatus", result.AttackerRootSeconds, 0, result.AttackerHasteSeconds);
    }
}
