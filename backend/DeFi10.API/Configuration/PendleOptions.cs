using Microsoft.Extensions.Options;

namespace DeFi10.API.Configuration;

public sealed class PendleOptions : IValidateOptions<PendleOptions>
{
    public string? VeContract { get; set; }
    public string? RpcOverride { get; set; }

    public ValidateOptionsResult Validate(string? name, PendleOptions options)
    {
        // VeContract e RpcOverride são opcionais
        return ValidateOptionsResult.Success;
    }
}
