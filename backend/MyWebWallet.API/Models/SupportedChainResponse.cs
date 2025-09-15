namespace MyWebWallet.API.Models;

public class SupportedChainResponse
{
    public string Name { get; set; } = string.Empty;
    public string Id { get; set; } = string.Empty;
    public int ChainId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string IconUrl { get; set; } = string.Empty;
}

public class SupportedChainsResponse
{
    public List<SupportedChainResponse> Chains { get; set; } = new();
    public int Count => Chains.Count;
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}