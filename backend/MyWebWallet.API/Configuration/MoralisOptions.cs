using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class MoralisOptions : IValidateOptions<MoralisOptions>
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://deep-index.moralis.io/api/v2.2";
    public string SolanaBaseUrl { get; set; } = "https://solana-gateway.moralis.io";
    public Dictionary<string, string> ChainMap { get; set; } = new();
    
    public ValidateOptionsResult Validate(string? name, MoralisOptions options)
    {
        if (string.IsNullOrEmpty(options.ApiKey))
            return ValidateOptionsResult.Fail("Moralis:ApiKey is required");
        
        if (string.IsNullOrEmpty(options.BaseUrl))
            return ValidateOptionsResult.Fail("Moralis:BaseUrl is required");
            
        return ValidateOptionsResult.Success;
    }
}
