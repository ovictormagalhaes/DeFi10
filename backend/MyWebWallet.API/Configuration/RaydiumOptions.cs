using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class RaydiumOptions : IValidateOptions<RaydiumOptions>
{
    public string ApiUrl { get; set; } = string.Empty;

    public ValidateOptionsResult Validate(string? name, RaydiumOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ApiUrl))
        {
            return ValidateOptionsResult.Fail("Raydium:ApiUrl is required");
        }

        if (!Uri.TryCreate(options.ApiUrl, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("Raydium:ApiUrl must be a valid URL");
        }

        return ValidateOptionsResult.Success;
    }
}
