namespace Game3d.Domain.Social;

public static class ChatRules
{
    public static string Normalize(string? text) => text?.Trim() ?? "";
    public static bool IsValid(string text) => text.Length is >= 1 and <= 300 &&
        !text.Any(c => char.IsControl(c) && c != '\n');
}
