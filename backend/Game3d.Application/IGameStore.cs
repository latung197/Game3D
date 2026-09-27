namespace Game3d.Application;

// The current SQLite implementation exposes all feature contracts through one instance.
public interface IGameStore : IAccountStore, ICharacterStore, IInventoryStore, ISocialStore, IGuildStore
{
    Task InitializeAsync(CancellationToken ct = default);
}
