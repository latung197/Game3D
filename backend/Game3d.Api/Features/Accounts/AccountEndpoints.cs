using System.Security.Claims;
using Game3d.Application;
using Game3d.Application.Accounts;
using Game3d.Domain.Accounts;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace Game3d.Api.Features.Accounts;

public static class AccountEndpoints
{
    public static Guid AccountId(this ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public sealed record Credentials(string Email, string Password, string? DisplayName, bool RememberMe = true);

    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/accounts");
        group.MapPost("/register", async (Credentials input, IGameStore store, IPasswordService passwords, HttpContext context, CancellationToken ct) =>
        {
            var email = AccountRules.NormalizeEmail(input.Email);
            var name = input.DisplayName?.Trim() ?? "";
            if (!AccountRules.CanRegister(email, name, input.Password))
                return Results.BadRequest(new { error = "Email, tên hiển thị hoặc mật khẩu không hợp lệ (tối thiểu 8 ký tự)." });
            var account = new AccountRecord(Guid.NewGuid(), email, name, "", null);
            account = account with { PasswordHash = passwords.Hash(account, input.Password) };
            if (!await store.CreateAccountAsync(account, ct)) return Results.Conflict(new { error = "Email hoặc tên hiển thị đã được dùng." });
            await SignIn(context, account, input.RememberMe);
            return Results.Ok(Public(account));
        }).RequireRateLimiting("auth");

        group.MapPost("/login", async (Credentials input, IGameStore store, IPasswordService passwords, HttpContext context, CancellationToken ct) =>
        {
            var account = await store.AccountByEmailAsync(input.Email?.Trim() ?? "", ct);
            if (account is null || !passwords.Verify(account, input.Password ?? ""))
                return Results.Unauthorized();
            await SignIn(context, account, input.RememberMe);
            return Results.Ok(Public(account));
        }).RequireRateLimiting("auth");

        group.MapPost("/logout", async (HttpContext context) =>
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        }).RequireAuthorization();
        group.MapGet("/me", async (ClaimsPrincipal user, IGameStore store, CancellationToken ct) =>
        {
            var account = await store.AccountByIdAsync(user.AccountId(), ct);
            return account is null ? Results.Unauthorized() : Results.Ok(Public(account));
        }).RequireAuthorization();
    }

    private static object Public(AccountRecord account) => new { account.Id, account.Email, account.DisplayName, account.SelectedCharacterId };
    private static Task SignIn(HttpContext context, AccountRecord account, bool remember)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
            new Claim(ClaimTypes.Name, account.DisplayName)
        }, CookieAuthenticationDefaults.AuthenticationScheme);
        return context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity), new AuthenticationProperties
            {
                IsPersistent = remember,
                ExpiresUtc = DateTimeOffset.UtcNow.Add(remember ? TimeSpan.FromDays(30) : TimeSpan.FromHours(8))
            });
    }
}
