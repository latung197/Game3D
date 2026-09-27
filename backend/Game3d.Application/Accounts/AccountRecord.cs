namespace Game3d.Application;

public sealed record AccountRecord(Guid Id, string Email, string DisplayName, string PasswordHash, Guid? SelectedCharacterId);
