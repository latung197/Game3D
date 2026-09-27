namespace Game3d.Domain.Players;

public sealed record PvpCombatProfile(
    float AttackRange, double AttackCooldown, float SkillRange, double SkillCooldown,
    double SkillPower, double GuardCooldown, double GuardDuration, double GuardMultiplier,
    double SkillRootSeconds = 0, double SkillSlowSeconds = 0, int SkillHeal = 0,
    float SkillKnockback = 0, double SkillHasteSeconds = 0, int GuardHeal = 0,
    double GuardHasteSeconds = 0);

public static class PvpCombatCatalog
{
    public static readonly IReadOnlyDictionary<string, PvpCombatProfile> All = new Dictionary<string, PvpCombatProfile>
    {
        ["metal"] = new(2.6f, .45, 4.8f, 8, 1.75, 8, 2.4, .3),
        ["wood"] = new(2.8f, .43, 3.7f, 9, 1.3, 9, 4, .75, SkillRootSeconds: 3,
            SkillHeal: 8, GuardHeal: 12),
        ["water"] = new(3f, .42, 4f, 8, 1.4, 6, .8, 0, SkillSlowSeconds: 2, SkillHeal: 6),
        ["fire"] = new(2.6f, .4, 4f, 9, 1.55, 8, 2.5, .5),
        ["earth"] = new(2.4f, .5, 3.5f, 9, 1.4, 10, 3, .2, SkillRootSeconds: 2.4),
        ["ice"] = new(3f, .45, 3.8f, 9, 1.35, 9, 2.5, .65, SkillRootSeconds: 3),
        ["qi"] = new(2.9f, .31, 4.2f, 8, 1.45, 6, .7, 0, SkillKnockback: 2,
            SkillHasteSeconds: 3, GuardHasteSeconds: 3)
    };
    public static PvpCombatProfile For(string element) => All.GetValueOrDefault(element) ?? All["metal"];
}
