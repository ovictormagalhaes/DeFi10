namespace DeFi10.API.Controllers.Responses;

public class StrategiesSavedResponse
{
    public string Key { get; set; } = string.Empty;
    public int StrategiesCount { get; set; }
    public List<StrategySummary> Strategies { get; set; } = new();
    public IEnumerable<string> Accounts { get; set; } = Array.Empty<string>();
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}

public class StrategySummary
{
    public Guid Id { get; set; }
    public int StrategyType { get; set; }
    public string? Name { get; set; }
    public int AllocationsCount { get; set; }
    public int TargetsCount { get; set; }
}
