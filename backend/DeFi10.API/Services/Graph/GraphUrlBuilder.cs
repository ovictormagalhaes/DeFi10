using Microsoft.Extensions.Configuration;

namespace DeFi10.API.Services.Graph;

public class GraphUrlBuilder : IGraphUrlBuilder
{
    private readonly IConfiguration _configuration;

    public GraphUrlBuilder(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string BuildFromId(string subgraphId)
    {
        if (string.IsNullOrEmpty(subgraphId)) throw new ArgumentNullException(nameof(subgraphId));

        var template = _configuration["Graph:UrlTemplate"] ?? "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}";
        var apiKey = _configuration["Graph:ApiKey"] ?? string.Empty;

        return template.Replace("{API_KEY}", apiKey).Replace("{ID}", subgraphId);
    }
}
