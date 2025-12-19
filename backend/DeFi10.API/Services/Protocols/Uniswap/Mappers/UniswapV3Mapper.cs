using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using System.Globalization;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Helpers;

namespace DeFi10.API.Services.Protocols.Uniswap.Mappers;

public class UniswapV3Mapper : IWalletItemMapper<UniswapV3GetActivePoolsResponse>
{
    private readonly IUniswapV3OnChainService _uniswapV3OnChainService;
    private readonly ILogger<UniswapV3Mapper> _logger;
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;
    private readonly ITokenMetadataService _metadataService;

    public UniswapV3Mapper(
        IUniswapV3OnChainService uniswapV3OnChainService, 
        ILogger<UniswapV3Mapper> logger, 
        ITokenFactory tokenFactory, 
        IProtocolConfigurationService protocolConfig, 
        IChainConfigurationService chainConfig,
        ITokenMetadataService metadataService)
    { 
        _uniswapV3OnChainService = uniswapV3OnChainService; 
        _logger = logger; 
        _tokenFactory = tokenFactory; 
        _protocolConfig = protocolConfig; 
        _chainConfig = chainConfig; 
        _metadataService = metadataService;
    }

    public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);
    
    public IEnumerable<ChainEnum> GetSupportedChains() => 
        _protocolConfig.GetEnabledChainEnums(ProtocolNames.UniswapV3);

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        var def = _protocolConfig.GetProtocol(ProtocolNames.UniswapV3) 
            ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.UniswapV3}");
        return def.ToProtocol(chain, _chainConfig);
    }

    public async Task<List<WalletItem>> MapAsync(UniswapV3GetActivePoolsResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain)) throw new NotSupportedException($"Chain {chain} is not supported by {ProtocolNames.UniswapV3}");
        if (response?.Data?.Positions == null) return new List<WalletItem>();

        var nativePriceUSD = TryParseInvariant(response.Data.Bundles?.FirstOrDefault()?.NativePriceUSD) ?? 0m;
        if (nativePriceUSD <= 0) _logger.LogWarning("UniV3 nativePriceUSD=0 chain={Chain}", chain);
        else _logger.LogDebug("UniV3 nativePriceUSD={Price} chain={Chain}", nativePriceUSD, chain);

        var walletItems = new List<WalletItem>();
        var protocol = GetProtocolDefinition(chain);
        
        foreach (var position in response.Data.Positions)
        {
            var item = await ProcessPositionAsync(position, chain, nativePriceUSD, protocol);
            if (item != null) walletItems.Add(item);
        }
        
        return walletItems;
    }
    
    private async Task<WalletItem?> ProcessPositionAsync(UniswapV3Position position, ChainEnum chain, decimal nativePriceUSD, Protocol protocol)
    {
        try
        {
            int token0Decimals = (int)(TryParseInvariantInt(position.Token0.Decimals) ?? 0);
            int token1Decimals = (int)(TryParseInvariantInt(position.Token1.Decimals) ?? 0);
            var depositedToken0 = TryParseInvariant(position.DepositedToken0) ?? 0m;
            var withdrawnToken0 = TryParseInvariant(position.WithdrawnToken0) ?? 0m;
            var depositedToken1 = TryParseInvariant(position.DepositedToken1) ?? 0m;
            var withdrawnToken1 = TryParseInvariant(position.WithdrawnToken1) ?? 0m;
            var currentSupplyToken0 = depositedToken0 - withdrawnToken0;
            var currentSupplyToken1 = depositedToken1 - withdrawnToken1;
            var feesToken0 = TryParseInvariant(position.EstimatedUncollectedToken0) ?? 0m;
            var feesToken1 = TryParseInvariant(position.EstimatedUncollectedToken1) ?? 0m;
            currentSupplyToken0 = ValidateTokenAmount(currentSupplyToken0, position.Id, "currentSupplyToken0");
            currentSupplyToken1 = ValidateTokenAmount(currentSupplyToken1, position.Id, "currentSupplyToken1");
            feesToken0 = ValidateTokenAmount(feesToken0, position.Id, "feesToken0");
            feesToken1 = ValidateTokenAmount(feesToken1, position.Id, "feesToken1");
            var token0DerivedNative = TryParseInvariant(position.Token0.DerivedNative) ?? 0m;
            var token1DerivedNative = TryParseInvariant(position.Token1.DerivedNative) ?? 0m;
            var ratioT1PerT0 = TryParseInvariant(position.CurrentPriceToken1PerToken0) ?? 0m;
            var token0PriceUSD = nativePriceUSD * token0DerivedNative;
            var token1PriceUSD = nativePriceUSD * token1DerivedNative;
            if (ratioT1PerT0 > 0)
            { if (token0PriceUSD > 0 && token1PriceUSD <= 0) token1PriceUSD = SafeDivide(token0PriceUSD, ratioT1PerT0); else if (token1PriceUSD > 0 && token0PriceUSD <= 0) token0PriceUSD = SafeMultiply(token1PriceUSD, ratioT1PerT0); }
            bool priceUnavailable = token0PriceUSD <= 0 && token1PriceUSD <= 0;
            if (priceUnavailable && nativePriceUSD <= 0)
            { token0PriceUSD = EstimatePriceByToken(position.Token0.Symbol, position.Token0.Id, chain); token1PriceUSD = EstimatePriceByToken(position.Token1.Symbol, position.Token1.Id, chain); if (token0PriceUSD > 0 || token1PriceUSD > 0) priceUnavailable = false; }
            if (token0PriceUSD <= 0 && token1PriceUSD <= 0)
            { token0PriceUSD = EstimatePriceByToken(position.Token0.Symbol, position.Token0.Id, chain); token1PriceUSD = EstimatePriceByToken(position.Token1.Symbol, position.Token1.Id, chain); if (token0PriceUSD > 0 || token1PriceUSD > 0) priceUnavailable = false; }
            if (token0PriceUSD < 0) token0PriceUSD = 0; if (token1PriceUSD < 0) token1PriceUSD = 0;
            var lower = TryParseInvariant(position.MinPriceToken1PerToken0); var upper = TryParseInvariant(position.MaxPriceToken1PerToken0); var current = TryParseInvariant(position.CurrentPriceToken1PerToken0); bool? inRange = position.RangeStatus?.Equals("in-range", StringComparison.OrdinalIgnoreCase);
            int? tickSpacing = TryParseInvariantInt(position.Pool?.TickSpacing); long? createdAt = TryParseInvariantLong(position.Pool?.CreatedAtUnix); var sqrtPriceX96 = string.IsNullOrEmpty(position.Pool?.SqrtPriceX96) ? null : position.Pool!.SqrtPriceX96;
            
            var supplied0 = _tokenFactory.CreateSupplied(position.Token0.Name, position.Token0.Symbol, position.Token0.Id, chain, token0Decimals, currentSupplyToken0, token0PriceUSD);
            var supplied1 = _tokenFactory.CreateSupplied(position.Token1.Name, position.Token1.Symbol, position.Token1.Id, chain, token1Decimals, currentSupplyToken1, token1PriceUSD);
            var reward0 = _tokenFactory.CreateUncollectedReward(position.Token0.Name, position.Token0.Symbol, position.Token0.Id, chain, token0Decimals, feesToken0, token0PriceUSD);
            var reward1 = _tokenFactory.CreateUncollectedReward(position.Token1.Name, position.Token1.Symbol, position.Token1.Id, chain, token1Decimals, feesToken1, token1PriceUSD);
            
            // ? FETCH LOGOS FROM TOKENMETADATASERVICE (uses in-memory cache -> Redis -> CMC)
            // Strategy 1: Lookup by address (most specific)
            var metadata0 = await _metadataService.GetTokenMetadataAsync(chain, position.Token0.Id);
            if (metadata0?.LogoUrl != null)
            {
                supplied0.Logo = metadata0.LogoUrl;
                reward0.Logo = metadata0.LogoUrl;
                _logger.LogDebug("[UniswapV3Mapper] Applied logo to token0 {Symbol} via address lookup", position.Token0.Symbol);
            }
            else if (!string.IsNullOrEmpty(position.Token0.Symbol) && !string.IsNullOrEmpty(position.Token0.Name))
            {
                // Strategy 2: Fallback to symbol+name lookup (cross-chain sharing)
                var metadata0ByName = await _metadataService.GetTokenMetadataBySymbolAndNameAsync(position.Token0.Symbol, position.Token0.Name);
                if (metadata0ByName?.LogoUrl != null)
                {
                    supplied0.Logo = metadata0ByName.LogoUrl;
                    reward0.Logo = metadata0ByName.LogoUrl;
                    _logger.LogDebug("[UniswapV3Mapper] Applied logo to token0 {Symbol} via symbol+name lookup", position.Token0.Symbol);
                }
            }
            
            var metadata1 = await _metadataService.GetTokenMetadataAsync(chain, position.Token1.Id);
            if (metadata1?.LogoUrl != null)
            {
                supplied1.Logo = metadata1.LogoUrl;
                reward1.Logo = metadata1.LogoUrl;
                _logger.LogDebug("[UniswapV3Mapper] Applied logo to token1 {Symbol} via address lookup", position.Token1.Symbol);
            }
            else if (!string.IsNullOrEmpty(position.Token1.Symbol) && !string.IsNullOrEmpty(position.Token1.Name))
            {
                var metadata1ByName = await _metadataService.GetTokenMetadataBySymbolAndNameAsync(position.Token1.Symbol, position.Token1.Name);
                if (metadata1ByName?.LogoUrl != null)
                {
                    supplied1.Logo = metadata1ByName.LogoUrl;
                    reward1.Logo = metadata1ByName.LogoUrl;
                    _logger.LogDebug("[UniswapV3Mapper] Applied logo to token1 {Symbol} via symbol+name lookup", position.Token1.Symbol);
                }
            }
            
            // ? SAVE METADATA TO REDIS (for future use / cross-chain sharing)
            await SaveTokenMetadataIfNeededAsync(position.Token0, chain);
            await SaveTokenMetadataIfNeededAsync(position.Token1, chain);
            
            return new WalletItem
            {
                Type = WalletItemType.LiquidityPool,
                Protocol = protocol,
                Position = new Position { Label = "Liquidity Pool", Tokens = [ supplied0, supplied1, reward0, reward1 ] },
                AdditionalData = new AdditionalData
                {
                    TickSpacing = tickSpacing,
                    SqrtPriceX96 = sqrtPriceX96,
                    CreatedAt = createdAt,
                    Range = new RangeInfo { Lower = lower, Upper = upper, Current = current, InRange = inRange },
                    PriceUnavailable = priceUnavailable
                }
            };
        }
        catch (Exception ex) { _logger.LogError(ex, "UniV3 process position failed id={Id}", position.Id); return null; }
    }
    
    private async Task SaveTokenMetadataIfNeededAsync(UniswapV3Token? token, ChainEnum chain)
    {
        if (token == null || string.IsNullOrEmpty(token.TokenAddress))
            return;
            
        try
        {
            // Check if metadata exists
            var existing = await _metadataService.GetTokenMetadataAsync(chain, token.TokenAddress);
            
            // Save if doesn't exist OR if exists but is incomplete
            if (existing == null || 
                string.IsNullOrEmpty(existing.Symbol) || 
                string.IsNullOrEmpty(existing.Name))
            {
                var metadata = new TokenMetadata
                {
                    Symbol = token.Symbol ?? string.Empty,
                    Name = token.Name ?? string.Empty,
                    LogoUrl = null // Uniswap doesn't provide logos, will be filled by Moralis later
                };
                
                await _metadataService.SetTokenMetadataAsync(chain, token.TokenAddress, metadata);
                _logger.LogDebug("[UniswapV3Mapper] Saved metadata for {Address}: symbol={Symbol}, name={Name}",
                    token.TokenAddress, token.Symbol, token.Name);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[UniswapV3Mapper] Failed to save metadata for {Address}", token.TokenAddress);
        }
    }
    
    private decimal ValidateTokenAmount(decimal amount, string positionId, string fieldName)
    { const decimal MAX_REASONABLE_AMOUNT = 100_000_000m; if (amount > MAX_REASONABLE_AMOUNT) { _logger.LogWarning("UniV3 capping extreme amount pos={Id} field={Field} original={Original} capped={Capped}", positionId, fieldName, amount, MAX_REASONABLE_AMOUNT); return MAX_REASONABLE_AMOUNT; } if (amount < 0) { _logger.LogWarning("UniV3 negative amount pos={Id} field={Field} amount={Amount}", positionId, fieldName, amount); return 0; } if (amount > 1_000_000) { _logger.LogInformation("UniV3 large amount detected pos={Id} field={Field} amount={Amount}", positionId, fieldName, amount); } return amount; }
    private static decimal SafeMultiply(decimal a, decimal b) { try { if (a == 0 || b == 0) return 0; if (a > 0 && b > 0 && a > decimal.MaxValue / b) return decimal.MaxValue; if (a < 0 && b < 0 && a < decimal.MaxValue / b) return decimal.MaxValue; if ((a > 0 && b < 0 && b < decimal.MinValue / a) || (a < 0 && b > 0 && a < decimal.MinValue / b)) return decimal.MinValue; return a * b; } catch (OverflowException) { return a > 0 == b > 0 ? decimal.MaxValue : decimal.MinValue; } }
    private static decimal SafeDivide(decimal a, decimal b) { try { if (b == 0) return 0; return a / b; } catch (OverflowException) { return a > 0 == b > 0 ? decimal.MaxValue : decimal.MinValue; } }
    private static decimal? TryParseInvariant(string? s) => decimal.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : null;
    private static int? TryParseInvariantInt(string? s) => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : null;
    private static long? TryParseInvariantLong(string? s) => long.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : null;
    private static decimal EstimatePriceByToken(string symbol, string address, ChainEnum chain)
    { var sym = symbol?.ToUpperInvariant(); var addr = address?.ToLowerInvariant(); if (chain == ChainEnum.Base) { return sym switch { "WETH" when addr == "0x4200000000000000000000000000000000000006" => 4500m, "USDC" when addr == "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" => 1.0m, "AAVE" when addr == "0x63706e401c06ac8513145b7687a14804d17f814b" => 285m, "CBBTC" when addr == "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf" => 125000m, "WBTC" when addr == "0x2260fac5e5542a9196b8a140fb341d58c700682" => 125000m, _ => 0m }; } return 0m; }
}
