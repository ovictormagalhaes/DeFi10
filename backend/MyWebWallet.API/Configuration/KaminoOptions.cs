using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class KaminoOptions : IValidateOptions<KaminoOptions>
{
    public string ApiUrl { get; set; } = string.Empty;

    public ValidateOptionsResult Validate(string? name, KaminoOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ApiUrl))
        {
            return ValidateOptionsResult.Fail("Kamino:ApiUrl is required");
        }

        if (!Uri.TryCreate(options.ApiUrl, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("Kamino:ApiUrl must be a valid URL");
        }

        return ValidateOptionsResult.Success;
    }
}
