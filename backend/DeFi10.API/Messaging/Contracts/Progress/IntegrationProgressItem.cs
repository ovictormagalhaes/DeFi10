using DeFi10.API.Messaging.Contracts.Enums;

namespace DeFi10.API.Messaging.Contracts.Progress;

public sealed record IntegrationProgressItem(
    IntegrationProvider Provider,
    IntegrationStatus Status,
    DateTime? FinishedAtUtc,
    string? ErrorCode,
    double? DurationMs
);
