using DeFi10.API.Messaging.Contracts.Enums;

namespace DeFi10.API.Messaging.Constants;


public static class RoutingKeys
{
    public const string IntegrationRequestPattern = "integration.request.*";
    public const string IntegrationResultPattern = "integration.result.*";
    public const string AggregationStatusPattern = "aggregation.status.*";
    
    public const string ConsolidationRequested = "consolidation.requested";
    public const string IntegrationResults = "integration.results";

    public static string ForIntegrationRequest(IntegrationProvider provider) 
        => $"integration.request.{ProviderSlug(provider)}";


    public static string ForIntegrationResult(IntegrationProvider provider) 
        => $"integration.result.{ProviderSlug(provider)}";


    public static string ForAggregationStatus(string jobId) 
        => $"aggregation.status.{jobId}";
    
    private static string ProviderSlug(IntegrationProvider provider) 
        => provider.ToString().ToLowerInvariant();
}
