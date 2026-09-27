namespace Game3d.Domain.Players;

public sealed record PlayerSnapshot(
    Guid Id, string Name, int Level, int Experience, int Gold, int Health,
    int MaxHealth, int TotalKills, int QuestKills, string Element = "metal");

public sealed class Player
{
    public PlayerSnapshot State { get; private set; }

    private Player(PlayerSnapshot state) => State = state;

    public static Player Create(string name, ElementDefinition element) => new(new PlayerSnapshot(
        Guid.NewGuid(), name.Trim(), 1, 0, 0, element.BaseHealth, element.BaseHealth, 0, 0, element.Id));

    public static Player Restore(PlayerSnapshot state) => new(state);

    public void ChangeElement(ElementDefinition element)
    {
        var newMaxHealth = MaxHealthFor(element, State.Level);
        var healthDifference = newMaxHealth - State.MaxHealth;
        State = State with
        {
            Element = element.Id,
            MaxHealth = newMaxHealth,
            Health = Math.Clamp(State.Health + healthDifference, 1, newMaxHealth)
        };
    }

    public void RecordVictory(EnemyDefinition enemy)
    {
        var experience = State.Experience + enemy.Experience;
        var level = State.Level;
        var maxHealth = State.MaxHealth;
        var health = State.Health;

        while (experience >= ExperienceForNextLevel(level))
        {
            experience -= ExperienceForNextLevel(level);
            level++;
            maxHealth += 15;
            health = maxHealth;
        }

        State = State with
        {
            Level = level, Experience = experience, Gold = State.Gold + enemy.Gold,
            MaxHealth = maxHealth, Health = health, TotalKills = State.TotalKills + 1,
            QuestKills = State.QuestKills + (enemy.Id == "forest_slime" ? 1 : 0)
        };
    }

    public static int ExperienceForNextLevel(int level) => 60 + level * 40;

    public static int MaxHealthFor(ElementDefinition element, int level) =>
        element.BaseHealth + Math.Max(0, level - 1) * 15;
}
