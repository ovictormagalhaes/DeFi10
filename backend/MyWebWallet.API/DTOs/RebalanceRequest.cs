using MyWebWallet.API.Models;

namespace MyWebWallet.API.DTOs;

public class RebalanceItem
{
    public string Version { get; set; } = "1";
    public string? Asset { get; set; } = string.Empty;
    public RebalanceAssetType Type { get; set; } = RebalanceAssetType.Unknown;
    public int Note { get; set; } = 0;
    public RebalanceReferenceType ByGroupType { get; set; } = RebalanceReferenceType.Unknown;
    public string? Value { get; set; }
    public RebalanceItemAdditionalInfo AdditionalInfo { get; set; } = new();
}

public class RebalanceItemAdditionalInfo
{
    public string? Logo1 { get; set; }
    public string? Logo2 { get; set; }
}

public class RebalanceRequest
{
    // Accept either a single accountId or multiple
    public string? AccountId { get; set; }
    public List<string>? AccountIds { get; set; }

    // The desired targets for rebalancing
    public List<RebalanceItem> Items { get; set; } = new();
}

public class RebalanceSavedResponse
{
    public string Key { get; set; } = string.Empty;
    public int ItemsCount { get; set; }
    public IEnumerable<string> Accounts { get; set; } = Array.Empty<string>();
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}
