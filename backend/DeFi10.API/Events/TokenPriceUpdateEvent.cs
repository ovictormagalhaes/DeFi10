using DeFi10.API.Models;

namespace DeFi10.API.Events;

public sealed class TokenPriceUpdateEvent
{
    public List<TokenPriceUpdateRequest> Tokens { get; set; } = new();
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;    
    public string Source { get; set; } = "UserRequest";
}

public sealed class TokenPriceUpdateRequest
{
    public Chain Chain { get; set; }
    public string Address { get; set; } = string.Empty;
    public string Symbol { get; set; } = string.Empty;    
    public decimal CurrentPrice { get; set; }    

    public string GetDeduplicationKey() => $"{(int)Chain}:{Address.ToLowerInvariant()}";
}
