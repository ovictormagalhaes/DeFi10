namespace DeFi10.API.Messaging.Contracts.Progress;

public sealed record WalletConsolidationRequested(
    Guid JobId,
    Guid? WalletGroupId,
    string[] Accounts,
    string[] Chains,
    int TotalProviders,
    int Succeeded,
    int Failed,
    int TimedOut,
    DateTime RequestedAtUtc
);
