using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

public class KaminoReservesResponseDto
{
    [JsonPropertyName("reserves")]
    public List<KaminoReserveDto> Reserves { get; set; } = new();
}

public class KaminoReserveDto
{
    [JsonPropertyName("reserve")]
    public string? Address { get; set; }

    [JsonPropertyName("liquidityToken")]
    public string? Symbol { get; set; }

    [JsonPropertyName("liquidityTokenMint")]
    public string? MintAddress { get; set; }

    [JsonPropertyName("supplyApy")]
    public string? SupplyApyString { get; set; }

    [JsonPropertyName("borrowApy")]
    public string? BorrowApyString { get; set; }

    [JsonPropertyName("totalSupply")]
    public string? TotalSupplyString { get; set; }

    [JsonPropertyName("totalBorrow")]
    public string? TotalBorrowString { get; set; }

    [JsonPropertyName("totalSupplyUsd")]
    public string? TotalSupplyUsdString { get; set; }

    [JsonPropertyName("totalBorrowUsd")]
    public string? TotalBorrowUsdString { get; set; }

    [JsonPropertyName("maxLtv")]
    public string? MaxLtvString { get; set; }

    // Computed properties for easy access - ignored during JSON serialization
    [JsonIgnore]
    public decimal SupplyApy => decimal.TryParse(SupplyApyString, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val) ? val : 0;
    
    [JsonIgnore]
    public decimal BorrowApy => decimal.TryParse(BorrowApyString, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val) ? val : 0;
    
    [JsonIgnore]
    public decimal TotalSupply => decimal.TryParse(TotalSupplyString, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val) ? val : 0;
    
    [JsonIgnore]
    public decimal TotalBorrow => decimal.TryParse(TotalBorrowString, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val) ? val : 0;
    
    [JsonIgnore]
    public decimal TotalSupplyUsd => decimal.TryParse(TotalSupplyUsdString, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val) ? val : 0;
    
    [JsonIgnore]
    public decimal TotalBorrowUsd => decimal.TryParse(TotalBorrowUsdString, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val) ? val : 0;
}
