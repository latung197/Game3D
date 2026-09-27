namespace Game3d.Application;

public interface IAccountStore
{
    Task<AccountRecord?> AccountByEmailAsync(string email, CancellationToken ct);
    Task<AccountRecord?> AccountByIdAsync(Guid id, CancellationToken ct);
    Task<AccountRecord?> AccountByNameAsync(string name, CancellationToken ct);
    Task<bool> CreateAccountAsync(AccountRecord account, CancellationToken ct);
}
