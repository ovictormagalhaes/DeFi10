using System;
using System.Collections.Generic;
using MyWebWallet.API.Models; // For WalletResponse

namespace MyWebWallet.API.Messaging.Contracts;

// Enumerations
public enum IntegrationProvider
{
    MoralisTokens = 1,
    MoralisDeFi = 2,
    UniswapV3Positions = 3,
    AaveSupplies = 4,
    AaveBorrows = 5,
    AlchemyNfts = 6,
    TokenLogos = 7,
    
    // Novos eventos granulares para Uniswap V3
    UniswapV3PositionData = 10,      // GetPositionAsync individual
    UniswapV3PoolMetadata = 11,      // GetPoolMetadataAsync
    UniswapV3PoolState = 12,         // GetCurrentPoolStateAsync
    UniswapV3TickInfo = 13,          // GetTickInfoAsync + GetTickRangeInfoAsync
    UniswapV3FeeGrowth = 14,         // GetPoolFeeGrowthAsync
    UniswapV3PositionRange = 15,     // GetPositionRangeAsync
    UniswapV3TokenMetadata = 16,     // GetErc20MetadataAsync
    UniswapV3PositionEnumeration = 17, // Enumerate positions by owner

    // Pendle
    PendleVePositions = 30,
    PendleDeposits = 31,

    SolanaTokens = 80,
    SolanaKaminoPositions = 81,
    SolanaRaydiumPositions = 82
}

public enum IntegrationStatus
{
    Pending = 0,
    InProgress = 1,
    Success = 2,
    Failed = 3,
    TimedOut = 4,
    Cancelled = 5
}

public enum AggregationStatus
{
    Pending = 0,
    Running = 1,
    Completed = 2,
    CompletedWithErrors = 3,
    TimedOut = 4,
    Cancelled = 5
}

// Contracts (records) -------------------------------------------------------

public sealed record IntegrationRequest(
    Guid JobId,
    Guid RequestId,
    string Account,
    IReadOnlyList<string> Chains,
    IntegrationProvider Provider,
    DateTime RequestedAtUtc,
    int Attempt,
    TimeSpan? OperationTimeout = null,
    IReadOnlyDictionary<string, string>? Metadata = null
);

// Updated: added Chains field so aggregator can know which chain(s) each result refers to.
public sealed record IntegrationResult(
    Guid JobId,
    Guid RequestId,
    string Account,
    IReadOnlyList<string> Chains,
    IntegrationProvider Provider,
    IntegrationStatus Status,
    DateTime StartedAtUtc,
    DateTime FinishedAtUtc,
    string? ErrorCode,
    string? ErrorMessage,
    object? Payload
);

public sealed record IntegrationProgressItem(
    IntegrationProvider Provider,
    IntegrationStatus Status,
    DateTime? FinishedAtUtc,
    string? ErrorCode
);

public sealed record WalletAggregationProgress(
    Guid JobId,
    string Account,
    int ExpectedIntegrations,
    int Completed,
    int Succeeded,
    int Failed,
    int TimedOut,
    AggregationStatus AggregationStatus,
    DateTime LastUpdatedUtc,
    IReadOnlyList<IntegrationProgressItem> Items,
    bool IsFinal
);

public sealed record WalletAggregationCompleted(
    Guid JobId,
    string Account,
    AggregationStatus Status,
    DateTime CompletedAtUtc,
    int Total,
    int Succeeded,
    int Failed,
    int TimedOut
);

public sealed record AggregationStatusResponse(
    Guid JobId,
    string Account,
    AggregationStatus Status,
    int ExpectedIntegrations,
    int Completed,
    int Succeeded,
    int Failed,
    int TimedOut,
    DateTime CreatedAtUtc,
    DateTime LastUpdatedAtUtc,
    bool IsFinal,
    IReadOnlyList<IntegrationProgressItem> Items,
    WalletResponse? FinalWallet
);

public sealed record WalletAggregationRequested(
    Guid JobId,
    string Account,
    IReadOnlyList<string> Chains,
    DateTime RequestedAtUtc,
    int ExpectedIntegrations
);

// Multi-wallet aggregation support (v2)
public sealed record WalletAggregationRequestedV2(
    Guid JobId,
    Guid? WalletGroupId,
    IReadOnlyList<string> Accounts,
    IReadOnlyList<string> Chains,
    DateTime RequestedAtUtc,
    int ExpectedIntegrations
);

// Novos contratos para operações granulares Uniswap V3
public sealed record UniswapV3PositionDataRequest(
    Guid JobId,
    string Account,
    string Chain,
    string TokenId,
    string? PoolAddress = null
);

public sealed record UniswapV3PositionDataResult(
    string TokenId,
    object? PositionData,
    string? PoolAddress,
    bool Success,
    string? ErrorMessage
);

public sealed record UniswapV3PoolMetadataRequest(
    Guid JobId,
    string Account,
    string Chain,
    string PoolAddress
);

public sealed record UniswapV3PoolMetadataResult(
    string PoolAddress,
    object? Metadata,
    bool Success,
    string? ErrorMessage
);

public sealed record UniswapV3PoolStateRequest(
    Guid JobId,
    string Account,
    string Chain,
    string PoolAddress
);

public sealed record UniswapV3PoolStateResult(
    string PoolAddress,
    object? PoolState,
    bool Success,
    string? ErrorMessage
);

public sealed record UniswapV3TickInfoRequest(
    Guid JobId,
    string Account,
    string Chain,
    string PoolAddress,
    int TickLower,
    int TickUpper
);

public sealed record UniswapV3TickInfoResult(
    string PoolAddress,
    int TickLower,
    int TickUpper,
    object? LowerTickInfo,
    object? UpperTickInfo,
    bool Success,
    string? ErrorMessage
);

// Multi-wallet completion (v2)
public sealed record WalletAggregationCompletedV2(
    Guid JobId,
    Guid? WalletGroupId,
    IReadOnlyList<string> Accounts,
    AggregationStatus Status,
    DateTime CompletedAtUtc,
    int Total,
    int Succeeded,
    int Failed,
    int TimedOut
);
