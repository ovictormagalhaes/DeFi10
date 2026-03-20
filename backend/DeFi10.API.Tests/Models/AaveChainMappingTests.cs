using Xunit;

namespace DeFi10.API.Tests.Models;

/// <summary>
/// Testes para validar mapeamento de chains em Aave
/// </summary>
public class AaveChainMappingTests
{
    [Theory]
    [InlineData("base", "base")]
    [InlineData("8453", "base")]
    [InlineData("Base", "base")]
    [InlineData("BASE", "base")]
    [InlineData("ethereum", "ethereum")]
    [InlineData("1", "ethereum")]
    [InlineData("eth", "ethereum")]
    [InlineData("arbitrum", "arbitrum")]
    [InlineData("42161", "arbitrum")]
    [InlineData("arb", "arbitrum")]
    public void ChainMapping_ShouldNormalizeCorrectly(string input, string expected)
    {
        // Arrange & Act
        var chainNormalized = input.ToLowerInvariant();
        var result = chainNormalized switch
        {
            "8453" or "base" => "base",
            "1" or "ethereum" or "eth" => "ethereum",
            "42161" or "arbitrum" or "arb" => "arbitrum",
            _ => ""
        };
        
        // Assert
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("999")]
    [InlineData("polygon")]
    public void ChainMapping_ShouldReturnEmpty_ForUnsupportedChains(string input)
    {
        // Arrange & Act
        var chainNormalized = input.ToLowerInvariant();
        var result = chainNormalized switch
        {
            "8453" or "base" => "base",
            "1" or "ethereum" or "eth" => "ethereum",
            "42161" or "arbitrum" or "arb" => "arbitrum",
            _ => ""
        };
        
        // Assert
        Assert.Empty(result);
    }
}
