namespace Game3d.Application;

public interface ICharacterStore
{
    Task<IReadOnlyList<CharacterRecord>> CharactersAsync(Guid accountId, CancellationToken ct);
    Task<CharacterRecord?> CharacterAsync(Guid id, CancellationToken ct);
    Task<CharacterRecord?> SelectedCharacterAsync(Guid accountId, CancellationToken ct);
    Task<bool> CreateCharacterAsync(CharacterRecord character, CancellationToken ct);
    Task<bool> SelectCharacterAsync(Guid accountId, Guid characterId, CancellationToken ct);
    Task<bool> SaveCharacterAsync(CharacterRecord character, CancellationToken ct);
    Task<bool> ImportGuestAsync(Guid legacyId, CharacterRecord character, CancellationToken ct);
}
