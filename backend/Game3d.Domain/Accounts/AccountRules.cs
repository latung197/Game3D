using System.Text.RegularExpressions;

namespace Game3d.Domain.Accounts;

public static class AccountRules
{
    public static string NormalizeEmail(string? email) => email?.Trim().ToLowerInvariant() ?? "";
    public static bool CanRegister(string email, string displayName, string? password) =>
        email.Length <= 254 && Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$") &&
        Regex.IsMatch(displayName, @"^[\p{L}\p{N}_ .-]{3,24}$") &&
        password is { Length: >= 8 and <= 128 };
}
