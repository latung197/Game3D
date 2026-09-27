using Game3d.Domain.Players;

namespace Game3d.Application.Players;

public interface IPlayerRepository
{
    Task<PlayerSnapshot?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<PlayerSnapshot> CreateAsync(Player player, CancellationToken cancellationToken);
    Task<PlayerSnapshot?> UpdateAsync(Guid id, Action<Player> update, CancellationToken cancellationToken);
    Task<IReadOnlyList<PlayerSnapshot>> TopAsync(int count, CancellationToken cancellationToken);
}
