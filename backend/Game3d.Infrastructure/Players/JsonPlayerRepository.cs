using System.Text.Json;
using Game3d.Application.Players;
using Game3d.Domain.Players;

namespace Game3d.Infrastructure.Players;

public sealed class JsonPlayerRepository : IPlayerRepository
{
    private readonly string _filePath;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private Dictionary<Guid, PlayerSnapshot>? _players;

    public JsonPlayerRepository(string filePath) => _filePath = filePath;

    public async Task<PlayerSnapshot?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await LoadAsync(cancellationToken);
            return _players!.GetValueOrDefault(id);
        }
        finally { _gate.Release(); }
    }

    public async Task<PlayerSnapshot> CreateAsync(Player player, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await LoadAsync(cancellationToken);
            _players!.Add(player.State.Id, player.State);
            await SaveAsync(cancellationToken);
            return player.State;
        }
        finally { _gate.Release(); }
    }

    public async Task<PlayerSnapshot?> UpdateAsync(Guid id, Action<Player> update, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await LoadAsync(cancellationToken);
            if (!_players!.TryGetValue(id, out var snapshot)) return null;
            var player = Player.Restore(snapshot);
            update(player);
            _players[id] = player.State;
            await SaveAsync(cancellationToken);
            return player.State;
        }
        finally { _gate.Release(); }
    }

    public async Task<IReadOnlyList<PlayerSnapshot>> TopAsync(int count, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await LoadAsync(cancellationToken);
            return _players!.Values
                .OrderByDescending(player => player.Level)
                .ThenByDescending(player => player.Experience)
                .ThenByDescending(player => player.TotalKills)
                .Take(count).ToArray();
        }
        finally { _gate.Release(); }
    }

    private async Task LoadAsync(CancellationToken cancellationToken)
    {
        if (_players is not null) return;
        if (!File.Exists(_filePath))
        {
            _players = new Dictionary<Guid, PlayerSnapshot>();
            return;
        }

        await using var file = File.OpenRead(_filePath);
        using var document = await JsonDocument.ParseAsync(file, cancellationToken: cancellationToken);
        _players = new Dictionary<Guid, PlayerSnapshot>();
        foreach (var item in document.RootElement.EnumerateArray())
        {
            var player = item.Deserialize<PlayerSnapshot>(_jsonOptions)!;
            var element = ElementCatalog.Find(player.Element) ?? ElementCatalog.Find("metal")!;
            var expectedMaxHealth = Player.MaxHealthFor(element, player.Level);
            var difference = expectedMaxHealth - player.MaxHealth;
            player = player with
            {
                Element = element.Id,
                MaxHealth = expectedMaxHealth,
                Health = Math.Clamp(player.Health + difference, 1, expectedMaxHealth)
            };
            _players.Add(player.Id, player);
        }
    }

    private async Task SaveAsync(CancellationToken cancellationToken)
    {
        var directory = Path.GetDirectoryName(_filePath)!;
        Directory.CreateDirectory(directory);
        var temp = Path.Combine(directory, $".{Path.GetFileName(_filePath)}.{Guid.NewGuid():N}.tmp");
        try
        {
            await using (var file = File.Create(temp))
                await JsonSerializer.SerializeAsync(file, _players!.Values, _jsonOptions, cancellationToken);
            File.Move(temp, _filePath, true);
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
    }
}
