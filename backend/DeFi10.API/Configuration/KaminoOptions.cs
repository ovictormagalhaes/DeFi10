using Microsoft.Extensions.Options;

namespace DeFi10.API.Configuration;

public sealed class KaminoOptions : IValidateOptions<KaminoOptions>
{
    public ValidateOptionsResult Validate(string? name, KaminoOptions options)
    {
        // Classe vazia - configurações técnicas virão de ProtocolConfiguration.Options
        return ValidateOptionsResult.Success;
    }
}
