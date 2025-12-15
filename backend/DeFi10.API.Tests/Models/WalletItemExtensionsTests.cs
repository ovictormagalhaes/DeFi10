using DeFi10.API.Models;
using Xunit;

namespace DeFi10.API.Tests.Models;

public class WalletItemExtensionsTests
{
    #region PopulateKeys Single Item Tests

    [Fact]
    public void PopulateKeys_WithCompleteWalletItem_PopulatesAllKeys()
    {
        var walletItem = new WalletItem
        {
            Protocol = new Protocol
            {
                Id = "aave",
                Name = "Aave",
                Chain = "ethereum",
                Url = "https://aave.com",
                Logo = "logo.png"
            },
            Position = new Position
            {
                Label = "Lending",
                Tokens = new List<Token>
                {
                    new Token { Symbol = "USDC", Name = "USD Coin" },
                    new Token { Symbol = "ETH", Name = "Ethereum" }
                }
            }
        };

        walletItem.PopulateKeys();

        Assert.Equal("aave-ethereum-aave", walletItem.Position.ProtocolKey);
        Assert.NotNull(walletItem.Position.Key);
        Assert.All(walletItem.Position.Tokens, token => 
            Assert.Equal(walletItem.Position.Key, token.PositionKey));
    }

    [Fact]
    public void PopulateKeys_WithNullProtocol_DoesNotThrow()
    {
        var walletItem = new WalletItem
        {
            Protocol = null,
            Position = new Position { Label = "Test" }
        };

        var exception = Record.Exception(() => walletItem.PopulateKeys());

        Assert.Null(exception);
    }

    [Fact]
    public void PopulateKeys_WithNullPosition_DoesNotThrow()
    {
        var walletItem = new WalletItem
        {
            Protocol = new Protocol { Id = "test", Name = "Test", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = null
        };

        var exception = Record.Exception(() => walletItem.PopulateKeys());

        Assert.Null(exception);
    }

    [Fact]
    public void PopulateKeys_WithNullWalletItem_DoesNotThrow()
    {
        WalletItem? walletItem = null;

        var exception = Record.Exception(() => walletItem.PopulateKeys());

        Assert.Null(exception);
    }

    [Fact]
    public void PopulateKeys_WithNullTokens_DoesNotThrow()
    {
        var walletItem = new WalletItem
        {
            Protocol = new Protocol { Id = "uniswap", Name = "Uniswap", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position { Label = "LP", Tokens = null }
        };

        var exception = Record.Exception(() => walletItem.PopulateKeys());

        Assert.Null(exception);
        Assert.Equal("uniswap-ethereum-uniswap", walletItem.Position.ProtocolKey);
    }

    [Fact]
    public void PopulateKeys_WithEmptyTokensList_SetsProtocolKeyAndPositionKey()
    {
        var walletItem = new WalletItem
        {
            Protocol = new Protocol { Id = "compound", Name = "Compound", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position { Label = "Lending", Tokens = new List<Token>() }
        };

        walletItem.PopulateKeys();

        Assert.Equal("compound-ethereum-compound", walletItem.Position.ProtocolKey);
        Assert.NotNull(walletItem.Position.Key);
    }

    [Fact]
    public void PopulateKeys_ProtocolKeyPropagatedToPosition()
    {
        var walletItem = new WalletItem
        {
            Protocol = new Protocol { Id = "test-protocol-123", Name = "Test", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position { Label = "Test Position" }
        };

        walletItem.PopulateKeys();

        Assert.Equal("test-ethereum-test-protocol-123", walletItem.Position.ProtocolKey);
    }

    [Fact]
    public void PopulateKeys_PositionKeyPropagatedToTokens()
    {
        var walletItem = new WalletItem
        {
            Protocol = new Protocol { Id = "aave", Name = "Aave", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position
            {
                Label = "Lending",
                Tokens = new List<Token>
                {
                    new Token { Symbol = "DAI" },
                    new Token { Symbol = "USDC" },
                    new Token { Symbol = "USDT" }
                }
            }
        };

        walletItem.PopulateKeys();

        var positionKey = walletItem.Position.Key;
        Assert.NotNull(positionKey);
        Assert.All(walletItem.Position.Tokens, token => Assert.Equal(positionKey, token.PositionKey));
    }

    [Fact]
    public void PopulateKeys_TokensHaveSamePositionKey()
    {
        var walletItem = new WalletItem
        {
            Protocol = new Protocol { Id = "curve", Name = "Curve", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position
            {
                Label = "Pool",
                Tokens = new List<Token>
                {
                    new Token { Symbol = "CRV" },
                    new Token { Symbol = "3CRV" }
                }
            }
        };

        walletItem.PopulateKeys();

        var firstTokenKey = walletItem.Position.Tokens[0].PositionKey;
        var secondTokenKey = walletItem.Position.Tokens[1].PositionKey;
        
        Assert.Equal(firstTokenKey, secondTokenKey);
        Assert.Equal(walletItem.Position.Key, firstTokenKey);
    }

    #endregion

    #region PopulateKeys Collection Tests

    [Fact]
    public void PopulateKeys_WithMultipleItems_PopulatesAllItems()
    {
        var items = new List<WalletItem>
        {
            new WalletItem
            {
                Protocol = new Protocol { Id = "aave", Name = "Aave", Chain = "ethereum", Url = "url", Logo = "logo" },
                Position = new Position { Label = "Lending", Tokens = new List<Token> { new Token { Symbol = "DAI" } } }
            },
            new WalletItem
            {
                Protocol = new Protocol { Id = "uniswap", Name = "Uniswap", Chain = "ethereum", Url = "url", Logo = "logo" },
                Position = new Position { Label = "LP", Tokens = new List<Token> { new Token { Symbol = "UNI" } } }
            }
        };

        items.PopulateKeys();

        Assert.Equal("aave-ethereum-aave", items[0].Position.ProtocolKey);
        Assert.Equal("uniswap-ethereum-uniswap", items[1].Position.ProtocolKey);
        Assert.NotNull(items[0].Position.Tokens[0].PositionKey);
        Assert.NotNull(items[1].Position.Tokens[0].PositionKey);
    }

    [Fact]
    public void PopulateKeys_WithEmptyCollection_DoesNotThrow()
    {
        var items = new List<WalletItem>();

        var exception = Record.Exception(() => items.PopulateKeys());

        Assert.Null(exception);
    }

    [Fact]
    public void PopulateKeys_WithNullCollection_DoesNotThrow()
    {
        IEnumerable<WalletItem>? items = null;

        var exception = Record.Exception(() => items.PopulateKeys());

        Assert.Null(exception);
    }

    [Fact]
    public void PopulateKeys_WithMixedValidAndInvalidItems_ProcessesValidItems()
    {
        var items = new List<WalletItem>
        {
            new WalletItem
            {
                Protocol = new Protocol { Id = "valid", Name = "Valid", Chain = "ethereum", Url = "url", Logo = "logo" },
                Position = new Position { Label = "Valid", Tokens = new List<Token> { new Token { Symbol = "TOKEN" } } }
            },
            new WalletItem { Protocol = null, Position = null },
            new WalletItem
            {
                Protocol = new Protocol { Id = "valid2", Name = "Valid2", Chain = "ethereum", Url = "url", Logo = "logo" },
                Position = new Position { Label = "Valid2" }
            }
        };

        var exception = Record.Exception(() => items.PopulateKeys());

        Assert.Null(exception);
        Assert.Equal("valid-ethereum-valid", items[0].Position.ProtocolKey);
        Assert.Equal("valid2-ethereum-valid2", items[2].Position.ProtocolKey);
    }

    [Fact]
    public void PopulateKeys_EachItemHasUniquePositionKey()
    {
        var items = new List<WalletItem>
        {
            new WalletItem
            {
                Protocol = new Protocol { Id = "protocol1", Name = "Protocol1", Chain = "ethereum", Url = "url", Logo = "logo" },
                Position = new Position { Label = "Position1" }
            },
            new WalletItem
            {
                Protocol = new Protocol { Id = "protocol2", Name = "Protocol2", Chain = "ethereum", Url = "url", Logo = "logo" },
                Position = new Position { Label = "Position2" }
            }
        };

        items.PopulateKeys();

        Assert.NotEqual(items[0].Position.Key, items[1].Position.Key);
    }

    [Fact]
    public void PopulateKeys_LargeCollection_ProcessesAllItems()
    {
        var items = Enumerable.Range(1, 100).Select(i => new WalletItem
        {
            Protocol = new Protocol { Id = $"protocol{i}", Name = $"Protocol{i}", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position
            {
                Label = $"Position{i}",
                Tokens = new List<Token> { new Token { Symbol = $"TOKEN{i}" } }
            }
        }).ToList();

        items.PopulateKeys();

        Assert.All(items, item =>
        {
            Assert.NotNull(item.Position.ProtocolKey);
            Assert.NotNull(item.Position.Key);
            Assert.NotNull(item.Position.Tokens[0].PositionKey);
        });
    }

    #endregion

    #region Key Consistency Tests

    [Fact]
    public void PopulateKeys_CalledTwice_UsesExistingPositionKey()
    {
        var walletItem = new WalletItem
        {
            Protocol = new Protocol { Id = "protocol1", Name = "Protocol1", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position
            {
                Label = "Position",
                Tokens = new List<Token> { new Token { Symbol = "TOKEN" } }
            }
        };

        walletItem.PopulateKeys();
        var firstProtocolKey = walletItem.Position.ProtocolKey;
        var firstPositionKey = walletItem.Position.Key;
        var firstTokenKey = walletItem.Position.Tokens[0].PositionKey;

        walletItem.PopulateKeys();
        var secondProtocolKey = walletItem.Position.ProtocolKey;
        var secondPositionKey = walletItem.Position.Key;
        var secondTokenKey = walletItem.Position.Tokens[0].PositionKey;

        Assert.Equal(firstProtocolKey, secondProtocolKey);
        Assert.Equal(firstPositionKey, secondPositionKey);
        Assert.Equal(firstTokenKey, secondTokenKey);
    }

    [Fact]
    public void PopulateKeys_WithDifferentProtocolIds_GeneratesDifferentKeys()
    {
        var item1 = new WalletItem
        {
            Protocol = new Protocol { Id = "aave", Name = "Aave", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position { Label = "Lending" }
        };

        var item2 = new WalletItem
        {
            Protocol = new Protocol { Id = "compound", Name = "Compound", Chain = "ethereum", Url = "url", Logo = "logo" },
            Position = new Position { Label = "Lending" }
        };

        item1.PopulateKeys();
        item2.PopulateKeys();

        Assert.NotEqual(item1.Position.ProtocolKey, item2.Position.ProtocolKey);
        Assert.NotEqual(item1.Position.Key, item2.Position.Key);
    }

    #endregion
}
