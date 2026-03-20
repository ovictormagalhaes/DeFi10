using DeFi10.API.Models;
using DeFi10.API.Models.Persistence;
using DeFi10.API.Repositories.Interfaces;
using Microsoft.Extensions.Logging;

namespace DeFi10.API.Migration;

/// <summary>
/// Seeds MongoDB with known token metadata (logos, symbols, names) for common tokens
/// </summary>
public class KnownTokensSeeder
{
    private readonly ITokenMetadataRepository _repository;
    private readonly ILogger<KnownTokensSeeder> _logger;

    public KnownTokensSeeder(ITokenMetadataRepository repository, ILogger<KnownTokensSeeder> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task SeedKnownTokensAsync()
    {
        _logger.LogInformation("[KnownTokensSeeder] Starting to seed known tokens...");

        var knownTokens = GetKnownTokens();
        var seededCount = 0;
        var skippedCount = 0;

        foreach (var token in knownTokens)
        {
            try
            {
                var existing = await _repository.GetByChainAndAddressAsync(token.ChainId, token.Address);

                if (existing != null && !string.IsNullOrEmpty(existing.LogoUrl))
                {
                    _logger.LogDebug("[KnownTokensSeeder] Token already exists with logo: {Symbol} on chain {Chain}", 
                        token.Symbol, token.ChainId);
                    skippedCount++;
                    continue;
                }

                await _repository.UpsertAsync(token);
                seededCount++;
                
                _logger.LogInformation("[KnownTokensSeeder] Seeded: {Symbol} ({Name}) on chain {Chain}", 
                    token.Symbol, token.Name, token.ChainId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[KnownTokensSeeder] Failed to seed token: {Symbol}", token.Symbol);
            }
        }

        _logger.LogInformation("[KnownTokensSeeder] Completed: {Seeded} tokens seeded, {Skipped} skipped", 
            seededCount, skippedCount);
    }

    private List<TokenMetadataDocument> GetKnownTokens()
    {
        return new List<TokenMetadataDocument>
        {
            // Base Chain Tokens
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "cbBTC",
                Name = "Coinbase Wrapped BTC",
                Address = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
                ChainId = (int)Chain.Base,
                LogoUrl = "https://assets.coingecko.com/coins/images/40268/standard/cbBTC_32_Circle.png",
                PriceUsd = null, // Will be filled by price service
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "WETH",
                Name = "WRAPPED ETHER",
                Address = "0x4200000000000000000000000000000000000006",
                ChainId = (int)Chain.Base,
                LogoUrl = "https://assets.coingecko.com/coins/images/2518/standard/weth.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "USDC",
                Name = "USD COIN",
                Address = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                ChainId = (int)Chain.Base,
                LogoUrl = "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "AAVE",
                Name = "AAVE",
                Address = "0x63706e401c06ac8513145b7687a14804d17f814b",
                ChainId = (int)Chain.Base,
                LogoUrl = "https://assets.coingecko.com/coins/images/12645/standard/aave-token-round.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "DAI",
                Name = "DAI",
                Address = "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
                ChainId = (int)Chain.Base,
                LogoUrl = "https://assets.coingecko.com/coins/images/9956/standard/Badge_Dai.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },

            // Ethereum Tokens
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "WETH",
                Name = "WRAPPED ETHER",
                Address = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                ChainId = (int)Chain.Ethereum,
                LogoUrl = "https://assets.coingecko.com/coins/images/2518/standard/weth.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "USDC",
                Name = "USD COIN",
                Address = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                ChainId = (int)Chain.Ethereum,
                LogoUrl = "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "USDT",
                Name = "TETHER USD",
                Address = "0xdac17f958d2ee523a2206206994597c13d831ec7",
                ChainId = (int)Chain.Ethereum,
                LogoUrl = "https://assets.coingecko.com/coins/images/325/standard/Tether.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "WBTC",
                Name = "WRAPPED BTC",
                Address = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
                ChainId = (int)Chain.Ethereum,
                LogoUrl = "https://assets.coingecko.com/coins/images/7598/standard/wrapped_bitcoin_wbtc.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "AAVE",
                Name = "AAVE",
                Address = "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
                ChainId = (int)Chain.Ethereum,
                LogoUrl = "https://assets.coingecko.com/coins/images/12645/standard/aave-token-round.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },

            // Arbitrum Tokens
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "WETH",
                Name = "WRAPPED ETHER",
                Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
                ChainId = (int)Chain.Arbitrum,
                LogoUrl = "https://assets.coingecko.com/coins/images/2518/standard/weth.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "USDC",
                Name = "USD COIN",
                Address = "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
                ChainId = (int)Chain.Arbitrum,
                LogoUrl = "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "ARB",
                Name = "ARBITRUM",
                Address = "0x912ce59144191c1204e64559fe8253a0e49e6548",
                ChainId = (int)Chain.Arbitrum,
                LogoUrl = "https://assets.coingecko.com/coins/images/16547/standard/arb.jpg",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },

            // Solana Tokens
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "SOL",
                Name = "SOLANA",
                Address = "So11111111111111111111111111111111111111112",
                ChainId = (int)Chain.Solana,
                LogoUrl = "https://assets.coingecko.com/coins/images/4128/standard/solana.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "USDC",
                Name = "USD COIN",
                Address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                ChainId = (int)Chain.Solana,
                LogoUrl = "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "USDT",
                Name = "TETHER USD",
                Address = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                ChainId = (int)Chain.Solana,
                LogoUrl = "https://assets.coingecko.com/coins/images/325/standard/Tether.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "JTO",
                Name = "JITO",
                Address = "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
                ChainId = (int)Chain.Solana,
                LogoUrl = "https://assets.coingecko.com/coins/images/33853/standard/jito.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = "JUP",
                Name = "JUPITER",
                Address = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
                ChainId = (int)Chain.Solana,
                LogoUrl = "https://assets.coingecko.com/coins/images/34188/standard/jup.png",
                PriceUsd = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
    }
}
