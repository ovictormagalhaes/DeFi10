using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class SolanaOptions : IValidateOptions<SolanaOptions>
{
    public string RpcUrl { get; set; } = string.Empty;
    public List<string> FallbackRpcUrls { get; set; } = new();
    public bool UseFallbackOnRateLimit { get; set; } = true;
    public int RateLimitDelayMs { get; set; } = 1000;
    public int RequestTimeoutSeconds { get; set; } = 30;
    public int MaxRetries { get; set; } = 0;

    public ValidateOptionsResult Validate(string? name, SolanaOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.RpcUrl))
        {
            return ValidateOptionsResult.Fail("Solana:RpcUrl is required");
        }

        if (!Uri.TryCreate(options.RpcUrl, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("Solana:RpcUrl must be a valid URL");
        }

        if (options.RateLimitDelayMs < 0)
        {
            return ValidateOptionsResult.Fail("Solana:RateLimitDelayMs must be >= 0");
        }

        if (options.RequestTimeoutSeconds <= 0)
        {
            return ValidateOptionsResult.Fail("Solana:RequestTimeoutSeconds must be > 0");
        }

        return ValidateOptionsResult.Success;
    }
}
