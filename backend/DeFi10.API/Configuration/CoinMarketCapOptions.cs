using Microsoft.Extensions.Options;

namespace DeFi10.API.Configuration;

public sealed class CoinMarketCapOptions : IValidateOptions<CoinMarketCapOptions>
{
    public string? ApiKey { get; set; }
    public string BaseUrl { get; set; } = "https://pro-api.coinmarketcap.com/v1";
    public bool Enabled { get; set; } = true;
    public int TimeoutMs { get; set; } = 5000;

    public ValidateOptionsResult Validate(string? name, CoinMarketCapOptions options)
    {
        if (options.Enabled && string.IsNullOrWhiteSpace(options.ApiKey))
        {
            return ValidateOptionsResult.Fail("CoinMarketCap:ApiKey is required when Enabled is true");
        }

        if (string.IsNullOrWhiteSpace(options.BaseUrl))
        {
            return ValidateOptionsResult.Fail("CoinMarketCap:BaseUrl is required");
        }

        if (!Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("CoinMarketCap:BaseUrl must be a valid URL");
        }

        if (options.TimeoutMs <= 0)
        {
            return ValidateOptionsResult.Fail("CoinMarketCap:TimeoutMs must be > 0");
        }

        return ValidateOptionsResult.Success;
    }
}
