using Game3d.Application;
using Game3d.Application.Accounts;
using Microsoft.AspNetCore.Identity;

namespace Game3d.Infrastructure.Repositories;

public sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<AccountRecord> _hasher = new();
    public string Hash(AccountRecord account, string password) => _hasher.HashPassword(account, password);
    public bool Verify(AccountRecord account, string password) =>
        _hasher.VerifyHashedPassword(account, account.PasswordHash, password) != PasswordVerificationResult.Failed;
}
