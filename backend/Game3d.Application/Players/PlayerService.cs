using Game3d.Domain.Players;

namespace Game3d.Application.Players;

public sealed class PlayerService(IPlayerRepository repository)
{
    public async Task<PlayerSnapshot> CreateAsync(string? name, string? elementId, CancellationToken cancellationToken)
    {
        var cleanName = name?.Trim();
        if (string.IsNullOrWhiteSpace(cleanName) || cleanName.Length is < 2 or > 20 || cleanName.Any(char.IsControl))
            throw new ArgumentException("Tên nhân vật cần từ 2 đến 20 ký tự.", nameof(name));

        var element = ElementCatalog.Find(elementId)
            ?? throw new ArgumentException("Hệ nhân vật không hợp lệ.", nameof(elementId));
        return await repository.CreateAsync(Player.Create(cleanName, element), cancellationToken);
    }

    public Task<PlayerSnapshot?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        repository.GetAsync(id, cancellationToken);

    public Task<PlayerSnapshot?> ChangeElementAsync(Guid id, string? elementId, CancellationToken cancellationToken)
    {
        var element = ElementCatalog.Find(elementId)
            ?? throw new ArgumentException("Hệ nhân vật không hợp lệ.", nameof(elementId));
        return repository.UpdateAsync(id, player => player.ChangeElement(element), cancellationToken);
    }

    public async Task<PlayerSnapshot?> RecordVictoryAsync(Guid id, string enemyId, CancellationToken cancellationToken)
    {
        var enemy = EnemyCatalog.Find(enemyId)
            ?? throw new ArgumentException("Loại quái không hợp lệ.", nameof(enemyId));

        return await repository.UpdateAsync(id, player => player.RecordVictory(enemy), cancellationToken);
    }

    public Task<IReadOnlyList<PlayerSnapshot>> TopAsync(CancellationToken cancellationToken) =>
        repository.TopAsync(10, cancellationToken);
}
