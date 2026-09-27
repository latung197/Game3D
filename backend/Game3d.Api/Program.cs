using Game3d.Api.Features.Players;
using Game3d.Api.Features.Accounts;
using Game3d.Api.Features.Characters;
using Game3d.Api.Features.Inventory;
using Game3d.Api.Features.Social;
using Game3d.Api.Features.Guilds;
using Game3d.Api.Features.Realtime;
using Game3d.Application;
using Game3d.Application.Accounts;
using Game3d.Application.Players;
using Game3d.Infrastructure.Persistence;
using Game3d.Infrastructure.Players;
using Game3d.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
var keyDirectory = Path.Combine(builder.Environment.ContentRootPath, "App_Data", "keys");
Directory.CreateDirectory(keyDirectory);
builder.Services.AddDataProtection().SetApplicationName("Game3d")
    .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory));

var playerStorePath = builder.Configuration["PlayerStore:Path"] ??
    Path.Combine(builder.Environment.ContentRootPath, "App_Data", "players.json");
builder.Services.AddSingleton<IPlayerRepository>(_ => new JsonPlayerRepository(
    Path.GetFullPath(playerStorePath)));
builder.Services.AddScoped<PlayerService>();
var gameDbPath = builder.Configuration["GameDb:Path"] ??
    Path.Combine(builder.Environment.ContentRootPath, "App_Data", "game.db");
builder.Services.AddSingleton<IGameStore>(_ => new SqliteGameStore(gameDbPath));
builder.Services.AddSingleton<IPasswordService, PasswordService>();
builder.Services.AddSingleton<PvpArena>();
builder.Services.AddScoped<GroupSyncService>();
builder.Services.AddSignalR(options => { options.MaximumReceiveMessageSize = 8 * 1024; });
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "truc-lam-session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
    });
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options => options.AddPolicy("auth", context =>
    RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })));
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins("http://localhost:5188", "http://127.0.0.1:5188")
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
await app.Services.GetRequiredService<IGameStore>().InitializeAsync();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api") &&
        !context.Request.Path.StartsWithSegments("/api/realtime") &&
        !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) &&
        !context.Request.Headers.ContainsKey("X-Requested-With"))
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsJsonAsync(new { error = "Thiếu X-Requested-With." });
        return;
    }
    await next();
});
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapPlayerEndpoints();
app.MapAccountEndpoints();
app.MapCharacterEndpoints();
app.MapInventoryEndpoints();
app.MapSocialEndpoints();
app.MapGuildEndpoints();
app.MapHub<GameHub>("/api/realtime");
app.Run();
