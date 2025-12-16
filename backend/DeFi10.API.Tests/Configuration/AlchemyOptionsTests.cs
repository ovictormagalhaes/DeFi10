using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class AlchemyOptionsTests
{
    [Fact]
    public void Validate_WithValidApiKey_ReturnsSuccess()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "test-api-key"
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithMissingApiKey_ReturnsFail()
    {
        var options = new AlchemyOptions
        {
            ApiKey = ""
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ApiKey is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithInvalidNftUrl_ReturnsFail()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "test-key",
            NftUrl = "not a url at all"
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("must be a valid URL", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithInvalidBaseRpcUrl_ReturnsFail()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "test-key",
            BaseRpcUrl = "not a url at all"
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("must be a valid URL", result.FailureMessage);
    }

    [Fact]
    public void GetNftUrl_WithoutCustomUrl_GeneratesDefault()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            NftUrl = ""
        };

        var result = options.GetNftUrl();

        Assert.Contains("base-mainnet.g.alchemy.com", result);
        Assert.Contains("my-api-key", result);
        Assert.Contains("/nft/v3/", result);
    }

    [Fact]
    public void GetNftUrl_WithCustomUrl_ReturnsCustom()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            NftUrl = "https://custom-nft-url.com/"
        };

        var result = options.GetNftUrl();

        Assert.Equal("https://custom-nft-url.com/", result);
    }

    [Fact]
    public void GetBaseRpcUrl_WithoutCustomUrl_GeneratesDefault()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            BaseRpcUrl = ""
        };

        var result = options.GetBaseRpcUrl();

        Assert.Contains("base-mainnet.g.alchemy.com", result);
        Assert.Contains("my-api-key", result);
        Assert.Contains("/v2/", result);
    }

    [Fact]
    public void GetBaseRpcUrl_WithCustomUrl_ReturnsCustom()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            BaseRpcUrl = "https://custom-base-rpc.com/"
        };

        var result = options.GetBaseRpcUrl();

        Assert.Equal("https://custom-base-rpc.com/", result);
    }

    [Fact]
    public void GetArbitrumRpcUrl_WithoutCustomUrl_GeneratesDefault()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            ArbitrumRpcUrl = ""
        };

        var result = options.GetArbitrumRpcUrl();

        Assert.Contains("arb-mainnet.g.alchemy.com", result);
        Assert.Contains("my-api-key", result);
        Assert.Contains("/v2/", result);
    }

    [Fact]
    public void GetArbitrumRpcUrl_WithCustomUrl_ReturnsCustom()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            ArbitrumRpcUrl = "https://custom-arbitrum-rpc.com/"
        };

        var result = options.GetArbitrumRpcUrl();

        Assert.Equal("https://custom-arbitrum-rpc.com/", result);
    }

    [Fact]
    public void GetSolanaRpcUrl_WithoutCustomUrl_GeneratesDefault()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            SolanaRpcUrl = ""
        };

        var result = options.GetSolanaRpcUrl();

        Assert.Contains("solana-mainnet.g.alchemy.com", result);
        Assert.Contains("my-api-key", result);
        Assert.Contains("/v2/", result);
    }

    [Fact]
    public void GetSolanaRpcUrl_WithCustomUrl_ReturnsCustom()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            SolanaRpcUrl = "https://custom-solana-rpc.com"
        };

        var result = options.GetSolanaRpcUrl();

        Assert.Equal("https://custom-solana-rpc.com", result);
    }

    [Fact]
    public void GetEthereumRpcUrl_WithoutCustomUrl_GeneratesDefault()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            EthereumRpcUrl = ""
        };

        var result = options.GetEthereumRpcUrl();

        Assert.Contains("eth-mainnet.g.alchemy.com", result);
        Assert.Contains("my-api-key", result);
        Assert.Contains("/v2/", result);
    }

    [Fact]
    public void GetEthereumRpcUrl_WithCustomUrl_ReturnsCustom()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "my-api-key",
            EthereumRpcUrl = "https://custom-ethereum-rpc.com"
        };

        var result = options.GetEthereumRpcUrl();

        Assert.Equal("https://custom-ethereum-rpc.com", result);
    }

    [Fact]
    public void ApiKey_TrimsWhitespace_InGeneratedUrls()
    {
        var options = new AlchemyOptions
        {
            ApiKey = "  my-api-key  "
        };

        var nftUrl = options.GetNftUrl();
        var baseUrl = options.GetBaseRpcUrl();

        Assert.Contains("my-api-key", nftUrl);
        Assert.DoesNotContain("  ", nftUrl);
        Assert.Contains("my-api-key", baseUrl);
        Assert.DoesNotContain("  ", baseUrl);
    }

    [Fact]
    public void DefaultValues_AreCorrect()
    {
        var options = new AlchemyOptions();

        Assert.Equal(string.Empty, options.ApiKey);
        Assert.Equal(string.Empty, options.NftUrl);
        Assert.Equal(string.Empty, options.BaseRpcUrl);
        Assert.Equal(string.Empty, options.ArbitrumRpcUrl);
        Assert.Equal(string.Empty, options.SolanaRpcUrl);
        Assert.Equal(string.Empty, options.EthereumRpcUrl);
    }
}
