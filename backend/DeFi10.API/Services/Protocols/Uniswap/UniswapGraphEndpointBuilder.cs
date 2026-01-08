using DeFi10.API.Models;
using DeFi10.API.Services.Graph;
using Microsoft.Extensions.Configuration;

namespace DeFi10.API.Services.Protocols.Uniswap;

public interface IUniswapGraphEndpointBuilder
{
    string Build(Chain chain);
    string Build(string chainKey);
}

public class UniswapGraphEndpointBuilder : IUniswapGraphEndpointBuilder
{
    private readonly IConfiguration _configuration;
    private readonly IGraphUrlBuilder _graphUrlBuilder;

    public UniswapGraphEndpointBuilder(IConfiguration configuration, IGraphUrlBuilder graphUrlBuilder)
    {
        _configuration = configuration;
        _graphUrlBuilder = graphUrlBuilder;
    }

    public string Build(Chain chain) => Build(chain.ToString());

    public string Build(string chainKey)
    {
        // Read subgraph id from configuration: ProtocolConfiguration:UniswapV3:GraphIds:{chain}
        var idsSection = _configuration.GetSection("ProtocolConfiguration:UniswapV3:GraphIds");
        if (idsSection.Exists())
        {
            var id = idsSection[chainKey];
            if (!string.IsNullOrEmpty(id))
            {
                return _graphUrlBuilder.BuildFromId(id);
            }
        }

        throw new InvalidOperationException($"No Uniswap Graph id configured for chain '{chainKey}'");
    }
}
