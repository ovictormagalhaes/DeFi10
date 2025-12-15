namespace DeFi10.API.Services.Protocols.Pendle.Models;

internal class PendleMarketsResponse
{
    public List<PendleMarket> Results { get; set; } = new();
    public int Total { get; set; }
    public int Limit { get; set; }
    public int Skip { get; set; }
}
