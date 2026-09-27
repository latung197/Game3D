using Game3d.Application;
using Game3d.Domain.Players;
using Game3d.Domain.Inventory;

namespace Game3d.Api.Features.Realtime;

public sealed record ArenaPlayer(Guid AccountId, Guid CharacterId, string Name, string Element,
    float X, float Z, int Health, int MaxHealth, bool PkEnabled);
public sealed record ArenaHit(Guid AttackerId, Guid TargetId, int Damage, int Health, bool Killed, bool Skill);
public sealed record ArenaAttackResult(ArenaHit Hit, ArenaHit? CounterHit, ArenaPlayer Attacker, ArenaPlayer Target,
    double TargetRootSeconds = 0, double TargetSlowSeconds = 0, double AttackerRootSeconds = 0,
    double AttackerHasteSeconds = 0);
public sealed record ArenaControl(double RootSeconds, double SlowSeconds, double HasteSeconds);

public sealed class PvpArena
{
    private sealed class Fighter(ArenaPlayer state, string connectionId)
    {
        public ArenaPlayer State = state;
        public string ConnectionId = connectionId;
        public DateTimeOffset? DisconnectedAt;
        public DateTimeOffset LastMove = DateTimeOffset.UtcNow;
        public DateTimeOffset LastAttack = DateTimeOffset.MinValue;
        public DateTimeOffset LastSkill = DateTimeOffset.MinValue;
        public DateTimeOffset GuardUntil = DateTimeOffset.MinValue;
        public DateTimeOffset LastGuard = DateTimeOffset.MinValue;
        public DateTimeOffset InvulnerableUntil = DateTimeOffset.MinValue;
        public DateTimeOffset RootUntil = DateTimeOffset.MinValue;
        public DateTimeOffset SlowUntil = DateTimeOffset.MinValue;
        public DateTimeOffset HasteUntil = DateTimeOffset.MinValue;
        public DateTimeOffset DashUntil = DateTimeOffset.MinValue;
        public int AttackBonus;
        public int DefenseBonus;
    }
    private readonly Dictionary<Guid, Fighter> _fighters = [];
    private readonly Dictionary<string, IReadOnlyList<string>> _groups = [];
    private readonly Dictionary<Guid, HashSet<string>> _connections = [];
    private readonly Dictionary<Guid, DateTimeOffset> _lastChat = [];
    private readonly object _gate = new();
    public IReadOnlyList<ArenaPlayer> Snapshot() { lock (_gate) return _fighters.Values.Where(f => f.ConnectionId.Length > 0).Select(f => f.State).ToArray(); }
    public IReadOnlyList<string> GroupsFor(string connection) { lock (_gate) return _groups.GetValueOrDefault(connection) ?? []; }
    public void SetGroups(string connection, IReadOnlyList<string> groups) { lock (_gate) _groups[connection] = groups; }
    public void RegisterConnection(Guid accountId, string connection)
    {
        lock (_gate)
        {
            if (!_connections.TryGetValue(accountId, out var set)) _connections[accountId] = set = [];
            set.Add(connection);
        }
    }
    public IReadOnlyList<string> ConnectionsFor(Guid accountId)
    {
        lock (_gate) return _connections.TryGetValue(accountId, out var set) ? set.ToArray() : [];
    }
    public bool AllowChat(Guid accountId)
    {
        lock (_gate)
        {
            var now = DateTimeOffset.UtcNow;
            if (_lastChat.TryGetValue(accountId, out var last) && (now - last).TotalMilliseconds < 700) return false;
            _lastChat[accountId] = now;
            return true;
        }
    }
    public ArenaControl ControlFor(Guid accountId, string connection)
    {
        lock (_gate)
        {
            if (!_fighters.TryGetValue(accountId, out var fighter) || fighter.ConnectionId != connection)
                return new ArenaControl(0, 0, 0);
            var now = DateTimeOffset.UtcNow;
            return new ArenaControl(
                Math.Max(0, (fighter.RootUntil - now).TotalSeconds),
                Math.Max(0, (fighter.SlowUntil - now).TotalSeconds),
                Math.Max(0, (fighter.HasteUntil - now).TotalSeconds));
        }
    }
    public ArenaPlayer Enter(Guid accountId, string connection, CharacterRecord character,
        IReadOnlyList<InventoryEntry> inventory, bool pk)
    {
        lock (_gate)
        {
            var equipped = inventory.Where(entry => entry.EquippedSlot is not null)
                .Select(entry => ItemCatalog.Find(entry.ItemId)).OfType<ItemDefinition>().ToArray();
            var maxHealth = character.MaxHealth + equipped.Sum(item => item.HealthBonus);
            _fighters.TryGetValue(accountId, out var current);
            var same = current?.State.CharacterId == character.Id &&
                (current.DisconnectedAt is null || DateTimeOffset.UtcNow - current.DisconnectedAt < TimeSpan.FromSeconds(60));
            var state = new ArenaPlayer(accountId, character.Id, character.Name, character.Element,
                same ? current!.State.X : 0, same ? current!.State.Z : 6.5f,
                same ? Math.Clamp(current!.State.Health + maxHealth - current.State.MaxHealth, 1, maxHealth) : maxHealth,
                maxHealth, pk);
            var fighter = new Fighter(state, connection) {
                AttackBonus = equipped.Sum(item => item.AttackBonus),
                DefenseBonus = equipped.Sum(item => item.DefenseBonus),
                LastAttack = same ? current!.LastAttack : DateTimeOffset.MinValue,
                LastSkill = same ? current!.LastSkill : DateTimeOffset.MinValue,
                LastGuard = same ? current!.LastGuard : DateTimeOffset.MinValue,
                GuardUntil = same ? current!.GuardUntil : DateTimeOffset.MinValue,
                InvulnerableUntil = same ? current!.InvulnerableUntil : DateTimeOffset.MinValue,
                RootUntil = same ? current!.RootUntil : DateTimeOffset.MinValue,
                SlowUntil = same ? current!.SlowUntil : DateTimeOffset.MinValue,
                HasteUntil = same ? current!.HasteUntil : DateTimeOffset.MinValue,
                DashUntil = same ? current!.DashUntil : DateTimeOffset.MinValue,
            };
            _fighters[accountId] = fighter;
            return state;
        }
    }
    public bool Leave(Guid accountId, string connection)
    {
        lock (_gate)
        {
            var leftArena = _fighters.TryGetValue(accountId, out var fighter) && fighter.ConnectionId == connection;
            if (leftArena) { fighter!.ConnectionId = ""; fighter.DisconnectedAt = DateTimeOffset.UtcNow; }
            _groups.Remove(connection);
            if (_connections.TryGetValue(accountId, out var set)) {
                set.Remove(connection);
                if (set.Count == 0) _connections.Remove(accountId);
            }
            foreach (var stale in _fighters.Where(pair => pair.Value.DisconnectedAt is not null &&
                DateTimeOffset.UtcNow - pair.Value.DisconnectedAt > TimeSpan.FromSeconds(60)).Select(pair => pair.Key).ToArray())
                _fighters.Remove(stale);
            return leftArena;
        }
    }
    public ArenaPlayer? Move(Guid accountId, string connection, float x, float z)
    {
        if (!float.IsFinite(x) || !float.IsFinite(z)) return null;
        lock (_gate)
        {
            if (!_fighters.TryGetValue(accountId, out var fighter) || fighter.ConnectionId != connection) return null;
            var now = DateTimeOffset.UtcNow;
            if (now < fighter.RootUntil) return null;
            if ((now - fighter.LastMove).TotalMilliseconds < 80) return null;
            var dt = Math.Clamp((now - fighter.LastMove).TotalSeconds, 0, 0.25);
            var speed = now < fighter.DashUntil ? (fighter.State.Element == "qi" ? 23 : 18) :
                ElementCatalog.Find(fighter.State.Element)!.Speed *
                (now < fighter.HasteUntil ? 1.35 : 1) * (now < fighter.SlowUntil ? .55 : 1);
            var distance = MathF.Sqrt(MathF.Pow(x - fighter.State.X, 2) + MathF.Pow(z - fighter.State.Z, 2));
            if (distance > speed * dt + 0.8f || x is < -18.8f or > 18.8f || z is < -13.4f or > 13.4f) return null;
            fighter.LastMove = now;
            fighter.State = fighter.State with { X = x, Z = z };
            return fighter.State;
        }
    }
    public ArenaPlayer? SetPk(Guid accountId, string connection, bool enabled)
    {
        lock (_gate)
        {
            if (!_fighters.TryGetValue(accountId, out var fighter) || fighter.ConnectionId != connection) return null;
            fighter.State = fighter.State with { PkEnabled = enabled };
            return fighter.State;
        }
    }
    public ArenaPlayer? Guard(Guid accountId, string connection)
    {
        lock (_gate)
        {
            if (!_fighters.TryGetValue(accountId, out var fighter) || fighter.ConnectionId != connection) return null;
            var now = DateTimeOffset.UtcNow;
            if (now < fighter.RootUntil) return null;
            var profile = PvpCombatCatalog.For(fighter.State.Element);
            if ((now - fighter.LastGuard).TotalSeconds < profile.GuardCooldown) return null;
            fighter.LastGuard = now;
            fighter.GuardUntil = now.AddSeconds(profile.GuardDuration);
            if (fighter.State.Element is "water" or "qi")
                fighter.DashUntil = now.AddSeconds(fighter.State.Element == "qi" ? .28 : .24);
            if (profile.GuardHeal > 0) fighter.State = fighter.State with {
                Health = Math.Min(fighter.State.MaxHealth, fighter.State.Health + profile.GuardHeal) };
            if (profile.GuardHasteSeconds > 0) fighter.HasteUntil = now.AddSeconds(profile.GuardHasteSeconds);
            return fighter.State;
        }
    }
    public ArenaAttackResult? Attack(Guid attackerId, string connection, Guid targetId, bool skill, bool guildWar, bool sameGuild)
    {
        lock (_gate)
        {
            if (attackerId == targetId || !_fighters.TryGetValue(attackerId, out var attacker) ||
                !_fighters.TryGetValue(targetId, out var target) || attacker.ConnectionId != connection ||
                target.ConnectionId.Length == 0 || sameGuild) return null;
            if (!guildWar && (!attacker.State.PkEnabled || !target.State.PkEnabled)) return null;
            var now = DateTimeOffset.UtcNow;
            if (now < target.InvulnerableUntil || now < attacker.RootUntil || attacker.State.Health <= 0) return null;
            var attackProfile = PvpCombatCatalog.For(attacker.State.Element);
            var targetProfile = PvpCombatCatalog.For(target.State.Element);
            if ((now - (skill ? attacker.LastSkill : attacker.LastAttack)).TotalSeconds <
                (skill ? attackProfile.SkillCooldown : attackProfile.AttackCooldown)) return null;
            var distance = MathF.Sqrt(MathF.Pow(attacker.State.X - target.State.X, 2) + MathF.Pow(attacker.State.Z - target.State.Z, 2));
            if (distance > (skill ? attackProfile.SkillRange : attackProfile.AttackRange)) return null;
            if (skill) attacker.LastSkill = now; else attacker.LastAttack = now;
            var attack = ElementCatalog.Find(attacker.State.Element)!.Attack + attacker.AttackBonus;
            var defense = ElementCatalog.Find(target.State.Element)!.Defense + target.DefenseBonus;
            var damage = Math.Max(1, (int)Math.Round(attack * (skill ? attackProfile.SkillPower : 0.7) - defense * 0.4));
            var guarding = now < target.GuardUntil;
            if (guarding) damage = Math.Max(0, (int)Math.Ceiling(damage * targetProfile.GuardMultiplier));
            var remaining = Math.Max(0, target.State.Health - damage);
            var killed = remaining == 0;
            target.State = target.State with { Health = killed ? target.State.MaxHealth : remaining,
                X = killed ? 0 : target.State.X, Z = killed ? 6.5f : target.State.Z };
            if (killed) target.InvulnerableUntil = now.AddSeconds(3);
            if (killed) { target.RootUntil = DateTimeOffset.MinValue; target.SlowUntil = DateTimeOffset.MinValue; }
            if (skill && damage > 0 && !killed)
            {
                if (attackProfile.SkillRootSeconds > 0) target.RootUntil = now.AddSeconds(attackProfile.SkillRootSeconds);
                if (attackProfile.SkillSlowSeconds > 0) target.SlowUntil = now.AddSeconds(attackProfile.SkillSlowSeconds);
                if (attackProfile.SkillKnockback > 0)
                {
                    var dx = (target.State.X - attacker.State.X) / Math.Max(.01f, distance);
                    var dz = (target.State.Z - attacker.State.Z) / Math.Max(.01f, distance);
                    target.State = target.State with {
                        X = Math.Clamp(target.State.X + dx * attackProfile.SkillKnockback, -18.8f, 18.8f),
                        Z = Math.Clamp(target.State.Z + dz * attackProfile.SkillKnockback, -13.4f, 13.4f) };
                }
            }
            if (skill && damage > 0 && attackProfile.SkillHeal > 0)
                attacker.State = attacker.State with { Health = Math.Min(attacker.State.MaxHealth, attacker.State.Health + attackProfile.SkillHeal) };
            if (skill && attackProfile.SkillHasteSeconds > 0) attacker.HasteUntil = now.AddSeconds(attackProfile.SkillHasteSeconds);
            if (guarding && target.State.Element == "ice") attacker.RootUntil = now.AddSeconds(1.5);

            ArenaHit? counter = null;
            if (guarding && target.State.Element == "fire" && damage > 0 && now >= attacker.InvulnerableUntil)
            {
                const int reflected = 14;
                var reflectedHealth = Math.Max(0, attacker.State.Health - reflected);
                var counterKilled = reflectedHealth == 0;
                attacker.State = attacker.State with { Health = counterKilled ? attacker.State.MaxHealth : reflectedHealth,
                    X = counterKilled ? 0 : attacker.State.X, Z = counterKilled ? 6.5f : attacker.State.Z };
                if (counterKilled) attacker.InvulnerableUntil = now.AddSeconds(3);
                if (counterKilled) { attacker.RootUntil = DateTimeOffset.MinValue; attacker.SlowUntil = DateTimeOffset.MinValue; }
                counter = new ArenaHit(targetId, attackerId, reflected, reflectedHealth, counterKilled, false);
            }
            var hit = new ArenaHit(attackerId, targetId, damage, remaining, killed, skill);
            return new ArenaAttackResult(hit, counter, attacker.State, target.State,
                skill && damage > 0 && !killed ? attackProfile.SkillRootSeconds : 0,
                skill && damage > 0 && !killed ? attackProfile.SkillSlowSeconds : 0,
                guarding && target.State.Element == "ice" ? 1.5 : 0,
                skill ? attackProfile.SkillHasteSeconds : 0);
        }
    }
}
