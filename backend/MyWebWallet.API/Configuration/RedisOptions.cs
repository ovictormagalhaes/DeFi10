using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class RedisOptions : IValidateOptions<RedisOptions>
{
    public const string WalletCacheKeyPrefix = "wallet:";
    public const string TokenLogoKeyPrefix = "token_logo:";
    
    public string? ConnectionString { get; set; }
    public string? User { get; set; }
    public string? Password { get; set; }
    public int ConnectTimeoutMs { get; set; } = 15000;
    public int SyncTimeoutMs { get; set; } = 15000;
    public int ConnectRetry { get; set; } = 5;
    public TimeSpan DefaultExpiration { get; set; } = TimeSpan.FromHours(1);
    public TimeSpan TokenLogoExpiration { get; set; } = TimeSpan.MaxValue;

    public ValidateOptionsResult Validate(string? name, RedisOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ConnectionString))
        {
            return ValidateOptionsResult.Fail("Redis:ConnectionString is required");
        }

        if (options.ConnectTimeoutMs <= 0)
        {
            return ValidateOptionsResult.Fail("Redis:ConnectTimeoutMs must be > 0");
        }

        if (options.SyncTimeoutMs <= 0)
        {
            return ValidateOptionsResult.Fail("Redis:SyncTimeoutMs must be > 0");
        }

        return ValidateOptionsResult.Success;
    }
}
