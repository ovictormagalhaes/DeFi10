using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class AlchemyOptions : IValidateOptions<AlchemyOptions>
{
    public string ApiKey { get; set; } = string.Empty;
    public string NftUrl { get; set; } = string.Empty;
    public string BaseRpcUrl { get; set; } = string.Empty;
    public string ArbitrumRpcUrl { get; set; } = string.Empty;

    public ValidateOptionsResult Validate(string? name, AlchemyOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
        {
            return ValidateOptionsResult.Fail("Alchemy:ApiKey is required");
        }

        if (!string.IsNullOrWhiteSpace(options.NftUrl) && !Uri.TryCreate(options.NftUrl, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("Alchemy:NftUrl must be a valid URL");
        }

        if (!string.IsNullOrWhiteSpace(options.BaseRpcUrl) && !Uri.TryCreate(options.BaseRpcUrl, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("Alchemy:BaseRpcUrl must be a valid URL");
        }

        return ValidateOptionsResult.Success;
    }
}
