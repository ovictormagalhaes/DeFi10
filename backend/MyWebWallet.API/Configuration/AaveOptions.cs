using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class AaveOptions : IValidateOptions<AaveOptions>
{
    public string GraphQLEndpoint { get; set; } = string.Empty;

    public ValidateOptionsResult Validate(string? name, AaveOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.GraphQLEndpoint))
        {
            return ValidateOptionsResult.Fail("Aave:GraphQLEndpoint is required");
        }

        if (!Uri.TryCreate(options.GraphQLEndpoint, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("Aave:GraphQLEndpoint must be a valid URL");
        }

        return ValidateOptionsResult.Success;
    }
}
