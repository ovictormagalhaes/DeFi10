using DeFi10.API.Models;
using Xunit;

namespace DeFi10.API.Tests.Models;

public class ChainExtensionsTests
{
    #region ToChainId Tests

    [Fact]
    public void ToChainId_Ethereum_ReturnsEthereum()
    {
        var result = Chain.Ethereum.ToChainId();
        
        Assert.Equal("ethereum", result);
    }

    [Fact]
    public void ToChainId_Base_ReturnsBase()
    {
        var result = Chain.Base.ToChainId();
        
        Assert.Equal("base", result);
    }

    [Fact]
    public void ToChainId_Polygon_ReturnsPolygon()
    {
        var result = Chain.Polygon.ToChainId();
        
        Assert.Equal("polygon", result);
    }

    [Fact]
    public void ToChainId_Arbitrum_ReturnsArbitrum()
    {
        var result = Chain.Arbitrum.ToChainId();
        
        Assert.Equal("arbitrum", result);
    }

    [Fact]
    public void ToChainId_Optimism_ReturnsOptimism()
    {
        var result = Chain.Optimism.ToChainId();
        
        Assert.Equal("optimism", result);
    }

    [Fact]
    public void ToChainId_BNB_ReturnsBsc()
    {
        var result = Chain.BNB.ToChainId();
        
        Assert.Equal("bsc", result);
    }

    [Fact]
    public void ToChainId_Solana_ReturnsSolana()
    {
        var result = Chain.Solana.ToChainId();
        
        Assert.Equal("solana", result);
    }

    [Theory]
    [InlineData(Chain.Ethereum, "ethereum")]
    [InlineData(Chain.Base, "base")]
    [InlineData(Chain.Polygon, "polygon")]
    [InlineData(Chain.Arbitrum, "arbitrum")]
    [InlineData(Chain.Optimism, "optimism")]
    [InlineData(Chain.BNB, "bsc")]
    [InlineData(Chain.Solana, "solana")]
    public void ToChainId_AllChains_ReturnsExpectedValue(Chain chain, string expected)
    {
        var result = chain.ToChainId();
        
        Assert.Equal(expected, result);
    }

    [Fact]
    public void ToChainId_ReturnsLowerCase()
    {
        var result = Chain.Ethereum.ToChainId();
        
        Assert.Equal(result, result.ToLowerInvariant());
    }

    #endregion

    #region GetAlchemyRpcUrl Tests

    [Fact]
    public void GetAlchemyRpcUrl_Ethereum_ReturnsCorrectUrl()
    {
        var apiKey = "test-api-key";
        
        var result = Chain.Ethereum.GetAlchemyRpcUrl(apiKey);
        
        Assert.Equal($"https://eth-mainnet.g.alchemy.com/v2/{apiKey}", result);
    }

    [Fact]
    public void GetAlchemyRpcUrl_Base_ReturnsCorrectUrl()
    {
        var apiKey = "test-api-key";
        
        var result = Chain.Base.GetAlchemyRpcUrl(apiKey);
        
        Assert.Equal($"https://base-mainnet.g.alchemy.com/v2/{apiKey}", result);
    }

    [Fact]
    public void GetAlchemyRpcUrl_Arbitrum_ReturnsCorrectUrl()
    {
        var apiKey = "test-api-key";
        
        var result = Chain.Arbitrum.GetAlchemyRpcUrl(apiKey);
        
        Assert.Equal($"https://arb-mainnet.g.alchemy.com/v2/{apiKey}", result);
    }

    [Fact]
    public void GetAlchemyRpcUrl_Polygon_ReturnsCorrectUrl()
    {
        var apiKey = "test-api-key";
        
        var result = Chain.Polygon.GetAlchemyRpcUrl(apiKey);
        
        Assert.Equal($"https://polygon-mainnet.g.alchemy.com/v2/{apiKey}", result);
    }

    [Fact]
    public void GetAlchemyRpcUrl_Optimism_ReturnsCorrectUrl()
    {
        var apiKey = "test-api-key";
        
        var result = Chain.Optimism.GetAlchemyRpcUrl(apiKey);
        
        Assert.Equal($"https://opt-mainnet.g.alchemy.com/v2/{apiKey}", result);
    }

    [Fact]
    public void GetAlchemyRpcUrl_BNB_ThrowsNotSupportedException()
    {
        var apiKey = "test-api-key";
        
        var exception = Assert.Throws<NotSupportedException>(() => Chain.BNB.GetAlchemyRpcUrl(apiKey));
        
        Assert.Contains("Alchemy RPC not configured for BNB chain", exception.Message);
    }

    [Fact]
    public void GetAlchemyRpcUrl_Solana_ThrowsNotSupportedException()
    {
        var apiKey = "test-api-key";
        
        var exception = Assert.Throws<NotSupportedException>(() => Chain.Solana.GetAlchemyRpcUrl(apiKey));
        
        Assert.Contains("EVM-only", exception.Message);
        Assert.Contains("does not support Solana", exception.Message);
    }

    [Theory]
    [InlineData(Chain.Ethereum, "https://eth-mainnet.g.alchemy.com/v2/")]
    [InlineData(Chain.Base, "https://base-mainnet.g.alchemy.com/v2/")]
    [InlineData(Chain.Arbitrum, "https://arb-mainnet.g.alchemy.com/v2/")]
    [InlineData(Chain.Polygon, "https://polygon-mainnet.g.alchemy.com/v2/")]
    [InlineData(Chain.Optimism, "https://opt-mainnet.g.alchemy.com/v2/")]
    public void GetAlchemyRpcUrl_SupportedChains_ContainsApiKey(Chain chain, string expectedPrefix)
    {
        var apiKey = "my-secret-key-123";
        
        var result = chain.GetAlchemyRpcUrl(apiKey);
        
        Assert.StartsWith(expectedPrefix, result);
        Assert.EndsWith(apiKey, result);
    }

    [Fact]
    public void GetAlchemyRpcUrl_WithEmptyApiKey_ReturnsUrlWithEmptyKey()
    {
        var apiKey = "";
        
        var result = Chain.Ethereum.GetAlchemyRpcUrl(apiKey);
        
        Assert.Equal("https://eth-mainnet.g.alchemy.com/v2/", result);
    }

    [Fact]
    public void GetAlchemyRpcUrl_WithSpecialCharactersInApiKey_IncludesSpecialCharacters()
    {
        var apiKey = "test-key-with-special-chars!@#$%";
        
        var result = Chain.Ethereum.GetAlchemyRpcUrl(apiKey);
        
        Assert.Contains(apiKey, result);
    }

    [Fact]
    public void GetAlchemyRpcUrl_ReturnsHttpsUrls()
    {
        var apiKey = "test-key";
        
        var ethereumUrl = Chain.Ethereum.GetAlchemyRpcUrl(apiKey);
        var baseUrl = Chain.Base.GetAlchemyRpcUrl(apiKey);
        var arbitrumUrl = Chain.Arbitrum.GetAlchemyRpcUrl(apiKey);
        
        Assert.StartsWith("https://", ethereumUrl);
        Assert.StartsWith("https://", baseUrl);
        Assert.StartsWith("https://", arbitrumUrl);
    }

    [Fact]
    public void GetAlchemyRpcUrl_AllSupportedChains_ContainAlchemyDomain()
    {
        var apiKey = "test-key";
        
        var ethereumUrl = Chain.Ethereum.GetAlchemyRpcUrl(apiKey);
        var baseUrl = Chain.Base.GetAlchemyRpcUrl(apiKey);
        var arbitrumUrl = Chain.Arbitrum.GetAlchemyRpcUrl(apiKey);
        var polygonUrl = Chain.Polygon.GetAlchemyRpcUrl(apiKey);
        var optimismUrl = Chain.Optimism.GetAlchemyRpcUrl(apiKey);
        
        Assert.Contains(".g.alchemy.com/", ethereumUrl);
        Assert.Contains(".g.alchemy.com/", baseUrl);
        Assert.Contains(".g.alchemy.com/", arbitrumUrl);
        Assert.Contains(".g.alchemy.com/", polygonUrl);
        Assert.Contains(".g.alchemy.com/", optimismUrl);
    }

    #endregion

    #region Integration Tests

    [Fact]
    public void ToChainId_AndGetAlchemyRpcUrl_WorkTogether()
    {
        var chain = Chain.Ethereum;
        var apiKey = "integration-test-key";
        
        var chainId = chain.ToChainId();
        var rpcUrl = chain.GetAlchemyRpcUrl(apiKey);
        
        Assert.Equal("ethereum", chainId);
        Assert.Contains("eth-mainnet", rpcUrl);
    }

    [Theory]
    [InlineData(Chain.BNB)]
    [InlineData(Chain.Solana)]
    public void GetAlchemyRpcUrl_NonEvmChains_ThrowsNotSupportedException(Chain chain)
    {
        var apiKey = "test-key";
        
        Assert.Throws<NotSupportedException>(() => chain.GetAlchemyRpcUrl(apiKey));
    }

    #endregion
}
