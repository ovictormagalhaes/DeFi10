using Microsoft.Extensions.Options;

namespace DeFi10.API.Configuration;

public sealed class GraphOptions : IValidateOptions<GraphOptions>
{
    public string ApiKey { get; set; } = string.Empty;
    public string UrlTemplate { get; set; } = "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}";
    
    /// <summary>
    /// Subgraph IDs para diferentes protocolos e chains
    /// </summary>
    public SubgraphIds Subgraphs { get; set; } = new();

    /// <summary>
    /// Constrói URL completa do subgraph com API key e ID
    /// </summary>
    public string GetSubgraphUrl(string subgraphId)
    {
        if (string.IsNullOrWhiteSpace(ApiKey))
            throw new InvalidOperationException("Graph ApiKey is not configured");
            
        if (string.IsNullOrWhiteSpace(subgraphId))
            throw new ArgumentException("Subgraph ID cannot be empty", nameof(subgraphId));

        return UrlTemplate
            .Replace("{API_KEY}", ApiKey.Trim())
            .Replace("{ID}", subgraphId.Trim());
    }

    public ValidateOptionsResult Validate(string? name, GraphOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
        {
            return ValidateOptionsResult.Fail("Graph:ApiKey is required");
        }

        if (string.IsNullOrWhiteSpace(options.UrlTemplate))
        {
            return ValidateOptionsResult.Fail("Graph:UrlTemplate is required");
        }

        if (!options.UrlTemplate.Contains("{API_KEY}") || !options.UrlTemplate.Contains("{ID}"))
        {
            return ValidateOptionsResult.Fail("Graph:UrlTemplate must contain {API_KEY} and {ID} placeholders");
        }

        return ValidateOptionsResult.Success;
    }
}

public class SubgraphIds
{
    /// <summary>
    /// Aave V3 Base mainnet subgraph ID
    /// </summary>
    public string AaveV3Base { get; set; } = "ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH6123cr7";
    
    /// <summary>
    /// Aave V3 Ethereum mainnet subgraph ID
    /// </summary>
    public string AaveV3Ethereum { get; set; } = "";
    
    /// <summary>
    /// Aave V3 Arbitrum mainnet subgraph ID
    /// </summary>
    public string AaveV3Arbitrum { get; set; } = "";
}
