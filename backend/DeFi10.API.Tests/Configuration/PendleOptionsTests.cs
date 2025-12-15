using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class PendleOptionsTests
{
    [Fact]
    public void Validate_WithAllPropertiesSet_ReturnsSuccess()
    {
        var options = new PendleOptions
        {
            VeContract = "0x1234567890abcdef",
            RpcOverride = "https://custom-rpc.com"
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithNullProperties_ReturnsSuccess()
    {
        var options = new PendleOptions
        {
            VeContract = null,
            RpcOverride = null
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithEmptyProperties_ReturnsSuccess()
    {
        var options = new PendleOptions
        {
            VeContract = "",
            RpcOverride = ""
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void DefaultValues_AreNull()
    {
        var options = new PendleOptions();

        Assert.Null(options.VeContract);
        Assert.Null(options.RpcOverride);
    }
}
