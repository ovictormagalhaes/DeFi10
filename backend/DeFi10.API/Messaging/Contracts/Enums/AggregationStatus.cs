namespace DeFi10.API.Messaging.Contracts.Enums;

public enum AggregationStatus
{
    Pending = 0,
    Running = 1,
    Consolidating = 2,
    Completed = 3,
    CompletedWithErrors = 4,
    TimedOut = 5,
    Cancelled = 6
}
