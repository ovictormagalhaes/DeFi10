namespace MyWebWallet.API.Messaging.Contracts.Enums;

public enum IntegrationProvider
{
    MoralisTokens = 1,
    MoralisDeFi = 2,
    UniswapV3Positions = 3,
    AaveSupplies = 4,
    AaveBorrows = 5,
    AlchemyNfts = 6,
    TokenLogos = 7,

    UniswapV3PositionData = 10,
    UniswapV3PoolMetadata = 11,
    UniswapV3PoolState = 12,
    UniswapV3TickInfo = 13,
    UniswapV3FeeGrowth = 14,
    UniswapV3PositionRange = 15,
    UniswapV3TokenMetadata = 16,
    UniswapV3PositionEnumeration = 17,

    PendleVePositions = 30,
    PendleDeposits = 31,

    // NFT Screening Providers (Tier 1 - can trigger protocol queries)
    MoralisNfts = 50,
    SolanaNfts = 51,

    SolanaTokens = 80,
    SolanaKaminoPositions = 81,
    SolanaRaydiumPositions = 82
}