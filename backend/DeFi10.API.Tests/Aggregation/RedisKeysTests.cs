using DeFi10.API.Aggregation;
using Xunit;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Tests.Aggregation;

public class RedisKeysTests
{
    #region ActiveJob Tests

    [Fact]
    public void ActiveJob_SingleChain_CreatesCorrectKey()
    {
        var accounts = new[] { "0xabc123" };
        var chains = new[] { ChainEnum.Ethereum };
        
        var result = RedisKeys.ActiveJob(accounts, chains);
        
        Assert.NotEmpty(result);
        Assert.StartsWith("wallet:agg:active:", result);
    }

    [Fact]
    public void ActiveJob_MultipleChains_CreatesConsistentHash()
    {
        var accounts = new[] { "0xabc123" };
        var chains = new[] { ChainEnum.Polygon, ChainEnum.Ethereum, ChainEnum.BNB };
        
        var result = RedisKeys.ActiveJob(accounts, chains);
        
        Assert.NotEmpty(result);
        Assert.StartsWith("wallet:agg:active:", result);
    }

    [Fact]
    public void ActiveJob_ChainsInDifferentOrder_ProducesSameKey()
    {
        var accounts = new[] { "0xabc123" };
        var chains1 = new[] { ChainEnum.Ethereum, ChainEnum.Polygon, ChainEnum.BNB };
        var chains2 = new[] { ChainEnum.BNB, ChainEnum.Polygon, ChainEnum.Ethereum };
        
        var result1 = RedisKeys.ActiveJob(accounts, chains1);
        var result2 = RedisKeys.ActiveJob(accounts, chains2);
        
        Assert.Equal(result1, result2);
    }

    [Fact]
    public void ActiveJob_EmptyChains_CreatesValidHash()
    {
        var accounts = new[] { "0xabc123" };
        var chains = Array.Empty<ChainEnum>();
        
        var result = RedisKeys.ActiveJob(accounts, chains);
        
        Assert.NotEmpty(result);
        Assert.StartsWith("wallet:agg:active:", result);
    }

    [Fact]
    public void ActiveJob_DuplicateChains_CreatesValidHash()
    {
        var accounts = new[] { "0xabc123" };
        var chains = new[] { ChainEnum.Ethereum, ChainEnum.Ethereum };
        
        var result = RedisKeys.ActiveJob(accounts, chains);
        
        Assert.NotEmpty(result);
        Assert.StartsWith("wallet:agg:active:", result);
    }

    #endregion

    #region ActiveWalletGroup Tests

    [Fact]
    public void ActiveWalletGroup_CreatesCorrectKey()
    {
        var groupId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        var chains = new[] { ChainEnum.Ethereum };
        
        var result = RedisKeys.ActiveWalletGroup(groupId, chains);
        
        Assert.Equal("wallet:agg:active:group:12345678-1234-1234-1234-123456789abc:Ethereum", result);
    }

    [Fact]
    public void ActiveWalletGroup_MultipleChains_SortsChains()
    {
        var groupId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        var chains = new[] { ChainEnum.Polygon, ChainEnum.Ethereum, ChainEnum.BNB };
        
        var result = RedisKeys.ActiveWalletGroup(groupId, chains);
        
        Assert.Equal("wallet:agg:active:group:12345678-1234-1234-1234-123456789abc:BNB+Ethereum+Polygon", result);
    }

    [Fact]
    public void ActiveWalletGroup_EmptyGuid_CreatesKeyWithEmptyGuid()
    {
        var groupId = Guid.Empty;
        var chains = new[] { ChainEnum.Ethereum };
        
        var result = RedisKeys.ActiveWalletGroup(groupId, chains);
        
        Assert.Equal("wallet:agg:active:group:00000000-0000-0000-0000-000000000000:Ethereum", result);
    }

    #endregion

    #region Meta Tests

    [Fact]
    public void Meta_CreatesCorrectKey()
    {
        var jobId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        
        var result = RedisKeys.Meta(jobId);
        
        Assert.Equal("wallet:agg:12345678-1234-1234-1234-123456789abc:meta", result);
    }

    [Fact]
    public void Meta_EmptyGuid_CreatesKeyWithEmptyGuid()
    {
        var jobId = Guid.Empty;
        
        var result = RedisKeys.Meta(jobId);
        
        Assert.Equal("wallet:agg:00000000-0000-0000-0000-000000000000:meta", result);
    }

    [Fact]
    public void Meta_DifferentGuids_CreatesDifferentKeys()
    {
        var jobId1 = Guid.NewGuid();
        var jobId2 = Guid.NewGuid();
        
        var result1 = RedisKeys.Meta(jobId1);
        var result2 = RedisKeys.Meta(jobId2);
        
        Assert.NotEqual(result1, result2);
    }

    #endregion

    #region Pending Tests

    [Fact]
    public void Pending_CreatesCorrectKey()
    {
        var jobId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        
        var result = RedisKeys.Pending(jobId);
        
        Assert.Equal("wallet:agg:12345678-1234-1234-1234-123456789abc:pending", result);
    }

    [Fact]
    public void Pending_EmptyGuid_CreatesKeyWithEmptyGuid()
    {
        var jobId = Guid.Empty;
        
        var result = RedisKeys.Pending(jobId);
        
        Assert.Equal("wallet:agg:00000000-0000-0000-0000-000000000000:pending", result);
    }

    #endregion

    #region ResultPrefix Tests

    [Fact]
    public void ResultPrefix_CreatesCorrectKey()
    {
        var jobId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        
        var result = RedisKeys.ResultPrefix(jobId);
        
        Assert.Equal("wallet:agg:12345678-1234-1234-1234-123456789abc:result:", result);
    }

    [Fact]
    public void ResultPrefix_EndsWithColon()
    {
        var jobId = Guid.NewGuid();
        
        var result = RedisKeys.ResultPrefix(jobId);
        
        Assert.EndsWith(":", result);
    }

    [Fact]
    public void ResultPrefix_CanBeUsedAsPrefix()
    {
        var jobId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        var prefix = RedisKeys.ResultPrefix(jobId);
        
        var fullKey = prefix + "ethereum";
        
        Assert.Equal("wallet:agg:12345678-1234-1234-1234-123456789abc:result:ethereum", fullKey);
    }

    #endregion

    #region Summary Tests

    [Fact]
    public void Summary_CreatesCorrectKey()
    {
        var jobId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        
        var result = RedisKeys.Summary(jobId);
        
        Assert.Equal("wallet:agg:12345678-1234-1234-1234-123456789abc:summary", result);
    }

    [Fact]
    public void Summary_EmptyGuid_CreatesKeyWithEmptyGuid()
    {
        var jobId = Guid.Empty;
        
        var result = RedisKeys.Summary(jobId);
        
        Assert.Equal("wallet:agg:00000000-0000-0000-0000-000000000000:summary", result);
    }

    #endregion

    #region Wallet Tests

    [Fact]
    public void Wallet_CreatesCorrectKey()
    {
        var jobId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        
        var result = RedisKeys.Wallet(jobId);
        
        Assert.Equal("wallet:agg:12345678-1234-1234-1234-123456789abc:wallet", result);
    }

    [Fact]
    public void Wallet_EmptyGuid_CreatesKeyWithEmptyGuid()
    {
        var jobId = Guid.Empty;
        
        var result = RedisKeys.Wallet(jobId);
        
        Assert.Equal("wallet:agg:00000000-0000-0000-0000-000000000000:wallet", result);
    }

    #endregion

    #region Index Tests

    [Fact]
    public void Index_CreatesCorrectKey()
    {
        var result = RedisKeys.Index("0xabc123");
        
        Assert.Equal("wallet:agg:index:0xabc123", result);
    }

    [Theory]
    [InlineData("0x123", "wallet:agg:index:0x123")]
    [InlineData("wallet1", "wallet:agg:index:wallet1")]
    [InlineData("ABC", "wallet:agg:index:ABC")]
    [InlineData("", "wallet:agg:index:")]
    public void Index_VariousAccounts_CreatesExpectedKeys(string account, string expected)
    {
        var result = RedisKeys.Index(account);
        
        Assert.Equal(expected, result);
    }

    #endregion

    #region WalletCache Tests

    [Fact]
    public void WalletCache_CreatesCorrectKey()
    {
        var result = RedisKeys.WalletCache("0xabc123", ChainEnum.Ethereum, "Alchemy");
        
        Assert.Equal("wallet:cache:0xabc123:ethereum:alchemy", result);
    }

    [Fact]
    public void WalletCache_ConvertsToLowerCase()
    {
        var result = RedisKeys.WalletCache("0xABC123", ChainEnum.Polygon, "MORALIS");
        
        Assert.Equal("wallet:cache:0xABC123:polygon:moralis", result);
    }

    [Theory]
    [InlineData("0x123", ChainEnum.Ethereum, "alchemy", "wallet:cache:0x123:ethereum:alchemy")]
    [InlineData("wallet1", ChainEnum.Polygon, "moralis", "wallet:cache:wallet1:polygon:moralis")]
    [InlineData("ABC", ChainEnum.BNB, "provider", "wallet:cache:ABC:bnb:provider")]
    public void WalletCache_VariousInputs_CreatesExpectedKeys(string account, ChainEnum chain, string provider, string expected)
    {
        var result = RedisKeys.WalletCache(account, chain, provider);
        
        Assert.Equal(expected, result);
    }

    [Fact]
    public void WalletCache_EmptyProvider_CreatesKeyWithEmpty()
    {
        var result = RedisKeys.WalletCache("0xabc123", ChainEnum.Ethereum, "");
        
        Assert.Equal("wallet:cache:0xabc123:ethereum:", result);
    }

    #endregion

    #region WalletCachePattern Tests

    [Fact]
    public void WalletCachePattern_CreatesCorrectPattern()
    {
        var result = RedisKeys.WalletCachePattern("0xabc123");
        
        Assert.Equal("wallet:cache:0xabc123:*", result);
    }

    [Theory]
    [InlineData("0x123", "wallet:cache:0x123:*")]
    [InlineData("wallet1", "wallet:cache:wallet1:*")]
    [InlineData("ABC", "wallet:cache:ABC:*")]
    [InlineData("", "wallet:cache::*")]
    public void WalletCachePattern_VariousAccounts_CreatesExpectedPatterns(string account, string expected)
    {
        var result = RedisKeys.WalletCachePattern(account);
        
        Assert.Equal(expected, result);
    }

    [Fact]
    public void WalletCachePattern_EndsWithWildcard()
    {
        var result = RedisKeys.WalletCachePattern("0xabc123");
        
        Assert.EndsWith("*", result);
    }

    [Fact]
    public void WalletCachePattern_MatchesWalletCacheKeys()
    {
        var account = "0xabc123";
        var pattern = RedisKeys.WalletCachePattern(account);
        var key1 = RedisKeys.WalletCache(account, ChainEnum.Ethereum, "alchemy");
        var key2 = RedisKeys.WalletCache(account, ChainEnum.Polygon, "moralis");
        
        Assert.StartsWith(pattern.TrimEnd('*'), key1);
        Assert.StartsWith(pattern.TrimEnd('*'), key2);
    }

    #endregion

    #region Consistency Tests

    [Fact]
    public void AllKeys_WithSameJobId_ShareCommonPrefix()
    {
        var jobId = Guid.Parse("12345678-1234-1234-1234-123456789abc");
        var prefix = $"wallet:agg:{jobId}:";
        
        var meta = RedisKeys.Meta(jobId);
        var pending = RedisKeys.Pending(jobId);
        var resultPrefix = RedisKeys.ResultPrefix(jobId);
        var summary = RedisKeys.Summary(jobId);
        var wallet = RedisKeys.Wallet(jobId);
        
        Assert.StartsWith(prefix, meta);
        Assert.StartsWith(prefix, pending);
        Assert.StartsWith(prefix, resultPrefix);
        Assert.StartsWith(prefix, summary);
        Assert.StartsWith(prefix, wallet);
    }

    [Fact]
    public void ActiveKeys_AllStartWithActivePrefix()
    {
        var activePrefix = "wallet:agg:active:";
        
        var accounts = new[] { "0xabc" };
        var job = RedisKeys.ActiveJob(accounts, new[] { ChainEnum.Ethereum });
        var group = RedisKeys.ActiveWalletGroup(Guid.NewGuid(), new[] { ChainEnum.Ethereum });
        
        Assert.StartsWith(activePrefix, job);
        Assert.StartsWith(activePrefix, group);
    }

    #endregion
}
