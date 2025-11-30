using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class UniswapV3Options : IValidateOptions<UniswapV3Options>
{
    public string GraphQLEndpoint { get; set; } = string.Empty;
    public string? ApiKey { get; set; }

    public ValidateOptionsResult Validate(string? name, UniswapV3Options options)
    {
        if (string.IsNullOrWhiteSpace(options.GraphQLEndpoint))
        {
            return ValidateOptionsResult.Fail("UniswapV3:GraphQLEndpoint is required");
        }

        if (!Uri.TryCreate(options.GraphQLEndpoint, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("UniswapV3:GraphQLEndpoint must be a valid URL");
        }

        return ValidateOptionsResult.Success;
    }
}
