using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Configuration;

public sealed class PendleOptions : IValidateOptions<PendleOptions>
{
    public string? VeContract { get; set; }
    public string? RpcOverride { get; set; }

    public ValidateOptionsResult Validate(string? name, PendleOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.RpcOverride) && !Uri.TryCreate(options.RpcOverride, UriKind.Absolute, out _))
        {
            return ValidateOptionsResult.Fail("Pendle:RpcOverride must be a valid URL when provided");
        }

        return ValidateOptionsResult.Success;
    }
}
