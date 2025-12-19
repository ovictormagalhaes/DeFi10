using DeFi10.API.Aggregation;
using DeFi10.API.Models;
using Xunit;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Tests.Aggregation;

public class TokenFactoryTests
{
    private readonly TokenFactory _sut;

    public TokenFactoryTests()
    {
        _sut = new TokenFactory();
    }

    #region CreateSupplied Tests

    [Fact]
    public void CreateSupplied_WithValidInputs_CreatesCorrectToken()
    {
        var token = _sut.CreateSupplied("Ethereum", "ETH", "0x123", ChainEnum.Ethereum, 18, 1.5m, 2000m);
        
        Assert.Equal(TokenType.Supplied, token.Type);
        Assert.Equal("Ethereum", token.Name);
        Assert.Equal("ETH", token.Symbol);
        Assert.Equal("0x123", token.ContractAddress);
        Assert.Equal(ChainEnum.Ethereum.ToChainId(), token.Chain);
        Assert.NotNull(token.Financials);
        Assert.Equal(18, token.Financials.DecimalPlaces);
        Assert.Equal(1.5m, token.Financials.BalanceFormatted);
        Assert.Equal(2000m, token.Financials.Price);
        Assert.Equal(3000m, token.Financials.TotalPrice); // 1.5 * 2000
    }

    [Fact]
    public void CreateSupplied_WithNullName_UsesEmptyString()
    {
        var token = _sut.CreateSupplied(null!, "TKN", "0x123", ChainEnum.Base, 18, 1m, 10m);
        
        Assert.Equal(string.Empty, token.Name);
    }

    [Fact]
    public void CreateSupplied_WithNullSymbol_UsesEmptyString()
    {
        var token = _sut.CreateSupplied("Token", null!, "0x123", ChainEnum.Base, 18, 1m, 10m);
        
        Assert.Equal(string.Empty, token.Symbol);
    }

    [Fact]
    public void CreateSupplied_WithNullContract_UsesEmptyString()
    {
        var token = _sut.CreateSupplied("Token", "TKN", null!, ChainEnum.Base, 18, 1m, 10m);
        
        Assert.Equal(string.Empty, token.ContractAddress);
    }

    [Fact]
    public void CreateSupplied_WithZeroPrice_CalculatesZeroTotalPrice()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 100m, 0m);
        
        Assert.Equal(0m, token.Financials!.Price);
        Assert.Equal(0m, token.Financials.TotalPrice);
    }

    #endregion

    #region CreateBorrowed Tests

    [Fact]
    public void CreateBorrowed_WithValidInputs_CreatesCorrectToken()
    {
        var token = _sut.CreateBorrowed("USDC", "USDC", "0xA0b86991", ChainEnum.Ethereum, 6, 1000m, 1m);
        
        Assert.Equal(TokenType.Borrowed, token.Type);
        Assert.Equal("USDC", token.Name);
        Assert.Equal(6, token.Financials!.DecimalPlaces);
        Assert.Equal(1000m, token.Financials.BalanceFormatted);
        Assert.Equal(1m, token.Financials.Price);
        Assert.Equal(1000m, token.Financials.TotalPrice);
    }

    #endregion

    #region CreateUncollectedReward Tests

    [Fact]
    public void CreateUncollectedReward_WithValidInputs_CreatesCorrectToken()
    {
        var token = _sut.CreateUncollectedReward("Reward Token", "RWD", "0x456", ChainEnum.Base, 18, 50m, 5m);
        
        Assert.Equal(TokenType.LiquidityUncollectedFee, token.Type);
        Assert.Equal("Reward Token", token.Name);
        Assert.Equal(250m, token.Financials!.TotalPrice); // 50 * 5
    }

    #endregion

    #region CreateStaked Tests

    [Fact]
    public void CreateStaked_WithValidInputs_CreatesSuppliedType()
    {
        var token = _sut.CreateStaked("Staked ETH", "stETH", "0x789", ChainEnum.Ethereum, 18, 2m, 2100m);
        
        Assert.Equal(TokenType.Supplied, token.Type); // Staked creates Supplied type
        Assert.Equal("Staked ETH", token.Name);
        Assert.Equal(4200m, token.Financials!.TotalPrice);
    }

    #endregion

    #region CreateGovernancePower Tests

    [Fact]
    public void CreateGovernancePower_WithValidInputs_CreatesZeroPriceToken()
    {
        var token = _sut.CreateGovernancePower("Governance", "GOV", "0xGOV", ChainEnum.Base, 18, 1000m);
        
        Assert.Equal(TokenType.GovernancePower, token.Type);
        Assert.Equal("Governance", token.Name);
        Assert.Equal(0m, token.Financials!.Price);
        Assert.Equal(0m, token.Financials.TotalPrice);
        Assert.Equal(1000m, token.Financials.BalanceFormatted);
    }

    #endregion

    #region Decimal Places Clamping Tests

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(-100, 0)]
    [InlineData(0, 0)]
    [InlineData(18, 18)]
    [InlineData(28, 28)]
    [InlineData(29, 28)]
    [InlineData(100, 28)]
    public void CreateSupplied_ClampsDecimalPlaces(int input, int expected)
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, input, 1m, 1m);
        
        Assert.Equal(expected, token.Financials!.DecimalPlaces);
    }

    #endregion

    #region Negative Value Handling Tests

    [Fact]
    public void CreateSupplied_WithNegativeAmount_ClampsToZero()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, -100m, 10m);
        
        Assert.Equal(0m, token.Financials!.BalanceFormatted);
        Assert.Equal(0m, token.Financials.TotalPrice);
    }

    [Fact]
    public void CreateSupplied_WithNegativePrice_ClampsToZero()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 100m, -10m);
        
        Assert.Equal(0m, token.Financials!.Price);
        Assert.Equal(0m, token.Financials.TotalPrice);
    }

    [Fact]
    public void CreateSupplied_WithBothNegative_ClampsToZero()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, -100m, -10m);
        
        Assert.Equal(0m, token.Financials!.BalanceFormatted);
        Assert.Equal(0m, token.Financials!.Price);
        Assert.Equal(0m, token.Financials.TotalPrice);
    }

    #endregion

    #region Raw Amount Calculation Tests

    [Fact]
    public void CreateSupplied_CalculatesRawAmount_18Decimals()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 1m, 1m);
        
        Assert.Equal(1_000_000_000_000_000_000m, token.Financials!.Amount);
    }

    [Fact]
    public void CreateSupplied_CalculatesRawAmount_6Decimals()
    {
        var token = _sut.CreateSupplied("USDC", "USDC", "0x123", ChainEnum.Base, 6, 1000m, 1m);
        
        Assert.Equal(1_000_000_000m, token.Financials!.Amount);
    }

    [Fact]
    public void CreateSupplied_CalculatesRawAmount_0Decimals()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 0, 100m, 1m);
        
        Assert.Equal(100m, token.Financials!.Amount);
    }

    #endregion

    #region Overflow Protection Tests

    [Fact]
    public void CreateSupplied_WithVeryLargeAmount_HandlesGracefully()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 
            1_000_000_000m, // 1 billion
            1m);
        
        Assert.NotNull(token.Financials);
        Assert.True(token.Financials.Amount >= 0);
    }

    [Fact]
    public void CreateSupplied_WithVeryLargePrice_HandlesGracefully()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 
            1m, 
            1_000_000_000m); // 1 billion per token
        
        Assert.NotNull(token.Financials);
        Assert.True(token.Financials.TotalPrice >= 0);
    }

    [Fact]
    public void CreateSupplied_WithBothVeryLarge_HandlesGracefully()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 
            100_000_000m, // 100 million
            100_000m); // 100k per token
        
        Assert.NotNull(token.Financials);
        // SafeMultiply should handle this without throwing
    }

    #endregion

    #region Different Chains Tests

    [Theory]
    [InlineData(ChainEnum.Ethereum)]
    [InlineData(ChainEnum.Base)]
    [InlineData(ChainEnum.Arbitrum)]
    [InlineData(ChainEnum.Polygon)]
    [InlineData(ChainEnum.Optimism)]
    [InlineData(ChainEnum.Solana)]
    [InlineData(ChainEnum.BNB)]
    public void CreateSupplied_WithDifferentChains_SetsCorrectChainId(ChainEnum chain)
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", chain, 18, 1m, 1m);
        
        Assert.Equal(chain.ToChainId(), token.Chain);
    }

    #endregion

    #region Precision Tests

    [Fact]
    public void CreateSupplied_WithHighPrecisionAmount_MaintainsPrecision()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 0.000000000000000001m, 1m);
        
        Assert.Equal(0.000000000000000001m, token.Financials!.BalanceFormatted);
    }

    [Fact]
    public void CreateSupplied_WithHighPrecisionPrice_MaintainsPrecision()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 1m, 0.00000001m);
        
        Assert.Equal(0.00000001m, token.Financials!.Price);
    }

    [Fact]
    public void CreateSupplied_CalculatesTotalPrice_WithPrecision()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 0.123456789m, 987.654321m);
        
        var expected = 0.123456789m * 987.654321m;
        Assert.Equal(expected, token.Financials!.TotalPrice); // Compare decimals
    }

    #endregion

    #region Edge Case Tests

    [Fact]
    public void CreateSupplied_WithMaxDecimal_DoesNotThrow()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 
            decimal.MaxValue / 1_000_000_000_000_000_000m, // Avoid overflow in raw amount
            1m);
        
        Assert.NotNull(token.Financials);
    }

    [Fact]
    public void CreateSupplied_WithZeroAmountAndZeroPrice_CreatesZeroToken()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 0m, 0m);
        
        Assert.Equal(0m, token.Financials!.Amount);
        Assert.Equal(0m, token.Financials.BalanceFormatted);
        Assert.Equal(0m, token.Financials.Price);
        Assert.Equal(0m, token.Financials.TotalPrice);
    }

    [Fact]
    public void CreateSupplied_WithVerySmallAmount_CalculatesCorrectly()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 6, 0.000001m, 1000000m);
        
        Assert.Equal(1m, token.Financials!.TotalPrice); // 0.000001 * 1,000,000 = 1
    }

    #endregion

    #region Token Type Consistency Tests

    [Fact]
    public void AllFactoryMethods_CreateTokensWithCorrectTypes()
    {
        var supplied = _sut.CreateSupplied("T", "T", "0x1", ChainEnum.Base, 18, 1m, 1m);
        var borrowed = _sut.CreateBorrowed("T", "T", "0x1", ChainEnum.Base, 18, 1m, 1m);
        var reward = _sut.CreateUncollectedReward("T", "T", "0x1", ChainEnum.Base, 18, 1m, 1m);
        var staked = _sut.CreateStaked("T", "T", "0x1", ChainEnum.Base, 18, 1m, 1m);
        var governance = _sut.CreateGovernancePower("T", "T", "0x1", ChainEnum.Base, 18, 1m);
        
        Assert.Equal(TokenType.Supplied, supplied.Type);
        Assert.Equal(TokenType.Borrowed, borrowed.Type);
        Assert.Equal(TokenType.LiquidityUncollectedFee, reward.Type);
        Assert.Equal(TokenType.Supplied, staked.Type);
        Assert.Equal(TokenType.GovernancePower, governance.Type);
    }

    #endregion

    #region SafeMultiply Edge Cases Tests

    [Theory]
    [InlineData(0, 1000000)]
    [InlineData(1000000, 0)]
    [InlineData(0, 0)]
    public void CreateSupplied_SafeMultiplyWithZero_ReturnsZero(decimal amount, decimal price)
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 0, amount, price);
        
        Assert.Equal(0m, token.Financials!.TotalPrice);
    }

    [Fact]
    public void CreateSupplied_WithModerateValues_CalculatesExactly()
    {
        var token = _sut.CreateSupplied("Token", "TKN", "0x123", ChainEnum.Base, 18, 50_000_000m, 50_000_000m);
        
        var expected = 50_000_000m * 50_000_000m;
        Assert.Equal(expected, token.Financials!.TotalPrice);
    }

    #endregion
}
