using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class KaminoOptionsTests
{
    [Fact]
    public void Validate_AlwaysReturnsSuccess()
    {
        var options = new KaminoOptions();

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }
}
