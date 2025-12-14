using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class AaveOptionsTests
{
    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new AaveOptions
        {
            GraphQLEndpoint = "https://api.thegraph.com/subgraphs/name/aave/protocol"
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithMissingGraphQLEndpoint_ReturnsFail()
    {
        var options = new AaveOptions
        {
            GraphQLEndpoint = ""
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("GraphQLEndpoint is required", result.FailureMessage);
    }

    [Fact]
    public void DefaultValue_IsCorrect()
    {
        var options = new AaveOptions();

        Assert.Equal(string.Empty, options.GraphQLEndpoint);
    }
}
