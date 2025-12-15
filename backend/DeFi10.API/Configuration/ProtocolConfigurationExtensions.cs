using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Configuration;

public static class ProtocolConfigurationExtensions
{
    public static ChainEnum[] GetEnabledChainEnums(
        this IProtocolConfigurationService protocolConfig, 
        string protocolName,
        params string[] excludeChains)
    {
        var def = protocolConfig.GetProtocol(protocolName);
        if (def?.ChainSupports == null) return Array.Empty<ChainEnum>();
        
        var query = def.ChainSupports.AsEnumerable();
        
        // Exclude specific chains if provided
        if (excludeChains?.Length > 0)
        {
            query = query.Where(cs => !excludeChains.Contains(cs.Chain, StringComparer.OrdinalIgnoreCase));
        }
        
        return query
            .Where(cs => cs.Options?.TryGetValue("Enabled", out var enabled) == true && 
                        enabled.Equals("true", StringComparison.OrdinalIgnoreCase))
            .Select(cs => Enum.Parse<ChainEnum>(cs.Chain, ignoreCase: true))
            .ToArray();
    }
    
    public static bool IsChainEnabledForProtocol(
        this IProtocolConfigurationService protocolConfig,
        string protocolName,
        ChainEnum chain)
    {
        return protocolConfig.GetEnabledChainEnums(protocolName).Contains(chain);
    }
}
